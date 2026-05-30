import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRow, Database, Json, VendorSettlementRow } from "../database.types";
import {
  DEFAULT_VENDOR_PLATFORM_FEE_PERCENT,
  getVendorPlatformFeePercent,
} from "../platform/platform-settings-api";
import { emitVendorSettlementStatusNotification } from "../notifications/vendor-settlement-notifications";
import { SupabaseApiError, takeRows, takeSingleRow } from "../result";

function readPenaltyPaiseFromBookingMetadata(metadata: Json | null | undefined): number {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return 0;
  const row = (metadata as Record<string, unknown>).vendor_cancellation_penalty;
  if (!row || typeof row !== "object" || Array.isArray(row)) return 0;
  const penalty = (row as Record<string, unknown>).penalty_paise;
  return typeof penalty === "number" ? Math.max(0, Math.round(penalty)) : 0;
}

function readPenaltyTierFromBookingMetadata(metadata: Json | null | undefined): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const row = (metadata as Record<string, unknown>).vendor_cancellation_penalty;
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  return typeof (row as Record<string, unknown>).tier === "string" ? String((row as Record<string, unknown>).tier) : null;
}

/** @deprecated Use {@link DEFAULT_VENDOR_PLATFORM_FEE_PERCENT} or {@link getVendorPlatformFeePercent}. */
export const DEFAULT_PLATFORM_FEE_PERCENT = DEFAULT_VENDOR_PLATFORM_FEE_PERCENT;

export type VendorSettlementKind = "visit_payout" | "cancellation_penalty";
export type VendorSettlementStatus = "pending_review" | "approved" | "settled" | "waived";

export type VisitPayoutBreakdown = {
  grossPaise: number;
  platformFeePaise: number;
  netPayoutPaise: number;
  platformFeePercent: number;
};

export function bookingVisitValuePaise(booking: Pick<BookingRow, "final_price_cents" | "estimated_price_cents">): number {
  return Math.max(0, booking.final_price_cents ?? booking.estimated_price_cents ?? 0);
}

export function computeVisitPayoutBreakdown(
  grossPaise: number,
  platformFeePercent = DEFAULT_VENDOR_PLATFORM_FEE_PERCENT,
): VisitPayoutBreakdown {
  const gross = Math.max(0, Math.round(grossPaise));
  const platformFeePaise = Math.round(gross * (platformFeePercent / 100));
  const netPayoutPaise = Math.max(0, gross - platformFeePaise);
  return {
    grossPaise: gross,
    platformFeePaise,
    netPayoutPaise,
    platformFeePercent,
  };
}

export function formatInrFromPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export async function ensureVisitPayoutSettlement(
  client: SupabaseClient<Database>,
  booking: Pick<
    BookingRow,
    "id" | "vendor_id" | "status" | "reference_code" | "currency" | "final_price_cents" | "estimated_price_cents"
  >,
): Promise<VendorSettlementRow | null> {
  if (booking.status !== "completed" || !booking.vendor_id) return null;

  const { data: existing } = await client
    .from("vendor_settlements")
    .select("id")
    .eq("booking_id", booking.id)
    .eq("kind", "visit_payout")
    .maybeSingle();
  if (existing?.id) {
    const { data } = await client.from("vendor_settlements").select("*").eq("id", existing.id).single();
    return data as VendorSettlementRow;
  }

  const feePercent = await getVendorPlatformFeePercent(client);
  const breakdown = computeVisitPayoutBreakdown(bookingVisitValuePaise(booking), feePercent);
  const row: Database["public"]["Tables"]["vendor_settlements"]["Insert"] = {
    booking_id: booking.id,
    vendor_id: booking.vendor_id,
    kind: "visit_payout",
    status: "pending_review",
    currency: booking.currency ?? "INR",
    reference_code: booking.reference_code,
    visit_gross_paise: breakdown.grossPaise,
    platform_fee_paise: breakdown.platformFeePaise,
    net_payout_paise: breakdown.netPayoutPaise,
    metadata: {
      platform_fee_percent: breakdown.platformFeePercent,
      auto_created: true,
      source: "visit_completed",
    } as Json,
  };

  const { data, error } = await client.from("vendor_settlements").insert(row).select("*").single();
  if (error) throw new SupabaseApiError(error.message, error);
  return data as VendorSettlementRow;
}

export async function ensureCancellationPenaltySettlement(
  client: SupabaseClient<Database>,
  booking: Pick<BookingRow, "id" | "vendor_id" | "reference_code" | "currency" | "metadata">,
  vendorId: string,
): Promise<VendorSettlementRow | null> {
  const penaltyPaise = readPenaltyPaiseFromBookingMetadata(booking.metadata);
  if (penaltyPaise <= 0) return null;

  const { data: existing } = await client
    .from("vendor_settlements")
    .select("id")
    .eq("booking_id", booking.id)
    .eq("kind", "cancellation_penalty")
    .maybeSingle();
  if (existing?.id) {
    const { data } = await client.from("vendor_settlements").select("*").eq("id", existing.id).single();
    return data as VendorSettlementRow;
  }

  const row: Database["public"]["Tables"]["vendor_settlements"]["Insert"] = {
    booking_id: booking.id,
    vendor_id: vendorId,
    kind: "cancellation_penalty",
    status: "pending_review",
    currency: booking.currency ?? "INR",
    reference_code: booking.reference_code,
    penalty_assessed_paise: penaltyPaise,
    penalty_final_paise: penaltyPaise,
    metadata: {
      auto_created: true,
      source: "vendor_cancel_accepted",
      penalty_tier: readPenaltyTierFromBookingMetadata(booking.metadata),
    } as Json,
  };

  const { data, error } = await client.from("vendor_settlements").insert(row).select("*").single();
  if (error) throw new SupabaseApiError(error.message, error);
  return data as VendorSettlementRow;
}

export async function adminListVendorSettlements(
  client: SupabaseClient<Database>,
  filters?: {
    kind?: VendorSettlementKind;
    status?: VendorSettlementStatus;
    vendorId?: string;
    limit?: number;
  },
): Promise<VendorSettlementRow[]> {
  const limit = Math.min(500, Math.max(1, filters?.limit ?? 200));
  let q = client.from("vendor_settlements").select("*").order("created_at", { ascending: false }).limit(limit);
  if (filters?.kind) q = q.eq("kind", filters.kind);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.vendorId) q = q.eq("vendor_id", filters.vendorId);
  const { data, error } = await q;
  return takeRows(data, error) as VendorSettlementRow[];
}

export async function vendorListMySettlements(
  client: SupabaseClient<Database>,
  filters?: { kind?: VendorSettlementKind; status?: VendorSettlementStatus; limit?: number },
): Promise<VendorSettlementRow[]> {
  const limit = Math.min(300, Math.max(1, filters?.limit ?? 150));
  let q = client.from("vendor_settlements").select("*").order("created_at", { ascending: false }).limit(limit);
  if (filters?.kind) q = q.eq("kind", filters.kind);
  if (filters?.status) q = q.eq("status", filters.status);
  const { data, error } = await q;
  return takeRows(data, error) as VendorSettlementRow[];
}

export type AdminUpdateVendorSettlementInput = {
  status?: VendorSettlementStatus;
  penaltyFinalPaise?: number;
  adminNotes?: string | null;
};

export async function adminUpdateVendorSettlement(
  client: SupabaseClient<Database>,
  settlementId: string,
  input: AdminUpdateVendorSettlementInput,
): Promise<VendorSettlementRow> {
  const { data: existing, error: fetchErr } = await client
    .from("vendor_settlements")
    .select("*")
    .eq("id", settlementId)
    .single();
  if (fetchErr) throw new SupabaseApiError(fetchErr.message, fetchErr);
  const row = existing as VendorSettlementRow;

  const { data: userData } = await client.auth.getUser();
  const adminUserId = userData.user?.id ?? null;
  const now = new Date().toISOString();

  const patch: Database["public"]["Tables"]["vendor_settlements"]["Update"] = {};

  if (input.adminNotes !== undefined) {
    patch.admin_notes = input.adminNotes?.trim() ? input.adminNotes.trim() : null;
  }

  if (row.kind === "cancellation_penalty" && input.penaltyFinalPaise !== undefined) {
    const amount = Math.max(0, Math.round(input.penaltyFinalPaise));
    patch.penalty_final_paise = amount;
  }

  if (input.status) {
    patch.status = input.status;
    if (input.status === "approved" && row.status === "pending_review") {
      patch.approved_at = now;
      patch.approved_by = adminUserId;
    }
    if (input.status === "settled") {
      patch.settled_at = now;
      patch.settled_by = adminUserId;
      if (!row.approved_at) {
        patch.approved_at = now;
        patch.approved_by = adminUserId;
      }
    }
    if (input.status === "waived" && row.kind !== "cancellation_penalty") {
      throw new SupabaseApiError("Only cancellation penalties can be waived.");
    }
  }

  const { data, error } = await client
    .from("vendor_settlements")
    .update(patch)
    .eq("id", settlementId)
    .select("*")
    .single();
  const updated = takeSingleRow(data, error) as VendorSettlementRow;

  if (input.status && input.status !== row.status) {
    try {
      await emitVendorSettlementStatusNotification(client, row, updated);
    } catch {
      // Do not block admin settlement updates if notification insert fails.
    }
  }

  return updated;
}

/**
 * Idempotently creates visit_payout rows for the vendor's completed bookings (vendor RLS insert).
 * Use when technician finalize did not create a ledger row (e.g. pre-migration visits).
 */
export async function vendorSyncCompletedVisitPayoutSettlements(
  client: SupabaseClient<Database>,
  options?: { limit?: number },
): Promise<{ created: number; skipped: number }> {
  const limit = Math.min(500, Math.max(1, options?.limit ?? 200));
  const { data: bookings, error } = await client
    .from("bookings")
    .select("id, vendor_id, status, reference_code, currency, final_price_cents, estimated_price_cents")
    .eq("status", "completed")
    .not("vendor_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new SupabaseApiError(error.message, error);

  let created = 0;
  let skipped = 0;
  for (const b of bookings ?? []) {
    const row = await ensureVisitPayoutSettlement(client, b as BookingRow);
    if (row) created += 1;
    else skipped += 1;
  }
  return { created, skipped };
}

/** Create payout rows for completed visits that pre-date the ledger (admin maintenance). */
export async function adminBackfillVisitPayoutSettlements(
  client: SupabaseClient<Database>,
  limit = 100,
): Promise<{ created: number; skipped: number }> {
  const { data: bookings, error } = await client
    .from("bookings")
    .select("id, vendor_id, status, reference_code, currency, final_price_cents, estimated_price_cents")
    .eq("status", "completed")
    .not("vendor_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(Math.min(500, Math.max(1, limit)));

  if (error) throw new SupabaseApiError(error.message, error);
  let created = 0;
  let skipped = 0;
  for (const b of bookings ?? []) {
    const before = await client
      .from("vendor_settlements")
      .select("id")
      .eq("booking_id", b.id)
      .eq("kind", "visit_payout")
      .maybeSingle();
    if (before.data?.id) {
      skipped += 1;
      continue;
    }
    const row = await ensureVisitPayoutSettlement(client, b as BookingRow);
    if (row) created += 1;
    else skipped += 1;
  }
  return { created, skipped };
}

export function settlementDisplayAmountPaise(row: VendorSettlementRow): number {
  if (row.kind === "visit_payout") {
    return row.net_payout_paise ?? 0;
  }
  return row.penalty_final_paise ?? row.penalty_assessed_paise ?? 0;
}

export function settlementKindLabel(kind: VendorSettlementKind): string {
  return kind === "visit_payout" ? "Visit payout" : "Cancellation penalty";
}

export function settlementStatusLabel(status: VendorSettlementStatus): string {
  switch (status) {
    case "pending_review":
      return "Pending review";
    case "approved":
      return "Approved";
    case "settled":
      return "Settled";
    case "waived":
      return "Waived";
    default:
      return status;
  }
}
