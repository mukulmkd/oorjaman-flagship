import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BookingStatus,
  Database,
  Json,
  SubscriptionStatus,
  SubscriptionVisitSlotStatus,
} from "../database.types";
import { SupabaseApiError } from "../result";
import { scheduleAmcVisitSlot } from "../subscriptions/amc-visit-slots";

type Client = SupabaseClient<Database>;

/** Operational situation for one AMC contract. Each contract is in exactly one. */
export type AmcDeskSituation =
  | "payment_pending"
  | "paid_no_booking"
  | "visit_open"
  | "next_visit_due"
  | "paused"
  | "past_due"
  | "cancelled"
  | "expired"
  | "complete";

export type AmcDeskRow = {
  subscriptionId: string;
  situation: AmcDeskSituation;
  planName: string;
  status: SubscriptionStatus;
  amountCents: number;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  state: string | null;
  city: string | null;
  site: string | null;
  vendorName: string | null;
  assignedVendorId: string | null;
  /** Next unused visit slot. Present when ops can schedule. */
  nextSlotId: string | null;
  visitsIncluded: number | null;
  visitsCompleted: number;
  openBookingReference: string | null;
  openBookingStatus: BookingStatus | null;
  nextSlotAt: string | null;
  nextSlotOverdue: boolean;
  startsAt: string;
  endsAt: string;
};

const OPEN_BOOKING_STATUSES = new Set<BookingStatus>([
  "pending_payment",
  "confirmed",
  "vendor_acknowledged",
  "accepted",
  "in_progress",
]);

type SiteBits = { state: string | null; city: string | null; formatted: string | null };

function textField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readAddress(raw: unknown): SiteBits {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { state: null, city: null, formatted: null };
  }
  const site = raw as Record<string, unknown>;
  return {
    state: textField(site.state),
    city: textField(site.city),
    formatted: textField(site.formatted),
  };
}

function readSubscriptionSite(metadata: Json): SiteBits {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { state: null, city: null, formatted: null };
  }
  return readAddress((metadata as Record<string, unknown>).service_site_address);
}

function sameState(left: string | null, right: string): boolean {
  return (left ?? "").trim().toLowerCase() === right.trim().toLowerCase();
}

export function classifyAmcDeskSituation(input: {
  status: SubscriptionStatus;
  visitsIncluded: number | null;
  bookings: { status: BookingStatus }[];
  slots: { status: SubscriptionVisitSlotStatus; bookingId: string | null }[];
}): AmcDeskSituation {
  if (input.status === "cancelled") return "cancelled";
  if (input.status === "expired") return "expired";
  if (input.status === "paused") return "paused";
  if (input.status === "past_due") return "past_due";
  if (input.status === "trialing") return "payment_pending";

  const live = input.bookings.filter((booking) => OPEN_BOOKING_STATUSES.has(booking.status));
  const completed = input.bookings.filter((booking) => booking.status === "completed");
  if (live.length > 0) return "visit_open";
  if (completed.length === 0) return "paid_no_booking";

  const included = input.visitsIncluded ?? input.slots.length;
  const unbooked = input.slots.some(
    (slot) => !slot.bookingId && slot.status !== "completed" && slot.status !== "cancelled",
  );
  if (unbooked || (included > 0 && completed.length < included)) return "next_visit_due";
  return "complete";
}

export async function adminListAmcDesk(
  client: Client,
  options?: { stateNames?: string[] },
): Promise<AmcDeskRow[]> {
  const stateNames = options?.stateNames?.map((name) => name.trim()).filter(Boolean);
  if (stateNames && stateNames.length === 0) return [];

  const { data: subs, error: subError } = await client
    .from("subscriptions")
    .select(
      "id, plan_name, status, amount_cents, visits_included, customer_id, assigned_vendor_id, metadata, starts_at, ends_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (subError) throw new SupabaseApiError(subError.message, subError);
  const subscriptions = subs ?? [];
  if (subscriptions.length === 0) return [];

  const subscriptionIds = subscriptions.map((row) => row.id);
  const customerIds = [...new Set(subscriptions.map((row) => row.customer_id))];
  const vendorIds = [
    ...new Set(subscriptions.map((row) => row.assigned_vendor_id).filter((id): id is string => Boolean(id))),
  ];

  const [customersRes, bookingsRes, slotsRes, vendorsRes] = await Promise.all([
    client
      .from("customers")
      .select("id, display_name, alternate_phone, contact_email, user_id, service_default_address")
      .in("id", customerIds),
    client
      .from("bookings")
      .select("id, subscription_id, status, reference_code, scheduled_start")
      .in("subscription_id", subscriptionIds),
    client
      .from("subscription_visit_slots")
      .select("id, subscription_id, sequence, status, booking_id, ideal_scheduled_start")
      .in("subscription_id", subscriptionIds),
    vendorIds.length > 0
      ? client.from("vendors").select("id, business_name, trade_name").in("id", vendorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (customersRes.error) throw new SupabaseApiError(customersRes.error.message, customersRes.error);
  if (bookingsRes.error) throw new SupabaseApiError(bookingsRes.error.message, bookingsRes.error);
  if (slotsRes.error) throw new SupabaseApiError(slotsRes.error.message, slotsRes.error);
  if (vendorsRes.error) throw new SupabaseApiError(vendorsRes.error.message, vendorsRes.error);

  const userIds = [...new Set((customersRes.data ?? []).map((row) => row.user_id).filter(Boolean))];
  const usersRes =
    userIds.length > 0
      ? await client.from("users").select("id, full_name, email, phone").in("id", userIds)
      : { data: [], error: null };
  if (usersRes.error) throw new SupabaseApiError(usersRes.error.message, usersRes.error);

  const customerById = new Map((customersRes.data ?? []).map((row) => [row.id, row]));
  const userById = new Map((usersRes.data ?? []).map((row) => [row.id, row]));
  const vendorById = new Map((vendorsRes.data ?? []).map((row) => [row.id, row]));
  const bookingsBySub = new Map<string, NonNullable<typeof bookingsRes.data>>();
  for (const booking of bookingsRes.data ?? []) {
    if (!booking.subscription_id) continue;
    const list = bookingsBySub.get(booking.subscription_id) ?? [];
    list.push(booking);
    bookingsBySub.set(booking.subscription_id, list);
  }
  const slotsBySub = new Map<string, NonNullable<typeof slotsRes.data>>();
  for (const slot of slotsRes.data ?? []) {
    const list = slotsBySub.get(slot.subscription_id) ?? [];
    list.push(slot);
    slotsBySub.set(slot.subscription_id, list);
  }

  const now = Date.now();
  const rows: AmcDeskRow[] = [];

  for (const sub of subscriptions) {
    const site = readSubscriptionSite(sub.metadata);
    const customer = customerById.get(sub.customer_id);
    const customerAddress = readAddress(customer?.service_default_address);
    const state = site.state ?? customerAddress.state;
    if (stateNames && !stateNames.some((name) => sameState(state, name))) continue;

    const user = customer ? userById.get(customer.user_id) : undefined;
    const vendor = sub.assigned_vendor_id ? vendorById.get(sub.assigned_vendor_id) : undefined;
    const bookings = bookingsBySub.get(sub.id) ?? [];
    const slots = [...(slotsBySub.get(sub.id) ?? [])].sort((a, b) => a.sequence - b.sequence);
    const situation = classifyAmcDeskSituation({
      status: sub.status,
      visitsIncluded: sub.visits_included,
      bookings,
      slots: slots.map((slot) => ({ status: slot.status, bookingId: slot.booking_id })),
    });
    const openBooking = bookings
      .filter((booking) => OPEN_BOOKING_STATUSES.has(booking.status))
      .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))[0];
    const nextSlot = slots.find(
      (slot) => !slot.booking_id && slot.status !== "completed" && slot.status !== "cancelled",
    );
    const nextSlotAt = nextSlot?.ideal_scheduled_start ?? null;

    rows.push({
      subscriptionId: sub.id,
      situation,
      planName: sub.plan_name,
      status: sub.status,
      amountCents: sub.amount_cents,
      customerName: customer?.display_name?.trim() || user?.full_name?.trim() || "Customer",
      customerPhone: customer?.alternate_phone?.trim() || user?.phone?.trim() || null,
      customerEmail: customer?.contact_email?.trim() || user?.email?.trim() || null,
      state,
      city: site.city ?? customerAddress.city,
      site: site.formatted,
      vendorName: vendor?.trade_name?.trim() || vendor?.business_name?.trim() || null,
      assignedVendorId: sub.assigned_vendor_id,
      nextSlotId: nextSlot?.id ?? null,
      visitsIncluded: sub.visits_included,
      visitsCompleted: bookings.filter((booking) => booking.status === "completed").length,
      openBookingReference: openBooking?.reference_code ?? null,
      openBookingStatus: openBooking?.status ?? null,
      nextSlotAt,
      nextSlotOverdue: Boolean(nextSlotAt && new Date(nextSlotAt).getTime() < now),
      startsAt: sub.starts_at,
      endsAt: sub.ends_at,
    });
  }

  const priority: Record<AmcDeskSituation, number> = {
    payment_pending: 0,
    paid_no_booking: 1,
    next_visit_due: 2,
    past_due: 3,
    visit_open: 4,
    paused: 5,
    complete: 6,
    expired: 7,
    cancelled: 8,
  };
  rows.sort((a, b) => priority[a.situation] - priority[b.situation] || a.customerName.localeCompare(b.customerName));
  return rows;
}

/** National admin or state desk: book the next unused visit on a paid AMC. */
export async function adminScheduleAmcVisit(
  client: Client,
  input: {
    slotId: string;
    scheduledStart: string;
    scheduledEnd: string;
    scheduleSlotMeta: Json;
    siteAddressText: string;
  },
) {
  return scheduleAmcVisitSlot(client, {
    slotId: input.slotId,
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
    scheduleSlotMeta: input.scheduleSlotMeta,
    siteAddressText: input.siteAddressText,
    scheduledBy: "operations",
    vendorPick: { mode: "any" },
  });
}
