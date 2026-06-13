import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BookingRow,
  BookingStatus,
  Database,
  Json,
  OpsBookingExceptionRow,
  TechnicianLocationRow,
} from "../database.types";
import {
  offsetRangeForPage,
  type PagedParams,
  type PagedResult,
} from "../page-range";
import {
  requireSessionUserId,
  SupabaseApiError,
  takeRows,
  takeSingleRow,
} from "../result";
import {
  allocateNumericHappyCode,
  allocateNumericVisitCode,
  normalizeServiceOtpCode,
} from "./service-otp-codes";
import {
  adminBookingCancelledCopy,
  adminMarketplaceFloatedCopy,
  adminReassignmentNeededCopy,
  adminTechnicianReassignedCopy,
  adminVendorAcceptedCopy,
  adminVendorClaimedCopy,
  adminVendorDeclinedCopy,
  vendorBookingAssignedCopy,
  emitAdminBookingNotification,
  emitVendorBookingNotification,
} from "../notifications/booking-notifications";
import { isVendorCancelInLastHourBeforeSlot } from "../finance/customer-credits-policy";
import { ensureCancellationPenaltySettlement } from "../finance/vendor-settlement-api";
import {
  emitMarketplaceNotificationEvents,
  readMarketplaceBroadcastFilter,
} from "../notifications/marketplace-notifications";
import * as vendorApi from "../vendors/vendor-api";
import {
  customerLocationSignalsFromServiceSiteAddress,
  vendorCoversCustomerSignals,
} from "../vendors/vendor-service-area";

/** One hour to accept or reject an incoming customer request (see {@link vendorResponseDeadline}). */
export const VENDOR_BOOKING_RESPONSE_WINDOW_MS = 60 * 60 * 1000;
export const CUSTOMER_BOOKING_CANCELLATION_WINDOW_MS = 60 * 60 * 1000;
export const HAPPY_CODE_REGENERATE_COOLDOWN_MS = 5 * 60 * 1000;
export const VENDOR_CANCEL_GRACE_WINDOW_MS = 15 * 60 * 1000;
export const VENDOR_CANCEL_SOFT_WINDOW_MS = 60 * 60 * 1000;
export const VENDOR_CANCEL_NEAR_SLOT_MS = 2 * 60 * 60 * 1000;
/** Rolling window for repeat late-cancel strike detection (penalized cancels only). */
export const VENDOR_CANCEL_REPEAT_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Vendor accept/reject window anchor. Priority:
 * 1. `metadata.vendor_response.anchor_at` (e.g. direct admin assign to a vendor)
 * 2. `metadata.marketplace.open_at` when default-vendor marketplace is floated (clock starts when ops opens the job)
 * 3. `booking.created_at` (legacy / one-off paid requests)
 */
function resolveVendorResponseAnchorIso(
  booking: Pick<BookingRow, "created_at" | "metadata">,
): string | null {
  const m =
    booking.metadata &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, unknown>)
      : null;
  if (!m) return null;
  const vr = m.vendor_response;
  if (vr && typeof vr === "object" && !Array.isArray(vr)) {
    const anchor = (vr as Record<string, unknown>).anchor_at;
    if (typeof anchor === "string" && anchor.trim()) return anchor.trim();
  }
  const marketplace = m.marketplace;
  if (
    marketplace &&
    typeof marketplace === "object" &&
    !Array.isArray(marketplace)
  ) {
    const mp = marketplace as Record<string, unknown>;
    if (
      mp.mode === "default_vendor" &&
      mp.floated === true &&
      typeof mp.open_at === "string" &&
      mp.open_at.trim()
    ) {
      return mp.open_at.trim();
    }
  }
  return null;
}

export function vendorResponseDeadline(
  booking: Pick<BookingRow, "created_at" | "metadata">,
): Date {
  const anchorIso = resolveVendorResponseAnchorIso(booking);
  if (anchorIso) {
    const t = new Date(anchorIso).getTime();
    if (Number.isFinite(t)) {
      return new Date(t + VENDOR_BOOKING_RESPONSE_WINDOW_MS);
    }
  }
  return new Date(
    new Date(booking.created_at).getTime() + VENDOR_BOOKING_RESPONSE_WINDOW_MS,
  );
}

export function isWithinVendorResponseWindow(
  booking: Pick<BookingRow, "created_at" | "metadata">,
  at: Date = new Date(),
): boolean {
  return at.getTime() <= vendorResponseDeadline(booking).getTime();
}

/** Late cancellation fees apply only after vendor acceptance and technician assignment. */
export function customerCancellationPenaltyEligible(
  booking: Pick<BookingRow, "status" | "technician_id">,
): boolean {
  return booking.status === "accepted" && Boolean(booking.technician_id);
}

function readBookingVendorAcceptanceAt(
  metadata: Json | null | undefined,
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return null;
  const raw = (metadata as Record<string, unknown>).vendor_acceptance;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const acceptedAt = (raw as Record<string, unknown>).accepted_at;
  return typeof acceptedAt === "string" && acceptedAt.trim()
    ? acceptedAt
    : null;
}

/** Anchor for the 1-hour fee-free window: vendor acceptance time once a technician is assigned. */
export function customerCancellationPenaltyAnchorAt(
  booking: Pick<
    BookingRow,
    "created_at" | "metadata" | "status" | "technician_id"
  >,
): string | null {
  if (!customerCancellationPenaltyEligible(booking)) return null;
  return readBookingVendorAcceptanceAt(booking.metadata) ?? booking.created_at;
}

export function customerCancellationDeadline(
  booking: Pick<
    BookingRow,
    "created_at" | "metadata" | "status" | "technician_id"
  >,
): Date {
  const anchorIso = customerCancellationPenaltyAnchorAt(booking);
  const anchorMs = anchorIso
    ? new Date(anchorIso).getTime()
    : new Date(booking.created_at).getTime();
  return new Date(anchorMs + CUSTOMER_BOOKING_CANCELLATION_WINDOW_MS);
}

export function isWithinCustomerCancellationWindow(
  booking: Pick<
    BookingRow,
    "created_at" | "metadata" | "status" | "technician_id"
  >,
  at: Date = new Date(),
): boolean {
  if (!customerCancellationPenaltyEligible(booking)) return true;
  return at.getTime() <= customerCancellationDeadline(booking).getTime();
}

export type CreateBookingInput = Pick<
  Database["public"]["Tables"]["bookings"]["Insert"],
  | "customer_id"
  | "vendor_id"
  | "subscription_id"
  | "scheduled_start"
  | "scheduled_end"
  | "service_site_address"
  | "service_type"
  | "estimated_price_cents"
  | "currency"
  | "customer_notes"
  | "metadata"
> & {
  /** Customer inserts default to `pending_payment`; vendor inserts default to `confirmed`. */
  status?: BookingStatus;
};

/**
 * Customer: create booking for own customer_id (RLS enforced).
 */
export async function createBookingAsCustomer(
  client: SupabaseClient<Database>,
  input: CreateBookingInput,
): Promise<BookingRow> {
  const { data: userData } = await client.auth.getUser();
  const uid = requireSessionUserId(userData.user?.id);

  if (!input.subscription_id && (input.status ?? "pending_payment") === "pending_payment") {
    const { assertCustomerMayBookOneTimeVisit, readServiceAddressIdFromBookingMetadata } =
      await import("../subscriptions/amc-visit-booking-eligibility");
    await assertCustomerMayBookOneTimeVisit(client, {
      serviceAddressId: readServiceAddressIdFromBookingMetadata(input.metadata),
    });
  }

  const { data, error } = await client
    .from("bookings")
    .insert({
      customer_id: input.customer_id,
      vendor_id: input.vendor_id ?? null,
      subscription_id: input.subscription_id ?? null,
      scheduled_start: input.scheduled_start,
      scheduled_end: input.scheduled_end,
      service_site_address: input.service_site_address,
      service_type: input.service_type ?? "panel_cleaning",
      estimated_price_cents: input.estimated_price_cents ?? 0,
      currency: input.currency ?? "INR",
      customer_notes: input.customer_notes ?? null,
      metadata: input.metadata ?? {},
      /** Checkout bookings stay `pending_payment` until payment succeeds → `confirmed`. */
      status: input.status ?? "pending_payment",
      created_by: uid,
    })
    .select()
    .single();

  const booking = takeSingleRow(data, error);
  if (booking.status === "confirmed") {
    const { postBookingConfirmedNotifications } =
      await import("./booking-confirm-notifications");
    return postBookingConfirmedNotifications(client, booking);
  }
  return booking;
}

/**
 * Vendor: create / dispatch booking on behalf of operations (RLS: vendor_id must be yours).
 */
export async function createBookingAsVendor(
  client: SupabaseClient<Database>,
  input: CreateBookingInput & { vendor_id: string },
): Promise<BookingRow> {
  const { data: userData } = await client.auth.getUser();
  const uid = requireSessionUserId(userData.user?.id);

  const { data, error } = await client
    .from("bookings")
    .insert({
      customer_id: input.customer_id,
      vendor_id: input.vendor_id,
      subscription_id: input.subscription_id ?? null,
      scheduled_start: input.scheduled_start,
      scheduled_end: input.scheduled_end,
      service_site_address: input.service_site_address,
      service_type: input.service_type ?? "panel_cleaning",
      estimated_price_cents: input.estimated_price_cents ?? 0,
      currency: input.currency ?? "INR",
      customer_notes: input.customer_notes ?? null,
      metadata: input.metadata ?? {},
      status: input.status ?? "confirmed",
      created_by: uid,
    })
    .select()
    .single();

  return takeSingleRow(data, error);
}

export type BookingListFilters = {
  status?: BookingStatus | BookingStatus[];
  from?: string;
  to?: string;
  limit?: number;
};

/**
 * List bookings visible to the current session (customer / vendor / technician / admin via RLS).
 */
export async function listVisibleBookings(
  client: SupabaseClient<Database>,
  filters?: BookingListFilters,
): Promise<BookingRow[]> {
  let q = client
    .from("bookings")
    .select("*")
    .order("scheduled_start", { ascending: true });

  if (filters?.status) {
    const st = Array.isArray(filters.status)
      ? filters.status
      : [filters.status];
    q = q.in("status", st);
  }
  if (filters?.from) {
    q = q.gte("scheduled_start", filters.from);
  }
  if (filters?.to) {
    q = q.lte("scheduled_start", filters.to);
  }
  if (filters?.limit != null) {
    q = q.limit(filters.limit);
  }

  const { data, error } = await q;
  return takeRows(data, error);
}

/**
 * Vendor inbox: paid bookings awaiting action (`confirmed`), plus active visits.
 * Excludes `pending_payment` (unpaid checkout).
 */
export async function listVendorBookingRequests(
  client: SupabaseClient<Database>,
): Promise<BookingRow[]> {
  const rows = await listVisibleBookings(client, {
    status: ["confirmed", "accepted", "in_progress"],
  });
  const filtered = rows.filter(
    (r) => r.status !== "confirmed" || isWithinVendorResponseWindow(r),
  );
  return [...filtered].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

const VENDOR_BOOKINGS_PAGE_LIMIT = 500;

/**
 * Vendor dashboard / history: all bookings visible to the vendor org via RLS (newest scheduled first).
 */
export async function listVendorBookingsAll(
  client: SupabaseClient<Database>,
  options?: { limit?: number },
): Promise<BookingRow[]> {
  const limit = options?.limit ?? VENDOR_BOOKINGS_PAGE_LIMIT;
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .order("scheduled_start", { ascending: false })
    .limit(limit);

  return takeRows(data, error);
}

export async function listVendorBookingsAllPaged(
  client: SupabaseClient<Database>,
  params: PagedParams,
): Promise<PagedResult<BookingRow>> {
  const { from, to } = offsetRangeForPage(params.page, params.pageSize);
  const { data, error, count } = await client
    .from("bookings")
    .select("*", { count: "exact" })
    .order("scheduled_start", { ascending: false })
    .range(from, to);

  return { rows: takeRows(data, error), total: count ?? 0 };
}

export async function getBookingById(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingRow> {
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();
  return takeSingleRow(data, error);
}

/**
 * Customer: distinct `vendor_id` values from completed bookings, newest visit first.
 * Rows are limited by RLS to the signed-in customer.
 */
export async function listDistinctVendorIdsFromCompletedCustomerBookings(
  client: SupabaseClient<Database>,
): Promise<string[]> {
  const { data, error } = await client
    .from("bookings")
    .select("vendor_id, scheduled_start")
    .eq("status", "completed")
    .not("vendor_id", "is", null)
    .order("scheduled_start", { ascending: false });

  const rows = takeRows(data, error);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const id = r.vendor_id;
    if (typeof id !== "string" || !id.trim()) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Customer (or other roles with RLS): most recent GPS sample for the booking’s assigned technician.
 * Returns `null` if no technician or no location rows yet.
 */
export async function getLastTechnicianLocationForBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<TechnicianLocationRow | null> {
  const booking = await getBookingById(client, bookingId);
  if (!booking.technician_id) return null;

  const { data, error } = await client
    .from("technician_locations")
    .select("*")
    .eq("technician_id", booking.technician_id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new SupabaseApiError(error.message, error);
  return data ?? null;
}

/** Normalize OM-/BK-/VIS- style tokens for lookup (trim, collapse spaces, uppercase). */
export function normalizeBookingLookupCode(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, "").toUpperCase();
  return t.length > 0 ? t : null;
}

/** @deprecated Use {@link normalizeBookingLookupCode}. */
export function normalizeBookingReferenceCode(raw: string): string | null {
  return normalizeBookingLookupCode(raw);
}

/**
 * Resolve booking by `reference_code` (OM-… / legacy BK-…) or numeric `booking_code` (Job Start Code).
 * Visible rows depend on RLS (technicians only see bookings assigned to them).
 */
export async function getBookingByLookupCode(
  client: SupabaseClient<Database>,
  rawCode: string,
): Promise<BookingRow | null> {
  const code = normalizeBookingLookupCode(rawCode);
  if (!code) return null;

  const byRef = await client
    .from("bookings")
    .select("*")
    .eq("reference_code", code)
    .maybeSingle();
  if (byRef.error) throw new SupabaseApiError(byRef.error.message, byRef.error);
  if (byRef.data) return byRef.data;

  const byVisit = await client
    .from("bookings")
    .select("*")
    .eq("booking_code", code)
    .maybeSingle();
  if (byVisit.error)
    throw new SupabaseApiError(byVisit.error.message, byVisit.error);
  return byVisit.data ?? null;
}

/**
 * Resolve booking by reference code visible to the current session (RLS).
 * Same as {@link getBookingByLookupCode} (supports OM-, legacy BK-, and VIS- codes).
 */
export async function getBookingByReferenceCode(
  client: SupabaseClient<Database>,
  rawCode: string,
): Promise<BookingRow | null> {
  return getBookingByLookupCode(client, rawCode);
}

export type BookingPatch = Partial<
  Pick<
    BookingRow,
    | "status"
    | "vendor_id"
    | "technician_id"
    | "technician_en_route_at"
    | "scheduled_start"
    | "scheduled_end"
    | "actual_start"
    | "actual_end"
    | "estimated_price_cents"
    | "final_price_cents"
    | "customer_notes"
    | "internal_notes"
    | "cancellation_reason"
    | "cancelled_at"
    | "cancelled_by"
    | "metadata"
    | "booking_code"
  >
>;

/**
 * Partial update - allowed fields depend on RLS (customer vs vendor vs technician vs admin).
 */
export async function updateBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
  patch: BookingPatch,
): Promise<BookingRow> {
  const { data, error } = await client
    .from("bookings")
    .update(patch)
    .eq("id", bookingId)
    .select()
    .single();

  return takeSingleRow(data, error);
}

async function resolveVendorDisplayName(
  client: SupabaseClient<Database>,
  vendorId: string | null | undefined,
): Promise<string | null> {
  if (!vendorId) return null;
  const { data, error } = await client
    .from("vendors")
    .select("business_name, trade_name")
    .eq("id", vendorId)
    .maybeSingle();
  if (error) return null;
  return data?.trade_name?.trim() || data?.business_name?.trim() || null;
}

async function resolveTechnicianDisplayName(
  client: SupabaseClient<Database>,
  technicianId: string | null | undefined,
): Promise<string | null> {
  if (!technicianId) return null;
  const { data: tech, error: techErr } = await client
    .from("technicians")
    .select("user_id")
    .eq("id", technicianId)
    .maybeSingle();
  if (techErr || !tech?.user_id) return null;
  const { data: user, error: userErr } = await client
    .from("users")
    .select("full_name, email")
    .eq("id", tech.user_id)
    .maybeSingle();
  if (userErr) return null;
  return user?.full_name?.trim() || user?.email?.trim() || null;
}

async function getMyVendorId(
  client: SupabaseClient<Database>,
): Promise<string | null> {
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data } = await client
    .from("vendors")
    .select("id")
    .eq("user_id", uid)
    .maybeSingle();
  return data?.id ?? null;
}

async function assertVendorOwnsBooking(
  client: SupabaseClient<Database>,
  booking: BookingRow,
): Promise<void> {
  const vid = await getMyVendorId(client);
  if (!vid || booking.vendor_id !== vid) {
    throw new SupabaseApiError("You cannot manage this booking.");
  }
}

function mergeBookingMetadata(
  existing: Json,
  patch: Record<string, Json>,
): Json {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, Json>) }
      : {};
  return { ...base, ...patch };
}

function normalizeCodeInput(value: string): string {
  return normalizeServiceOtpCode(value);
}

function allocateHappyCode(): string {
  return allocateNumericHappyCode();
}

export type BookingServiceOtpMeta = {
  startCode: string | null;
  happyCode: string | null;
  startVerifiedAt: string | null;
  completedWithHappyCodeAt: string | null;
  startFailCount: number;
  startLockedUntil: string | null;
  happyFailCount: number;
  happyLockedUntil: string | null;
  happyRegeneratedAt: string | null;
};

export type BookingVendorReassignmentMeta = {
  awaitingAdminAssignment: boolean;
  cancelledByVendorAt: string | null;
  previousVendorId: string | null;
  previousTechnicianId: string | null;
  reason: string | null;
};

export type BookingVendorCancellationPenaltyMeta = {
  tier: "none" | "soft" | "hard";
  penaltyPaise: number;
  cancellationDelayMs: number;
  reason: string | null;
  assessedAt: string | null;
  priorStrikeCount30d: number | null;
  repeatEscalationStep: number | null;
};

/** Populated when the customer cancels from the app (grace vs late fee). */
export type BookingCustomerCancellationMeta = {
  withinGraceWindow: boolean;
  lateFeePaise: number;
  acknowledgedLateFee: boolean;
  assessedAt: string | null;
};

export type BookingCustomerCompensationMeta = {
  couponId: string | null;
  couponCode: string | null;
  amountPaise: number;
  expiresAt: string | null;
  issuedAt: string | null;
  reason: string | null;
};

export function readBookingServiceOtpMeta(
  metadata: Json | null | undefined,
): BookingServiceOtpMeta {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {
      startCode: null,
      happyCode: null,
      startVerifiedAt: null,
      completedWithHappyCodeAt: null,
      startFailCount: 0,
      startLockedUntil: null,
      happyFailCount: 0,
      happyLockedUntil: null,
      happyRegeneratedAt: null,
    };
  }
  const otp = (metadata as Record<string, unknown>).service_otp;
  if (!otp || typeof otp !== "object" || Array.isArray(otp)) {
    return {
      startCode: null,
      happyCode: null,
      startVerifiedAt: null,
      completedWithHappyCodeAt: null,
      startFailCount: 0,
      startLockedUntil: null,
      happyFailCount: 0,
      happyLockedUntil: null,
      happyRegeneratedAt: null,
    };
  }
  const o = otp as Record<string, unknown>;
  return {
    startCode:
      typeof o.start_code === "string"
        ? normalizeCodeInput(o.start_code)
        : null,
    happyCode:
      typeof o.happy_code === "string"
        ? normalizeCodeInput(o.happy_code)
        : null,
    startVerifiedAt:
      typeof o.start_verified_at === "string" ? o.start_verified_at : null,
    completedWithHappyCodeAt:
      typeof o.completed_with_happy_code_at === "string"
        ? o.completed_with_happy_code_at
        : null,
    startFailCount:
      typeof o.start_fail_count === "number"
        ? Math.max(0, Math.round(o.start_fail_count))
        : 0,
    startLockedUntil:
      typeof o.start_locked_until === "string" ? o.start_locked_until : null,
    happyFailCount:
      typeof o.happy_fail_count === "number"
        ? Math.max(0, Math.round(o.happy_fail_count))
        : 0,
    happyLockedUntil:
      typeof o.happy_locked_until === "string" ? o.happy_locked_until : null,
    happyRegeneratedAt:
      typeof o.happy_regenerated_at === "string"
        ? o.happy_regenerated_at
        : null,
  };
}

export function readBookingVendorReassignmentMeta(
  metadata: Json | null | undefined,
): BookingVendorReassignmentMeta {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {
      awaitingAdminAssignment: false,
      cancelledByVendorAt: null,
      previousVendorId: null,
      previousTechnicianId: null,
      reason: null,
    };
  }
  const row = (metadata as Record<string, unknown>).vendor_reassignment;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return {
      awaitingAdminAssignment: false,
      cancelledByVendorAt: null,
      previousVendorId: null,
      previousTechnicianId: null,
      reason: null,
    };
  }
  const r = row as Record<string, unknown>;
  return {
    awaitingAdminAssignment: r.awaiting_admin_assignment === true,
    cancelledByVendorAt:
      typeof r.cancelled_by_vendor_at === "string"
        ? r.cancelled_by_vendor_at
        : null,
    previousVendorId:
      typeof r.previous_vendor_id === "string" ? r.previous_vendor_id : null,
    previousTechnicianId:
      typeof r.previous_technician_id === "string"
        ? r.previous_technician_id
        : null,
    reason: typeof r.reason === "string" ? r.reason : null,
  };
}

export function readBookingCustomerCancellationMeta(
  metadata: Json | null | undefined,
): BookingCustomerCancellationMeta | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return null;
  const row = (metadata as Record<string, unknown>).customer_cancellation;
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const r = row as Record<string, unknown>;
  return {
    withinGraceWindow: r.within_grace_window === true,
    lateFeePaise:
      typeof r.late_fee_paise === "number"
        ? Math.max(0, Math.round(r.late_fee_paise))
        : 0,
    acknowledgedLateFee: r.acknowledged_late_fee === true,
    assessedAt: typeof r.assessed_at === "string" ? r.assessed_at : null,
  };
}

export function readBookingVendorCancellationPenaltyMeta(
  metadata: Json | null | undefined,
): BookingVendorCancellationPenaltyMeta {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {
      tier: "none",
      penaltyPaise: 0,
      cancellationDelayMs: 0,
      reason: null,
      assessedAt: null,
      priorStrikeCount30d: null,
      repeatEscalationStep: null,
    };
  }
  const row = (metadata as Record<string, unknown>).vendor_cancellation_penalty;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return {
      tier: "none",
      penaltyPaise: 0,
      cancellationDelayMs: 0,
      reason: null,
      assessedAt: null,
      priorStrikeCount30d: null,
      repeatEscalationStep: null,
    };
  }
  const r = row as Record<string, unknown>;
  const tierRaw = typeof r.tier === "string" ? r.tier : "none";
  const tier = tierRaw === "soft" || tierRaw === "hard" ? tierRaw : "none";
  return {
    tier,
    penaltyPaise:
      typeof r.penalty_paise === "number"
        ? Math.max(0, Math.round(r.penalty_paise))
        : 0,
    cancellationDelayMs:
      typeof r.cancellation_delay_ms === "number"
        ? Math.max(0, Math.round(r.cancellation_delay_ms))
        : 0,
    reason: typeof r.reason === "string" ? r.reason : null,
    assessedAt: typeof r.assessed_at === "string" ? r.assessed_at : null,
    priorStrikeCount30d:
      typeof r.prior_penalized_cancels_30d === "number"
        ? Math.max(0, Math.round(r.prior_penalized_cancels_30d))
        : null,
    repeatEscalationStep:
      typeof r.repeat_escalation_step === "number"
        ? Math.max(0, Math.round(r.repeat_escalation_step))
        : null,
  };
}

export function readBookingCustomerCompensationMeta(
  metadata: Json | null | undefined,
): BookingCustomerCompensationMeta {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {
      couponId: null,
      couponCode: null,
      amountPaise: 0,
      expiresAt: null,
      issuedAt: null,
      reason: null,
    };
  }
  const row = (metadata as Record<string, unknown>).customer_compensation;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return {
      couponId: null,
      couponCode: null,
      amountPaise: 0,
      expiresAt: null,
      issuedAt: null,
      reason: null,
    };
  }
  const r = row as Record<string, unknown>;
  return {
    couponId: typeof r.coupon_id === "string" ? r.coupon_id : null,
    couponCode: typeof r.coupon_code === "string" ? r.coupon_code : null,
    amountPaise:
      typeof r.amount_paise === "number"
        ? Math.max(0, Math.round(r.amount_paise))
        : 0,
    expiresAt: typeof r.expires_at === "string" ? r.expires_at : null,
    issuedAt: typeof r.issued_at === "string" ? r.issued_at : null,
    reason: typeof r.reason === "string" ? r.reason : null,
  };
}

function randomToken(size = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < size; i++)
    out += chars[Math.floor(Math.random() * chars.length)]!;
  return out;
}

function buildCustomerCompensationCoupon(): {
  couponId: string;
  couponCode: string;
} {
  const token = randomToken(6);
  return { couponId: `vc_${token.toLowerCase()}`, couponCode: `SORRY${token}` };
}

function deriveVendorLateCancelConsequence(params: {
  acceptedAtIso: string;
  scheduledStartIso: string;
}): {
  tier: "none" | "soft" | "hard";
  penaltyPaise: number;
  creditPaise: number;
  cancellationDelayMs: number;
  reason: string;
} {
  const nowMs = Date.now();
  const acceptedMs = new Date(params.acceptedAtIso).getTime();
  const startMs = new Date(params.scheduledStartIso).getTime();
  const delayMs = Number.isFinite(acceptedMs)
    ? Math.max(0, nowMs - acceptedMs)
    : VENDOR_CANCEL_SOFT_WINDOW_MS + 1;
  const msToStart = Number.isFinite(startMs)
    ? startMs - nowMs
    : Number.POSITIVE_INFINITY;
  if (delayMs <= VENDOR_CANCEL_GRACE_WINDOW_MS) {
    return {
      tier: "none",
      penaltyPaise: 0,
      creditPaise: 0,
      cancellationDelayMs: delayMs,
      reason: "within_grace_window",
    };
  }
  const hard =
    delayMs > VENDOR_CANCEL_SOFT_WINDOW_MS ||
    msToStart <= VENDOR_CANCEL_NEAR_SLOT_MS;
  if (hard) {
    return {
      tier: "hard",
      penaltyPaise: 30000,
      creditPaise: 25000,
      cancellationDelayMs: delayMs,
      reason:
        msToStart <= VENDOR_CANCEL_NEAR_SLOT_MS
          ? "late_cancel_near_slot"
          : "late_cancel_after_60m",
    };
  }
  return {
    tier: "soft",
    penaltyPaise: 15000,
    creditPaise: 15000,
    cancellationDelayMs: delayMs,
    reason: "late_cancel_after_15m",
  };
}

type VendorLateCancelConsequence = ReturnType<
  typeof deriveVendorLateCancelConsequence
>;

function penaltyEventTimeMs(metadata: Json | null): number | null {
  const pen = readBookingVendorCancellationPenaltyMeta(metadata);
  const vr = readBookingVendorReassignmentMeta(metadata);
  const raw = pen.assessedAt ?? vr.cancelledByVendorAt;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Counts prior **penalized** vendor-initiated accepted-booking cancellations by this vendor in the last 30 days
 * (excluding `excludeBookingId`). Requires those rows to remain visible to the vendor session (RLS).
 */
async function countVendorPenalizedLateCancelsLast30Days(
  client: SupabaseClient<Database>,
  vendorId: string,
  excludeBookingId: string,
): Promise<number> {
  const cutoff = Date.now() - VENDOR_CANCEL_REPEAT_LOOKBACK_MS;
  const rows = await listVendorBookingsAll(client, { limit: 650 });
  let n = 0;
  for (const r of rows) {
    if (r.id === excludeBookingId) continue;
    const prev = readBookingVendorReassignmentMeta(r.metadata).previousVendorId;
    if (prev !== vendorId) continue;
    const pen = readBookingVendorCancellationPenaltyMeta(r.metadata);
    if (pen.tier === "none" || pen.penaltyPaise <= 0) continue;
    const eventMs = penaltyEventTimeMs(r.metadata);
    if (eventMs == null || eventMs < cutoff) continue;
    n++;
  }
  return n;
}

/** Escalates penalties / customer credits when multiple late cancels occur inside the 30-day lookback. */
function applyVendorLateCancelRepeatEscalation(
  base: VendorLateCancelConsequence,
  priorStrikeCount30d: number,
): VendorLateCancelConsequence & { repeatEscalationStep: number } {
  if (base.tier === "none") {
    return { ...base, repeatEscalationStep: 0 };
  }
  let repeatEscalationStep = 0;
  let tier = base.tier;
  let penaltyPaise = base.penaltyPaise;
  let creditPaise = base.creditPaise;
  let reason = base.reason;

  if (base.tier === "soft") {
    if (priorStrikeCount30d >= 2) {
      repeatEscalationStep = 2;
      tier = "hard";
      penaltyPaise = 40000;
      creditPaise = 30000;
      reason = `${reason};repeat_30d_${priorStrikeCount30d + 1}_tier_hard_plus`;
    } else if (priorStrikeCount30d >= 1) {
      repeatEscalationStep = 1;
      tier = "hard";
      penaltyPaise = 30000;
      creditPaise = 25000;
      reason = `${reason};repeat_30d_${priorStrikeCount30d + 1}_tier_hard`;
    }
  } else if (base.tier === "hard") {
    if (priorStrikeCount30d >= 2) {
      repeatEscalationStep = 2;
      penaltyPaise = 50000;
      creditPaise = 30000;
      reason = `${reason};repeat_30d_${priorStrikeCount30d + 1}_severe`;
    } else if (priorStrikeCount30d >= 1) {
      repeatEscalationStep = 1;
      penaltyPaise = 40000;
      creditPaise = 28000;
      reason = `${reason};repeat_30d_${priorStrikeCount30d + 1}_amp`;
    }
  }

  return {
    tier,
    penaltyPaise,
    creditPaise,
    cancellationDelayMs: base.cancellationDelayMs,
    reason,
    repeatEscalationStep,
  };
}

/** True when `metadata.vendor_routing.used_fallback` (automatic partner assignment). */
export function bookingUsedFallbackVendor(
  booking: Pick<BookingRow, "metadata">,
): boolean {
  const m = booking.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return false;
  const vr = (m as Record<string, unknown>).vendor_routing;
  if (!vr || typeof vr !== "object" || Array.isArray(vr)) return false;
  return (vr as Record<string, unknown>).used_fallback === true;
}

function getVendorRoutingRecord(
  booking: Pick<BookingRow, "metadata">,
): Record<string, Json> {
  const m = booking.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  const vr = (m as Record<string, unknown>).vendor_routing;
  if (!vr || typeof vr !== "object" || Array.isArray(vr)) return {};
  return vr as Record<string, Json>;
}

/**
 * Admin: ask the assigned vendor to confirm field / technician readiness for a **fallback** booking.
 * Keeps status `confirmed`, sets `metadata.vendor_routing.awaiting_vendor_readiness` (in-app; pair with email/push separately).
 */
export async function adminNotifyVendorFallbackReadiness(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingRow> {
  const { data: userData } = await client.auth.getUser();
  const uid = requireSessionUserId(userData.user?.id);

  const booking = await getBookingById(client, bookingId);
  if (!bookingUsedFallbackVendor(booking)) {
    throw new SupabaseApiError(
      "Only fallback-routed bookings use this workflow.",
    );
  }
  if (booking.status !== "confirmed") {
    throw new SupabaseApiError(
      "Notify vendor is only available after checkout is paid (booking must be confirmed).",
    );
  }

  const now = new Date().toISOString();
  const vr = getVendorRoutingRecord(booking);
  const metadata = mergeBookingMetadata(booking.metadata, {
    vendor_routing: {
      ...vr,
      awaiting_vendor_readiness: true,
      admin_readiness_nudge_at: now,
      admin_readiness_nudge_by: uid,
    } as Json,
  });

  return updateBooking(client, bookingId, {
    metadata,
  });
}

/**
 * Vendor: acknowledge technician readiness after ops nudged a fallback booking (status stays `confirmed`).
 * Next step: assign a verified technician ({@link vendorAcceptBookingRequest}).
 */
export async function vendorConfirmTechnicianReadinessForFallback(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingRow> {
  const booking = await getBookingById(client, bookingId);
  await assertVendorOwnsBooking(client, booking);
  if (booking.status !== "confirmed") {
    throw new SupabaseApiError(
      "Confirm readiness only while the booking is confirmed (paid) and awaiting vendor action.",
    );
  }
  if (!bookingUsedFallbackVendor(booking)) {
    throw new SupabaseApiError(
      "This confirmation applies to fallback-routed bookings.",
    );
  }

  const now = new Date().toISOString();
  const vr = getVendorRoutingRecord(booking);
  const metadata = mergeBookingMetadata(booking.metadata, {
    vendor_routing: {
      ...vr,
      awaiting_vendor_readiness: false,
      technician_readiness_confirmed_at: now,
    } as Json,
  });

  return updateBooking(client, bookingId, {
    metadata,
  });
}

async function allocateUniqueBookingCode(
  client: SupabaseClient<Database>,
): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt++) {
    const code = allocateNumericVisitCode();
    const { data } = await client
      .from("bookings")
      .select("id")
      .eq("booking_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new SupabaseApiError(
    "Could not allocate a unique booking code. Try again.",
  );
}

export type VendorAcceptBookingInput = {
  technicianId: string;
  technicianReadinessConfirmed: boolean;
  safetyComplianceConfirmed: boolean;
  /** Uniform + PPE / safety kit will be on site for this visit. */
  uniformSafetyKitConfirmed: boolean;
  /** Site procedures and safety expectations explained to the assigned technician. */
  proceduresBriefedConfirmed: boolean;
};

/**
 * Vendor accepts a paid request: assigns a verified technician, records compliance acknowledgements,
 * allocates {@link BookingRow.booking_code}, sets status to **accepted**.
 * Must be within {@link VENDOR_BOOKING_RESPONSE_WINDOW_MS} of `created_at` when moving from `confirmed`.
 */
export async function vendorAcceptBookingRequest(
  client: SupabaseClient<Database>,
  bookingId: string,
  input: VendorAcceptBookingInput,
): Promise<BookingRow> {
  if (
    !input.technicianReadinessConfirmed ||
    !input.safetyComplianceConfirmed ||
    !input.uniformSafetyKitConfirmed ||
    !input.proceduresBriefedConfirmed
  ) {
    throw new SupabaseApiError(
      "Confirm all pre-visit checks: technician readiness, safety compliance, uniform and safety kit on site, and safety briefing to the assigned technician.",
    );
  }
  const techId = input.technicianId.trim();
  if (!techId) {
    throw new SupabaseApiError("Assign a technician.");
  }

  const booking = await getBookingById(client, bookingId);
  await assertVendorOwnsBooking(client, booking);

  if (booking.status !== "confirmed") {
    throw new SupabaseApiError(
      "Only confirmed (paid) bookings can be assigned.",
    );
  }
  if (!isWithinVendorResponseWindow(booking)) {
    throw new SupabaseApiError("The 1-hour response window has expired.");
  }

  const vendorId = await getMyVendorId(client);
  if (!vendorId)
    throw new SupabaseApiError("No vendor profile for this account.");

  const { data: tech, error: techErr } = await client
    .from("technicians")
    .select("id, vendor_id, verification_status, is_verified")
    .eq("id", techId)
    .maybeSingle();

  if (techErr) throw new SupabaseApiError(techErr.message, techErr);
  if (!tech) throw new SupabaseApiError("Technician not found.");
  if (tech.vendor_id !== vendorId) {
    throw new SupabaseApiError("That technician is not on your team.");
  }
  if (tech.verification_status !== "verified" || !tech.is_verified) {
    throw new SupabaseApiError("Assign a verified technician.");
  }

  const booking_code = await allocateUniqueBookingCode(client);
  const happyCode = allocateHappyCode();
  const now = new Date().toISOString();

  const metadata = mergeBookingMetadata(booking.metadata, {
    vendor_acceptance: {
      accepted_at: now,
      technician_readiness_ack: true,
      safety_compliance_ack: true,
      uniform_safety_kit_ack: true,
      safety_briefing_ack: true,
      technician_id: techId,
    },
    service_otp: {
      start_code: booking_code,
      happy_code: happyCode,
      generated_at: now,
    } as Json,
  });

  const updated = await updateBooking(client, bookingId, {
    status: "accepted",
    technician_id: techId,
    booking_code,
    metadata,
  });
  const vendorName = await resolveVendorDisplayName(client, updated.vendor_id);
  const technicianName = await resolveTechnicianDisplayName(client, techId);
  const copy = adminVendorAcceptedCopy(updated, vendorName, technicianName);
  await emitAdminBookingNotification(client, {
    booking: updated,
    eventType: "admin_booking_vendor_accepted",
    ...copy,
    vendorName,
    technicianName,
  });
  const { applyNextVendorDeferredPenaltyOnBooking } = await import(
    "../finance/vendor-deferred-penalty-api"
  );
  await applyNextVendorDeferredPenaltyOnBooking(client, updated);
  return updated;
}

/**
 * Vendor declines a customer request within the response window (stores cancellation reason).
 */
export async function vendorRejectBookingRequest(
  client: SupabaseClient<Database>,
  bookingId: string,
  reason: string,
): Promise<BookingRow> {
  const trimmed = reason.trim();
  if (trimmed.length < 4) {
    throw new SupabaseApiError("Enter a short reason (at least 4 characters).");
  }

  const booking = await getBookingById(client, bookingId);
  await assertVendorOwnsBooking(client, booking);

  if (booking.status !== "confirmed") {
    throw new SupabaseApiError(
      "Only confirmed (paid) bookings awaiting vendor action can be rejected.",
    );
  }
  if (!isWithinVendorResponseWindow(booking)) {
    throw new SupabaseApiError("The 1-hour response window has expired.");
  }

  const { data: userData } = await client.auth.getUser();
  const uid = requireSessionUserId(userData.user?.id);
  const now = new Date().toISOString();

  const metadata = mergeBookingMetadata(booking.metadata, {
    vendor_rejection: {
      rejected_at: now,
      reason: trimmed,
    },
  });

  const updated = await updateBooking(client, bookingId, {
    status: "cancelled",
    cancellation_reason: trimmed,
    cancelled_at: now,
    cancelled_by: uid,
    metadata,
  });
  const vendorName = await resolveVendorDisplayName(client, updated.vendor_id);
  const declinedCopy = adminVendorDeclinedCopy(updated, vendorName, trimmed);
  await emitAdminBookingNotification(client, {
    booking: updated,
    eventType: "admin_booking_vendor_rejected",
    ...declinedCopy,
    vendorName,
    note: trimmed,
  });
  const cancelledCopy = adminBookingCancelledCopy(updated);
  await emitAdminBookingNotification(client, {
    booking: updated,
    eventType: "admin_booking_cancelled",
    ...cancelledCopy,
    vendorName,
  });
  return updated;
}

/** Vendor can cancel an accepted booking; Oorjaman ops re-assigns the next vendor. */
export async function vendorCancelAcceptedBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
  reason: string,
): Promise<BookingRow> {
  const trimmed = reason.trim();
  if (trimmed.length < 4) {
    throw new SupabaseApiError("Enter a short reason (at least 4 characters).");
  }
  const booking = await getBookingById(client, bookingId);
  await assertVendorOwnsBooking(client, booking);
  if (booking.status !== "accepted") {
    throw new SupabaseApiError(
      "Only accepted bookings can be cancelled by vendor.",
    );
  }
  const { data: userData } = await client.auth.getUser();
  const uid = requireSessionUserId(userData.user?.id);
  const nowIso = new Date().toISOString();
  const acceptedAtIso =
    booking.metadata &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? (
          (booking.metadata as Record<string, unknown>).vendor_acceptance as
            | Record<string, unknown>
            | undefined
        )?.accepted_at
      : null;
  const acceptedAt =
    typeof acceptedAtIso === "string" ? acceptedAtIso : booking.created_at;
  const vid = booking.vendor_id;
  if (!vid) {
    throw new SupabaseApiError("Booking has no assigned vendor.");
  }
  const priorStrikes = await countVendorPenalizedLateCancelsLast30Days(
    client,
    vid,
    bookingId,
  );
  const lastHourBeforeSlot = isVendorCancelInLastHourBeforeSlot(
    booking.scheduled_start,
    new Date(nowIso),
  );
  const baseConsequence = deriveVendorLateCancelConsequence({
    acceptedAtIso: acceptedAt,
    scheduledStartIso: booking.scheduled_start,
  });
  let consequence = applyVendorLateCancelRepeatEscalation(
    baseConsequence,
    priorStrikes,
  );
  if (lastHourBeforeSlot && consequence.penaltyPaise <= 0) {
    consequence = {
      ...consequence,
      tier: "hard",
      penaltyPaise: 30000,
      reason: "last_hour_before_slot",
    };
  }
  const useWalletCredits = lastHourBeforeSlot;
  const coupon =
    !useWalletCredits && consequence.creditPaise > 0
      ? buildCustomerCompensationCoupon()
      : null;
  const expiresAt =
    coupon && consequence.creditPaise > 0
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;
  const nextMeta = mergeBookingMetadata(booking.metadata, {
    marketplace: {
      mode: "default_vendor",
      floated: false,
      awaiting_admin_assignment: true,
      vendor_cancelled_reassign: true,
      reassign_requested_at: nowIso,
    } as Json,
    vendor_reassignment: {
      awaiting_admin_assignment: true,
      cancelled_by_vendor_at: nowIso,
      cancelled_by_user_id: uid,
      previous_vendor_id: booking.vendor_id,
      previous_technician_id: booking.technician_id,
      reason: trimmed,
    } as Json,
    vendor_cancellation_penalty: {
      tier: lastHourBeforeSlot ? "last_hour" : consequence.tier,
      penalty_paise: consequence.penaltyPaise,
      cancellation_delay_ms: consequence.cancellationDelayMs,
      reason: lastHourBeforeSlot ? "last_hour_before_slot" : consequence.reason,
      assessed_at: nowIso,
      prior_penalized_cancels_30d: priorStrikes,
      repeat_escalation_step: consequence.repeatEscalationStep,
      base_tier: baseConsequence.tier,
      base_penalty_paise: baseConsequence.penaltyPaise,
      base_credit_paise: baseConsequence.creditPaise,
      deferred_to_next_booking: lastHourBeforeSlot && consequence.penaltyPaise > 0,
      customer_wallet_credits_issued: lastHourBeforeSlot,
    } as Json,
    ...(coupon
      ? {
          customer_compensation: {
            coupon_id: coupon.couponId,
            coupon_code: coupon.couponCode,
            amount_paise: consequence.creditPaise,
            issued_at: nowIso,
            expires_at: expiresAt,
            reason: "vendor_late_cancellation",
          } as Json,
        }
      : {}),
  });
  const updated = await updateBooking(client, bookingId, {
    status: "confirmed",
    vendor_id: null,
    technician_id: null,
    booking_code: null,
    metadata: nextMeta,
  });
  const vendorName = await resolveVendorDisplayName(client, vid);
  const reassignCopy = adminReassignmentNeededCopy(updated, vendorName);
  await emitAdminBookingNotification(client, {
    booking: updated,
    eventType: "admin_booking_needs_reassignment",
    ...reassignCopy,
    vendorName,
    note: trimmed,
  });
  if (lastHourBeforeSlot) {
    const { issueVendorLastHourCancelCredits } = await import(
      "../finance/customer-credits-api"
    );
    const { queueVendorDeferredPenalty } = await import(
      "../finance/vendor-deferred-penalty-api"
    );
    await issueVendorLastHourCancelCredits(client, {
      customer_id: booking.customer_id,
      source_booking_id: booking.id,
    });
    if (consequence.penaltyPaise > 0) {
      await queueVendorDeferredPenalty(client, {
        vendor_id: vid,
        source_booking_id: booking.id,
        penalty_paise: consequence.penaltyPaise,
        metadata: {
          reason: "vendor_last_hour_cancel",
          assessed_at: nowIso,
        },
      });
    }
  } else {
    await ensureCancellationPenaltySettlement(client, updated, vid);
  }
  return updated;
}

/**
 * Vendor: change assigned technician on an accepted or in-progress visit (verified team member only).
 */
export async function vendorReassignBookingTechnician(
  client: SupabaseClient<Database>,
  bookingId: string,
  technicianId: string,
): Promise<BookingRow> {
  const techId = technicianId.trim();
  if (!techId) {
    throw new SupabaseApiError("Select a technician.");
  }

  const booking = await getBookingById(client, bookingId);
  await assertVendorOwnsBooking(client, booking);

  if (booking.status !== "accepted" && booking.status !== "in_progress") {
    throw new SupabaseApiError(
      "Technician can only be reassigned for accepted or in-progress visits.",
    );
  }

  const vendorId = await getMyVendorId(client);
  if (!vendorId)
    throw new SupabaseApiError("No vendor profile for this account.");

  const { data: tech, error: techErr } = await client
    .from("technicians")
    .select("id, vendor_id, verification_status, is_verified")
    .eq("id", techId)
    .maybeSingle();

  if (techErr) throw new SupabaseApiError(techErr.message, techErr);
  if (!tech) throw new SupabaseApiError("Technician not found.");
  if (tech.vendor_id !== vendorId) {
    throw new SupabaseApiError("That technician is not on your team.");
  }
  if (tech.verification_status !== "verified" || !tech.is_verified) {
    throw new SupabaseApiError("Assign a verified technician.");
  }

  const updated = await updateBooking(client, bookingId, {
    technician_id: techId,
  });
  const technicianName = await resolveTechnicianDisplayName(client, techId);
  const vendorName = await resolveVendorDisplayName(client, vendorId);
  const techReassignCopy = adminTechnicianReassignedCopy(
    updated,
    vendorName,
    technicianName,
  );
  await emitAdminBookingNotification(client, {
    booking: updated,
    eventType: "admin_booking_technician_reassigned",
    ...techReassignCopy,
    vendorName,
    technicianName,
  });
  return updated;
}

/** Admin: bookings that used automatic vendor fallback (see metadata.vendor_routing). */
export async function adminListFallbackBookings(
  client: SupabaseClient<Database>,
  limit = 100,
): Promise<BookingRow[]> {
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .contains("metadata", { vendor_routing: { used_fallback: true } })
    .order("created_at", { ascending: false })
    .limit(limit);

  return takeRows(data, error);
}

/** Admin monitoring tabs map to status / routing filters. */
export type AdminBookingMonitorTab =
  | "all"
  | "pending"
  | "default_vendor_queue"
  | "awaiting_confirmation"
  | "accepted"
  | "completed"
  | "fallback"
  | "cancelled";

export type BookingMonitoringEnriched = BookingRow & {
  vendorDisplayName: string | null;
  technicianDisplayName: string | null;
};

/**
 * Admin: list bookings for operations monitoring (RLS: admin).
 * - **pending** - paid, vendor queue (`confirmed`)
 * - **awaiting_confirmation** - fallback + ops readiness nudge on `confirmed`
 * - **accepted** - crew assigned / on site (`accepted`, `in_progress`)
 * - **completed** - visit finished
 * - **fallback** - `metadata.vendor_routing.used_fallback === true`
 * - **cancelled** - cancelled bookings (customer/vendor/system)
 */
export async function adminListBookingsForMonitoring(
  client: SupabaseClient<Database>,
  tab: AdminBookingMonitorTab,
  options?: { limit?: number },
): Promise<BookingRow[]> {
  let q = client
    .from("bookings")
    .select("*")
    .order("scheduled_start", { ascending: false });

  switch (tab) {
    case "pending":
      q = q.eq("status", "confirmed");
      break;
    case "default_vendor_queue":
      q = q
        .eq("status", "confirmed")
        .is("vendor_id", null)
        .contains("metadata", { marketplace: { mode: "default_vendor" } });
      break;
    case "awaiting_confirmation":
      q = q.eq("status", "confirmed").contains("metadata", {
        vendor_routing: { awaiting_vendor_readiness: true },
      });
      break;
    case "accepted":
      q = q.in("status", ["accepted", "in_progress"]);
      break;
    case "completed":
      q = q.eq("status", "completed");
      break;
    case "fallback":
      q = q.contains("metadata", { vendor_routing: { used_fallback: true } });
      break;
    case "cancelled":
      q = q.eq("status", "cancelled");
      break;
    default:
      break;
  }

  if (options?.limit != null) {
    q = q.limit(options.limit);
  }

  const { data, error } = await q;
  return takeRows(data, error);
}

export async function adminListBookingsForMonitoringPaged(
  client: SupabaseClient<Database>,
  tab: AdminBookingMonitorTab,
  params: PagedParams,
): Promise<PagedResult<BookingRow>> {
  const { from, to } = offsetRangeForPage(params.page, params.pageSize);
  let q = client
    .from("bookings")
    .select("*", { count: "exact" })
    .order("scheduled_start", { ascending: false });

  switch (tab) {
    case "pending":
      q = q.eq("status", "confirmed");
      break;
    case "default_vendor_queue":
      q = q
        .eq("status", "confirmed")
        .is("vendor_id", null)
        .contains("metadata", { marketplace: { mode: "default_vendor" } });
      break;
    case "awaiting_confirmation":
      q = q.eq("status", "confirmed").contains("metadata", {
        vendor_routing: { awaiting_vendor_readiness: true },
      });
      break;
    case "accepted":
      q = q.in("status", ["accepted", "in_progress"]);
      break;
    case "completed":
      q = q.eq("status", "completed");
      break;
    case "fallback":
      q = q.contains("metadata", { vendor_routing: { used_fallback: true } });
      break;
    case "cancelled":
      q = q.eq("status", "cancelled");
      break;
    default:
      break;
  }

  const { data, error, count } = await q.range(from, to);
  return { rows: takeRows(data, error), total: count ?? 0 };
}

export async function adminGetBookingMonitoringRowsPaged(
  client: SupabaseClient<Database>,
  tab: AdminBookingMonitorTab,
  params: PagedParams,
): Promise<PagedResult<BookingMonitoringEnriched>> {
  const { rows, total } = await adminListBookingsForMonitoringPaged(
    client,
    tab,
    params,
  );
  const enriched = await enrichBookingsWithVendorTechnicianLabels(client, rows);
  return { rows: enriched, total };
}

function nextMorningAtNineIstIso(from = new Date()): string {
  const dt = new Date(from);
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(dt.getTime() + istOffsetMs);
  ist.setUTCDate(ist.getUTCDate() + 1);
  ist.setUTCHours(3, 30, 0, 0);
  return new Date(ist.getTime() - istOffsetMs).toISOString();
}

function addHoursIso(fromIso: string, hours: number): string {
  const d = new Date(fromIso);
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d.toISOString();
}

export async function adminFloatDefaultVendorBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingRow> {
  const booking = await getBookingById(client, bookingId);
  if (booking.status !== "confirmed") {
    throw new SupabaseApiError(
      "Only confirmed bookings can be floated to vendors.",
    );
  }
  const m =
    booking.metadata &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, Json>)
      : {};
  const marketplace =
    m.marketplace &&
    typeof m.marketplace === "object" &&
    !Array.isArray(m.marketplace)
      ? (m.marketplace as Record<string, Json>)
      : {};
  if (marketplace.mode !== "default_vendor") {
    throw new SupabaseApiError("This booking is not in default-vendor mode.");
  }

  const now = new Date();
  const istHour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(now),
  );
  const openAt =
    istHour >= 19 ? nextMorningAtNineIstIso(now) : now.toISOString();
  const openUntil = addHoursIso(openAt, 1);
  const nextMeta = mergeBookingMetadata(booking.metadata, {
    marketplace: {
      ...marketplace,
      floated: true,
      awaiting_admin_float: false,
      open_at: openAt,
      open_until: openUntil,
      floated_at: now.toISOString(),
    } as Json,
  });
  const updated = await updateBooking(client, bookingId, {
    metadata: nextMeta,
  });
  const vendorCount = await emitMarketplaceNotificationEvents(client, {
    booking: updated,
    eventType: "marketplace_broadcast",
    channels: ["in_app", "email", "sms", "whatsapp"],
    note: "Marketplace request floated by operations.",
  });
  const copy = adminMarketplaceFloatedCopy(updated, vendorCount);
  await emitAdminBookingNotification(client, {
    booking: updated,
    eventType: "admin_marketplace_floated",
    ...copy,
    note: "Floated by operations.",
  });
  return updated;
}

export type OpsIssueType =
  | "default_vendor_unclaimed"
  | "awaiting_admin_float"
  | "preferred_vendor_no_response"
  | "vendor_slow_confirmation"
  | "visit_not_started"
  | "visit_not_closed"
  | "schedule_missed";

export async function adminListOpsBookingExceptions(
  client: SupabaseClient<Database>,
  limit = 200,
): Promise<OpsBookingExceptionRow[]> {
  const { data, error } = await client
    .from("ops_booking_exceptions")
    .select("*")
    .order("scheduled_start", { ascending: true })
    .limit(limit);
  return takeRows(data, error);
}

export async function adminRefloatMarketplaceBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
  hours = 1,
): Promise<BookingRow> {
  const booking = await getBookingById(client, bookingId);
  if (booking.status !== "confirmed") {
    throw new SupabaseApiError("Only confirmed bookings can be re-floated.");
  }
  if (booking.vendor_id) {
    throw new SupabaseApiError("Booking already has a vendor assigned.");
  }
  const m =
    booking.metadata &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, Json>)
      : {};
  const marketplace =
    m.marketplace &&
    typeof m.marketplace === "object" &&
    !Array.isArray(m.marketplace)
      ? (m.marketplace as Record<string, Json>)
      : {};
  if (marketplace.mode !== "default_vendor") {
    throw new SupabaseApiError(
      "Booking is not in default-vendor marketplace mode.",
    );
  }
  const nowIso = new Date().toISOString();
  const openUntil = addHoursIso(nowIso, Math.max(1, hours));
  const nextMeta = mergeBookingMetadata(booking.metadata, {
    marketplace: {
      ...marketplace,
      floated: true,
      awaiting_admin_float: false,
      open_at: nowIso,
      open_until: openUntil,
      re_floated_at: nowIso,
    } as Json,
  });
  const updated = await updateBooking(client, bookingId, {
    metadata: nextMeta,
  });
  const vendorCount = await emitMarketplaceNotificationEvents(client, {
    booking: updated,
    eventType: "marketplace_broadcast",
    channels: ["in_app", "email", "sms", "whatsapp"],
    note: "Marketplace window re-floated by operations.",
  });
  const copy = adminMarketplaceFloatedCopy(updated, vendorCount);
  await emitAdminBookingNotification(client, {
    booking: updated,
    eventType: "admin_marketplace_floated",
    ...copy,
    note: "Re-floated by operations.",
  });
  return updated;
}

const AMC_BOOKING_REASSIGN_STATUSES: BookingStatus[] = [
  "confirmed",
  "accepted",
  "in_progress",
];

/** Admin: reassign one AMC visit booking to a different approved partner (wallet pays whoever completes). */
export async function adminReassignAmcBookingVendor(
  client: SupabaseClient<Database>,
  bookingId: string,
  vendorId: string,
): Promise<BookingRow> {
  const booking = await getBookingById(client, bookingId);
  if (!booking.subscription_id) {
    throw new SupabaseApiError("Only AMC subscription visits can be reassigned here.");
  }
  if (!AMC_BOOKING_REASSIGN_STATUSES.includes(booking.status)) {
    throw new SupabaseApiError(
      "Only confirmed, accepted, or in-progress AMC visits can be reassigned.",
    );
  }
  const vid = vendorId.trim();
  if (!vid) throw new SupabaseApiError("Choose a vendor.");
  if (booking.vendor_id === vid) {
    throw new SupabaseApiError("This visit is already assigned to that partner.");
  }
  const { data: vendor, error: vendorErr } = await client
    .from("vendors")
    .select("id, approval_status")
    .eq("id", vid)
    .maybeSingle();
  if (vendorErr) throw new SupabaseApiError(vendorErr.message, vendorErr);
  if (!vendor || vendor.approval_status !== "approved") {
    throw new SupabaseApiError("Vendor must be approved before assignment.");
  }

  const nowIso = new Date().toISOString();
  const previousVendorId = booking.vendor_id;
  const m =
    booking.metadata &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, Json>)
      : {};
  const reassignment =
    m.vendor_reassignment &&
    typeof m.vendor_reassignment === "object" &&
    !Array.isArray(m.vendor_reassignment)
      ? (m.vendor_reassignment as Record<string, Json>)
      : {};

  const nextMeta = mergeBookingMetadata(booking.metadata, {
    amc_vendor_reassignment: {
      previous_vendor_id: previousVendorId,
      reassigned_at: nowIso,
      reassigned_by: "admin",
      scope: "booking",
      subscription_id: booking.subscription_id,
    } as Json,
    vendor_reassignment: {
      ...reassignment,
      awaiting_admin_assignment: false,
      reassigned_at: nowIso,
      reassigned_vendor_id: vid,
      previous_vendor_id: previousVendorId,
    } as Json,
    vendor_response: { anchor_at: nowIso } as Json,
  });

  const updated = await updateBooking(client, bookingId, {
    vendor_id: vid,
    technician_id: null,
    status: booking.status === "accepted" ? "confirmed" : booking.status,
    metadata: nextMeta,
  });

  const vendorName = await resolveVendorDisplayName(client, vid);
  const assignedCopy = vendorBookingAssignedCopy(updated);
  await emitVendorBookingNotification(client, {
    booking: updated,
    eventType: "vendor_booking_assigned",
    recipientVendorId: vid,
    ...assignedCopy,
    vendorName,
    note: "AMC visit reassigned by operations.",
  });
  return updated;
}

/** Admin: directly assign a confirmed booking to a specific approved vendor. */
export async function adminAssignVendorToBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
  vendorId: string,
): Promise<BookingRow> {
  const booking = await getBookingById(client, bookingId);
  if (booking.status !== "confirmed") {
    throw new SupabaseApiError(
      "Only confirmed bookings can be assigned by admin.",
    );
  }
  const vid = vendorId.trim();
  if (!vid) throw new SupabaseApiError("Choose a vendor.");
  const { data: vendor, error: vendorErr } = await client
    .from("vendors")
    .select("id, approval_status")
    .eq("id", vid)
    .maybeSingle();
  if (vendorErr) throw new SupabaseApiError(vendorErr.message, vendorErr);
  if (!vendor || vendor.approval_status !== "approved") {
    throw new SupabaseApiError("Vendor must be approved before assignment.");
  }
  const nowIso = new Date().toISOString();
  const m =
    booking.metadata &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, Json>)
      : {};
  const marketplace =
    m.marketplace &&
    typeof m.marketplace === "object" &&
    !Array.isArray(m.marketplace)
      ? (m.marketplace as Record<string, Json>)
      : {};
  const reassignment =
    m.vendor_reassignment &&
    typeof m.vendor_reassignment === "object" &&
    !Array.isArray(m.vendor_reassignment)
      ? (m.vendor_reassignment as Record<string, Json>)
      : {};
  const existingVr =
    m.vendor_response &&
    typeof m.vendor_response === "object" &&
    !Array.isArray(m.vendor_response)
      ? (m.vendor_response as Record<string, Json>)
      : {};
  /** Direct assign (no marketplace window): start vendor SLA from now. If already floated, keep deadline from open_at. */
  const setVendorResponseAnchor =
    !booking.vendor_id &&
    !(
      marketplace.floated === true &&
      typeof marketplace.open_at === "string" &&
      String(marketplace.open_at).trim()
    );
  const nextMeta = mergeBookingMetadata(booking.metadata, {
    marketplace: {
      ...marketplace,
      floated: false,
      awaiting_admin_float: false,
      awaiting_admin_assignment: false,
      assigned_by_admin_at: nowIso,
      assigned_vendor_id: vid,
    } as Json,
    vendor_reassignment: {
      ...reassignment,
      awaiting_admin_assignment: false,
      reassigned_at: nowIso,
      reassigned_vendor_id: vid,
    } as Json,
    ...(setVendorResponseAnchor
      ? {
          vendor_response: {
            ...existingVr,
            anchor_at: nowIso,
          } as Json,
        }
      : {}),
  });
  const updated = await updateBooking(client, bookingId, {
    vendor_id: vid,
    technician_id: null,
    status: "confirmed",
    metadata: nextMeta,
  });
  const vendorName = await resolveVendorDisplayName(client, vid);
  const assignedCopy = vendorBookingAssignedCopy(updated);
  await emitVendorBookingNotification(client, {
    booking: updated,
    eventType: "vendor_booking_assigned",
    recipientVendorId: vid,
    ...assignedCopy,
    vendorName,
    note: "Direct admin assignment.",
  });
  return updated;
}

export async function adminFlagBookingOpsIssue(
  client: SupabaseClient<Database>,
  bookingId: string,
  issueType: OpsIssueType,
  note?: string | null,
): Promise<BookingRow> {
  const booking = await getBookingById(client, bookingId);
  const { data: userData } = await client.auth.getUser();
  const uid = requireSessionUserId(userData.user?.id);
  const nowIso = new Date().toISOString();
  const trimmedNote = note?.trim() || null;
  const m =
    booking.metadata &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, Json>)
      : {};
  const ops =
    m.ops && typeof m.ops === "object" && !Array.isArray(m.ops)
      ? (m.ops as Record<string, Json>)
      : {};
  const issueCount = typeof ops.issue_count === "number" ? ops.issue_count : 0;
  const nextMeta = mergeBookingMetadata(booking.metadata, {
    ops: {
      ...ops,
      issue_count: issueCount + 1,
      last_issue_type: issueType,
      last_issue_note: trimmedNote,
      last_issue_at: nowIso,
      last_issue_by: uid,
    } as Json,
  });
  return updateBooking(client, bookingId, { metadata: nextMeta });
}

/** Admin support action: clear OTP mismatch counters and lock timers for a booking. */
export async function adminResetBookingOtpLock(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingRow> {
  const booking = await getBookingById(client, bookingId);
  const { data: userData } = await client.auth.getUser();
  const uid = requireSessionUserId(userData.user?.id);
  const nowIso = new Date().toISOString();
  const otp = readBookingServiceOtpMeta(booking.metadata);
  const m =
    booking.metadata &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, Json>)
      : {};
  const rawOtp =
    m.service_otp &&
    typeof m.service_otp === "object" &&
    !Array.isArray(m.service_otp)
      ? (m.service_otp as Record<string, Json>)
      : {};
  const nextMeta = mergeBookingMetadata(booking.metadata, {
    service_otp: {
      ...rawOtp,
      start_code: otp.startCode,
      happy_code: otp.happyCode,
      start_verified_at: otp.startVerifiedAt,
      completed_with_happy_code_at: otp.completedWithHappyCodeAt,
      start_fail_count: 0,
      start_locked_until: null,
      happy_fail_count: 0,
      happy_locked_until: null,
      lock_reset_at: nowIso,
      lock_reset_by: uid,
    } as Json,
  });
  return updateBooking(client, bookingId, { metadata: nextMeta });
}

export async function listVendorMarketplaceBookings(
  client: SupabaseClient<Database>,
): Promise<BookingRow[]> {
  const vendorId = await getMyVendorId(client);
  if (!vendorId) return [];
  const myVendor = await vendorApi.getMyVendor(client);
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .eq("status", "confirmed")
    .is("vendor_id", null)
    .contains("metadata", { marketplace: { floated: true } })
    .order("created_at", { ascending: true });
  const rows = takeRows(data, error);
  const keep: BookingRow[] = [];
  for (const row of rows) {
    if (readMarketplaceBroadcastFilter(row) === "customer_pin" && myVendor) {
      const sig = customerLocationSignalsFromServiceSiteAddress(
        row.service_site_address,
      );
      const hasSig = Boolean(
        sig.pincode?.trim() || sig.city?.trim() || sig.state?.trim(),
      );
      if (hasSig && !vendorCoversCustomerSignals(myVendor, sig)) continue;
    }
    if (await isVendorAvailableForBookingSlot(client, vendorId, row))
      keep.push(row);
  }
  return keep;
}

export async function vendorClaimMarketplaceBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingRow> {
  const booking = await getBookingById(client, bookingId);
  if (booking.vendor_id) {
    throw new SupabaseApiError("This booking is already assigned.");
  }
  if (booking.status !== "confirmed") {
    throw new SupabaseApiError("Only confirmed bookings can be claimed.");
  }
  const vid = await getMyVendorId(client);
  if (!vid) throw new SupabaseApiError("No vendor profile for this account.");
  const myVendor = await vendorApi.getMyVendor(client);
  if (readMarketplaceBroadcastFilter(booking) === "customer_pin" && myVendor) {
    const sig = customerLocationSignalsFromServiceSiteAddress(
      booking.service_site_address,
    );
    const hasSig = Boolean(
      sig.pincode?.trim() || sig.city?.trim() || sig.state?.trim(),
    );
    if (hasSig && !vendorCoversCustomerSignals(myVendor, sig)) {
      throw new SupabaseApiError(
        "This booking is outside your declared service area for the customer location.",
      );
    }
  }
  if (!(await isVendorAvailableForBookingSlot(client, vid, booking))) {
    throw new SupabaseApiError(
      "Your configured slot capacity is full for this booking window.",
    );
  }
  const m =
    booking.metadata &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, Json>)
      : {};
  const marketplace =
    m.marketplace &&
    typeof m.marketplace === "object" &&
    !Array.isArray(m.marketplace)
      ? (m.marketplace as Record<string, Json>)
      : {};
  const openUntil =
    typeof marketplace.open_until === "string" ? marketplace.open_until : null;
  if (openUntil && new Date() > new Date(openUntil)) {
    throw new SupabaseApiError("The one-hour acceptance window has closed.");
  }
  const nextMeta = mergeBookingMetadata(booking.metadata, {
    marketplace: {
      ...marketplace,
      awaiting_admin_float: false,
      claimed_by_vendor_id: vid,
      claimed_at: new Date().toISOString(),
    } as Json,
  });
  const { data, error } = await client
    .from("bookings")
    .update({
      vendor_id: vid,
      status: "confirmed",
      metadata: nextMeta,
    })
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .is("vendor_id", null)
    .select("*")
    .maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  if (!data)
    throw new SupabaseApiError(
      "This booking has already been claimed by another vendor.",
    );
  await emitMarketplaceNotificationEvents(client, {
    booking: data,
    eventType: "marketplace_claim_won",
    channels: ["in_app", "email"],
    recipientVendorId: vid,
    note: "You claimed this marketplace request.",
  });
  const vendorName = await resolveVendorDisplayName(client, vid);
  const copy = adminVendorClaimedCopy(data, vendorName);
  await emitAdminBookingNotification(client, {
    booking: data,
    eventType: "admin_booking_vendor_claimed",
    ...copy,
    vendorName,
  });
  return data;
}

function readBookingScheduleSlot(
  metadata: Json | null | undefined,
): { dayKey: string; slotId: string } | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return null;
  const slot = (metadata as Record<string, unknown>).schedule_slot;
  if (!slot || typeof slot !== "object" || Array.isArray(slot)) return null;
  const slotObj = slot as Record<string, unknown>;
  const dayRaw = slotObj.day_key;
  const slotRaw = slotObj.slot_id;
  const dayKey = typeof dayRaw === "string" ? dayRaw.trim() : "";
  const slotId = typeof slotRaw === "string" ? slotRaw.trim() : "";
  if (!dayKey || !slotId) return null;
  return { dayKey, slotId };
}

async function isVendorAvailableForBookingSlot(
  client: SupabaseClient<Database>,
  vendorId: string,
  booking: BookingRow,
): Promise<boolean> {
  const schedule = readBookingScheduleSlot(booking.metadata);
  if (!schedule) return true;
  const { dayKey, slotId } = schedule;
  const { data: row, error: rowErr } = await client
    .from("vendor_slot_availability")
    .select("is_available, capacity")
    .eq("vendor_id", vendorId)
    .eq("day_key", dayKey)
    .eq("slot_id", slotId)
    .maybeSingle();
  if (rowErr) throw new SupabaseApiError(rowErr.message, rowErr);
  if (row && !row.is_available) return false;
  const capacity = row?.capacity ?? 1;
  const { count, error: countErr } = await client
    .from("bookings")
    .select("id", { head: true, count: "exact" })
    .eq("vendor_id", vendorId)
    .in("status", ["confirmed", "accepted", "in_progress"])
    .contains("metadata", {
      schedule_slot: { day_key: dayKey, slot_id: slotId },
    });
  if (countErr) throw new SupabaseApiError(countErr.message, countErr);
  return (count ?? 0) < capacity;
}

async function enrichBookingsWithVendorTechnicianLabels(
  client: SupabaseClient<Database>,
  rows: BookingRow[],
): Promise<BookingMonitoringEnriched[]> {
  const vendorIds = [
    ...new Set(rows.map((r) => r.vendor_id).filter(Boolean)),
  ] as string[];
  const techIds = [
    ...new Set(rows.map((r) => r.technician_id).filter(Boolean)),
  ] as string[];

  const vendorLabelById = new Map<string, string>();
  if (vendorIds.length > 0) {
    const { data, error } = await client
      .from("vendors")
      .select("id, business_name, trade_name")
      .in("id", vendorIds);
    if (error) throw new SupabaseApiError(error.message, error);
    for (const v of data ?? []) {
      const label = v.trade_name
        ? `${v.business_name} (${v.trade_name})`
        : v.business_name;
      vendorLabelById.set(v.id, label);
    }
  }

  const technicianLabelById = new Map<string, string>();
  if (techIds.length > 0) {
    const { data: techs, error: techErr } = await client
      .from("technicians")
      .select("id, user_id")
      .in("id", techIds);
    if (techErr) throw new SupabaseApiError(techErr.message, techErr);

    const userIds = [...new Set((techs ?? []).map((t) => t.user_id))];
    const userLabelById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: users, error: userErr } = await client
        .from("users")
        .select("id, full_name, email")
        .in("id", userIds);
      if (userErr) throw new SupabaseApiError(userErr.message, userErr);
      for (const u of users ?? []) {
        const label =
          (typeof u.full_name === "string" && u.full_name.trim()) ||
          (typeof u.email === "string" && u.email.trim()) ||
          u.id.slice(0, 8);
        userLabelById.set(u.id, label);
      }
    }

    for (const t of techs ?? []) {
      technicianLabelById.set(
        t.id,
        userLabelById.get(t.user_id) ?? t.id.slice(0, 8),
      );
    }
  }

  return rows.map((row) => ({
    ...row,
    vendorDisplayName: row.vendor_id
      ? (vendorLabelById.get(row.vendor_id) ?? null)
      : null,
    technicianDisplayName: row.technician_id
      ? (technicianLabelById.get(row.technician_id) ?? null)
      : null,
  }));
}

/** Admin bookings screen: split one-off visits vs AMC (`subscription_id` set). */
export type AdminBookingsSubscriptionBucket = "one_time" | "amc";

export async function adminListBookingsBySubscriptionBucket(
  client: SupabaseClient<Database>,
  bucket: AdminBookingsSubscriptionBucket,
  options?: { limit?: number },
): Promise<BookingRow[]> {
  let q = client
    .from("bookings")
    .select("*")
    .order("scheduled_start", { ascending: false });
  if (bucket === "one_time") {
    q = q.is("subscription_id", null);
  } else {
    q = q.not("subscription_id", "is", null);
  }
  if (options?.limit != null) {
    q = q.limit(options.limit);
  }

  const { data, error } = await q;
  return takeRows(data, error);
}

export async function adminGetBookingsMonitoringBySubscriptionBucket(
  client: SupabaseClient<Database>,
  bucket: AdminBookingsSubscriptionBucket,
  options?: { limit?: number },
): Promise<BookingMonitoringEnriched[]> {
  const rows = await adminListBookingsBySubscriptionBucket(
    client,
    bucket,
    options,
  );
  return enrichBookingsWithVendorTechnicianLabels(client, rows);
}

export type AdminBookingsStatusFilter = BookingStatus | "all";

export async function adminListBookingsBySubscriptionBucketPaged(
  client: SupabaseClient<Database>,
  bucket: AdminBookingsSubscriptionBucket,
  params: PagedParams & { status?: AdminBookingsStatusFilter },
): Promise<PagedResult<BookingRow>> {
  const { from, to } = offsetRangeForPage(params.page, params.pageSize);
  let q = client
    .from("bookings")
    .select("*", { count: "exact" })
    .order("scheduled_start", { ascending: false });
  if (bucket === "one_time") {
    q = q.is("subscription_id", null);
  } else {
    q = q.not("subscription_id", "is", null);
  }
  if (params.status && params.status !== "all") {
    q = q.eq("status", params.status);
  }
  const { data, error, count } = await q.range(from, to);
  return { rows: takeRows(data, error), total: count ?? 0 };
}

export async function adminGetBookingsMonitoringBySubscriptionBucketPaged(
  client: SupabaseClient<Database>,
  bucket: AdminBookingsSubscriptionBucket,
  params: PagedParams & { status?: AdminBookingsStatusFilter },
): Promise<PagedResult<BookingMonitoringEnriched>> {
  const { rows, total } = await adminListBookingsBySubscriptionBucketPaged(
    client,
    bucket,
    params,
  );
  const enriched = await enrichBookingsWithVendorTechnicianLabels(client, rows);
  return { rows: enriched, total };
}

/** Filter for admin Booking routing activity table. */
export type AdminFallbackRoutingFilter =
  | "all"
  | "partner_fallback"
  | "marketplace";

const PARTNER_FALLBACK_ROUTING_REASONS = [
  "preferred_ineligible_customer_fallback",
  "preferred_ineligible_platform_default",
  "preferred_missing_customer_fallback",
  "preferred_missing_platform_default",
] as const;

const MARKETPLACE_ROUTING_REASONS = [
  "default_vendor_marketplace",
  "amc_awaiting_admin_marketplace",
] as const;

export async function adminListFallbackBookingsPaged(
  client: SupabaseClient<Database>,
  params: PagedParams & { routingFilter?: AdminFallbackRoutingFilter },
): Promise<PagedResult<BookingRow>> {
  const { from, to } = offsetRangeForPage(params.page, params.pageSize);
  const filter = params.routingFilter ?? "all";
  let q = client.from("bookings").select("*", { count: "exact" });

  if (filter === "marketplace") {
    q = q.in("metadata->vendor_routing->>reason", [
      ...MARKETPLACE_ROUTING_REASONS,
    ]);
  } else if (filter === "partner_fallback") {
    q = q.in("metadata->vendor_routing->>reason", [
      ...PARTNER_FALLBACK_ROUTING_REASONS,
    ]);
  } else {
    q = q.contains("metadata", { vendor_routing: { used_fallback: true } });
  }

  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .range(from, to);
  return { rows: takeRows(data, error), total: count ?? 0 };
}

/** Admin ops queue: hide visits whose scheduled window already ended. */
export type OpsExceptionsQueueFilter = "actionable" | "past_window" | "all";

export async function adminListOpsBookingExceptionsPaged(
  client: SupabaseClient<Database>,
  params: PagedParams & { filter?: OpsExceptionsQueueFilter },
): Promise<PagedResult<OpsBookingExceptionRow>> {
  const { from, to } = offsetRangeForPage(params.page, params.pageSize);
  const filter = params.filter ?? "actionable";
  const nowIso = new Date().toISOString();
  let q = client.from("ops_booking_exceptions").select("*", { count: "exact" });
  if (filter === "actionable") {
    q = q.gte("scheduled_end", nowIso);
  } else if (filter === "past_window") {
    q = q.lt("scheduled_end", nowIso);
  }
  const orderAsc = filter !== "past_window";
  const { data, error, count } = await q
    .order(orderAsc ? "scheduled_start" : "scheduled_end", {
      ascending: orderAsc,
    })
    .range(from, to);
  return { rows: takeRows(data, error), total: count ?? 0 };
}

/** Admin: filtered bookings with vendor + technician display names for dashboards. */
export async function adminGetBookingMonitoringRows(
  client: SupabaseClient<Database>,
  tab: AdminBookingMonitorTab,
  options?: { limit?: number },
): Promise<BookingMonitoringEnriched[]> {
  const rows = await adminListBookingsForMonitoring(client, tab, options);
  return enrichBookingsWithVendorTechnicianLabels(client, rows);
}

/**
 * Customer-initiated cancellation. No late fee until the visit is `accepted` with a technician assigned.
 * After that, the 1-hour grace window runs from vendor acceptance; then `acceptLateCancellationFee` is required.
 */
export async function customerCancelBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
  params: { reason: string; acceptLateCancellationFee?: boolean },
): Promise<BookingRow> {
  const trimmed = params.reason.trim();
  if (trimmed.length < 6) {
    throw new SupabaseApiError(
      "Please enter a cancellation reason (at least 6 characters).",
    );
  }
  if (trimmed.length > 2000) {
    throw new SupabaseApiError(
      "Cancellation reason is too long (max 2000 characters).",
    );
  }

  const booking = await getBookingById(client, bookingId);
  if (!["pending_payment", "confirmed", "accepted"].includes(booking.status)) {
    throw new SupabaseApiError(
      "This booking can no longer be cancelled from the app.",
    );
  }

  const grace = isWithinCustomerCancellationWindow(booking);
  let lateFeePaise = 0;
  if (!grace) {
    if (!params.acceptLateCancellationFee) {
      throw new SupabaseApiError(
        "Late cancellation requires acknowledgement - tap “Cancel anyway” after reviewing any applicable fee.",
      );
    }
    lateFeePaise = await fetchCustomerLateCancelFeePaise(client);
  }

  const { data: userData } = await client.auth.getUser();
  const uid = requireSessionUserId(userData.user?.id);
  const now = new Date().toISOString();

  const assessedAtIso = grace ? null : now;
  const custCancelMeta = {
    within_grace_window: grace,
    late_fee_paise: grace ? 0 : lateFeePaise,
    acknowledged_late_fee: grace ? false : true,
    assessed_at: assessedAtIso,
    cancelled_from: "customer_app",
  };

  const nextMeta = mergeBookingMetadata(booking.metadata, {
    customer_cancellation: custCancelMeta as unknown as Json,
  });

  return updateBooking(client, bookingId, {
    status: "cancelled",
    cancellation_reason: trimmed,
    cancelled_at: now,
    cancelled_by: uid,
    metadata: nextMeta,
  });
}

async function fetchCustomerLateCancelFeePaise(
  client: SupabaseClient<Database>,
): Promise<number> {
  const { data, error } = await client
    .from("platform_settings")
    .select("customer_late_cancel_fee_paise")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  const n = Number(data?.customer_late_cancel_fee_paise);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/**
 * Customer closed checkout before paying: cancels an unpaid `pending_payment` row without the
 * post-booking cancellation window (used when no payment succeeded yet).
 */
export async function customerAbandonUnpaidCheckoutBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingRow | null> {
  const booking = await getBookingById(client, bookingId);
  if (booking.status !== "pending_payment") {
    return null;
  }
  const { data: userData } = await client.auth.getUser();
  const uid = requireSessionUserId(userData.user?.id);
  const now = new Date().toISOString();
  return updateBooking(client, bookingId, {
    status: "cancelled",
    cancellation_reason: "Checkout closed before payment",
    cancelled_at: now,
    cancelled_by: uid,
  });
}

export async function customerRescheduleBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
  nextScheduledStart: string,
  nextScheduledEnd: string,
): Promise<BookingRow> {
  const booking = await getBookingById(client, bookingId);
  if (!["pending_payment", "confirmed", "accepted"].includes(booking.status)) {
    throw new SupabaseApiError(
      "This booking can no longer be rescheduled from the app.",
    );
  }

  const start = new Date(nextScheduledStart);
  const end = new Date(nextScheduledEnd);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new SupabaseApiError("Invalid schedule selected.");
  }
  if (end.getTime() <= start.getTime()) {
    throw new SupabaseApiError(
      "Rescheduled end time must be after start time.",
    );
  }
  if (start.getTime() <= Date.now()) {
    throw new SupabaseApiError("Please choose a future slot.");
  }

  const m =
    booking.metadata &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, Json>)
      : {};
  const existing =
    m.customer_reschedule &&
    typeof m.customer_reschedule === "object" &&
    !Array.isArray(m.customer_reschedule)
      ? (m.customer_reschedule as Record<string, Json>)
      : {};
  const nowIso = new Date().toISOString();
  const nextMeta = mergeBookingMetadata(booking.metadata, {
    customer_reschedule: {
      ...existing,
      previous_start: booking.scheduled_start,
      previous_end: booking.scheduled_end,
      requested_start: nextScheduledStart,
      requested_end: nextScheduledEnd,
      requested_at: nowIso,
    } as Json,
  });

  return updateBooking(client, bookingId, {
    scheduled_start: nextScheduledStart,
    scheduled_end: nextScheduledEnd,
    metadata: nextMeta,
  });
}

export async function customerRegenerateBookingHappyCode(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingRow> {
  const booking = await getBookingById(client, bookingId);
  if (!["accepted", "in_progress"].includes(booking.status)) {
    throw new SupabaseApiError(
      "Happy Code can only be regenerated for accepted or in-progress visits.",
    );
  }
  const otp = readBookingServiceOtpMeta(booking.metadata);
  if (!otp.startCode) {
    throw new SupabaseApiError(
      "Job Start Code is not initialized for this booking.",
    );
  }
  const nowMs = Date.now();
  const regenAtMs = otp.happyRegeneratedAt
    ? new Date(otp.happyRegeneratedAt).getTime()
    : 0;
  if (
    Number.isFinite(regenAtMs) &&
    regenAtMs > 0 &&
    nowMs - regenAtMs < HAPPY_CODE_REGENERATE_COOLDOWN_MS
  ) {
    const remSec = Math.ceil(
      (HAPPY_CODE_REGENERATE_COOLDOWN_MS - (nowMs - regenAtMs)) / 1000,
    );
    const remMin = Math.ceil(remSec / 60);
    throw new SupabaseApiError(
      remSec >= 60
        ? `Please wait about ${remMin} minute${remMin === 1 ? "" : "s"} before regenerating again.`
        : `Please wait ${remSec} seconds before regenerating again.`,
    );
  }
  const nowIso = new Date(nowMs).toISOString();
  const nextMeta = mergeBookingMetadata(booking.metadata, {
    service_otp: {
      start_code: otp.startCode,
      happy_code: allocateHappyCode(),
      generated_at: nowIso,
      start_verified_at: otp.startVerifiedAt,
      completed_with_happy_code_at: null,
      start_fail_count: otp.startFailCount,
      start_locked_until: otp.startLockedUntil,
      happy_fail_count: 0,
      happy_locked_until: null,
      happy_regenerated_at: nowIso,
      regenerated_by_customer: true,
    } as Json,
  });
  return updateBooking(client, bookingId, { metadata: nextMeta });
}
