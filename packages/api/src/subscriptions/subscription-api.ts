import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, SubscriptionRow, SubscriptionStatus } from "../database.types";
import { isDummyAuthEmail } from "../auth/auth-api";
import { getMyCustomer } from "../customers/customer-api";
import { SupabaseApiError, takeRows, takeSingleRow } from "../result";
import { computeContractEndsAtIso } from "./amc-presets";
import { getServiceAddressEntry, buildServiceSiteAddressFromEntry } from "../customers/service-address-book";
import { getPricingAmcPlanByCode } from "../pricing/capacity-pricing-api";
import { resolveGeoPricingTierAddons } from "../pricing/pricing-api";
import { normalizeCountryCode } from "../pricing/pricing-engine";
import { getCustomerSolarSizing } from "../customers/customer-solar-sizing";
import { syncAmcVisitSlotsForSubscription } from "./amc-visit-slots";
import { serviceAddressCityKeyFromJson } from "../bookings/customer-booking-payload";
import { getActiveSubscriptionForAddress } from "./subscription-address";

export {
  bookingMatchesSubscriptionAddress,
  getActiveSubscriptionForAddress,
  isSubscriptionActive,
  readSubscriptionServiceAddressId,
  subscriptionAddressLabel,
} from "./subscription-address";

export { computeAmcVisitSlots } from "./amc-booking-generation";
export {
  getAmcVisitSlotById,
  listAmcVisitSlotsForSubscription,
  scheduleAmcVisitSlot,
  syncAmcVisitSlotsForSubscription,
  type ScheduleAmcVisitSlotInput,
} from "./amc-visit-slots";
export {
  AMC_CAPACITY_CHANGE_DISCLAIMER,
  customerCapacityTierWillChangeAmc,
  readSubscriptionCapacityTierCode,
  realignActiveAmcSubscriptionsForCustomerCapacity,
  type AmcTierRealignmentSummary,
} from "./amc-tier-realignment";
export { AMC_PLAN_UPGRADE_DISCLAIMER, upgradeAmcSubscriptionAsCustomer } from "./amc-plan-upgrade";

export type { AmcPlanFromCatalog, AmcSelectablePeriod } from "./amc-presets";
export {
  AMC_CONTRACT_MONTHS_DEFAULT,
  amcPlanFromCatalogRow,
  computeContractEndsAtIso,
  formatInrFromCents,
} from "./amc-presets";

export type CreateSubscriptionInput = Pick<
  Database["public"]["Tables"]["subscriptions"]["Insert"],
  | "customer_id"
  | "service_address_id"
  | "plan_code"
  | "plan_name"
  | "billing_period"
  | "starts_at"
  | "ends_at"
  | "visits_included"
  | "amount_cents"
  | "currency"
  | "external_provider"
  | "external_subscription_id"
  | "metadata"
> & {
  status?: SubscriptionStatus;
};

/**
 * List subscriptions visible to the current user (typically the owning customer; RLS).
 */
export async function listVisibleSubscriptions(
  client: SupabaseClient<Database>,
  options?: { status?: SubscriptionStatus | SubscriptionStatus[]; limit?: number },
): Promise<SubscriptionRow[]> {
  let q = client.from("subscriptions").select("*").order("starts_at", { ascending: false });

  if (options?.status) {
    const st = Array.isArray(options.status) ? options.status : [options.status];
    q = q.in("status", st);
  }
  if (options?.limit != null) {
    q = q.limit(options.limit);
  }

  const { data, error } = await q;
  return takeRows(data, error);
}

export async function getSubscriptionById(
  client: SupabaseClient<Database>,
  subscriptionId: string,
): Promise<SubscriptionRow> {
  const { data, error } = await client
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .single();

  return takeSingleRow(data, error);
}

/**
 * Customer AMC signup: creates subscription row and ideal-date visit placeholders (no booking IDs until scheduled).
 *
 * **Forward-only policy:** existing one-time bookings stay on their original payment and are never merged into AMC.
 * AMC visits are scheduled separately from the subscription screen when the customer is ready.
 */
export async function createAmcSubscriptionAsCustomer(
  client: SupabaseClient<Database>,
  input: {
    /** Admin catalog plan code (e.g. `amc_kw5_y1_3`). */
    plan_code: string;
    /** Saved address book entry id (`customers.metadata.service_addresses[].id`). */
    service_address_id: string;
    starts_at?: string;
    preferred_vendor_id?: string | null;
  },
): Promise<SubscriptionRow> {
  const customer = await getMyCustomer(client);
  if (!customer) {
    throw new SupabaseApiError("Customer profile required - sign in again.");
  }

  const addressId = input.service_address_id.trim();
  if (!addressId) {
    throw new SupabaseApiError("Choose a saved service address for this AMC.");
  }

  const addressEntry = getServiceAddressEntry(customer, addressId);
  if (!addressEntry) {
    throw new SupabaseApiError("That saved address was not found. Refresh Profile and try again.");
  }

  const existing = await listVisibleSubscriptions(client, { status: ["active", "trialing"] });
  if (getActiveSubscriptionForAddress(existing, addressId)) {
    throw new SupabaseApiError("This address already has an active AMC plan.");
  }

  const sizing = getCustomerSolarSizing(customer);
  if (!sizing.ready) {
    if (sizing.reason === "missing_details") {
      throw new SupabaseApiError(
        "Add installed capacity (kW) and panel count in Profile, then save, before subscribing to AMC.",
      );
    }
    throw new SupabaseApiError(
      `Your saved system size (${sizing.capacityKw} kW) is not in our service bands. Update Profile to 3, 4, 5, 6, 8, or 10 kW.`,
    );
  }

  const catalogPlan = await getPricingAmcPlanByCode(client, input.plan_code.trim());
  if (catalogPlan.capacity_tier_code !== sizing.tierCode) {
    throw new SupabaseApiError("This AMC plan does not match your system size in Profile.");
  }

  const addressCityKey = serviceAddressCityKeyFromJson(addressEntry.address ?? null);
  const geoAddons = await resolveGeoPricingTierAddons(client, {
    countryCode: normalizeCountryCode("IN"),
    cityKey: addressCityKey,
  });
  const geoAmcAddonCents = Math.max(0, geoAddons.amc_addon_cents);
  const billedAmountCents = catalogPlan.amount_cents + geoAmcAddonCents;

  const serviceSiteAddress = buildServiceSiteAddressFromEntry(addressEntry);
  const startsAt = input.starts_at ?? new Date().toISOString();
  const endsAt = computeContractEndsAtIso(startsAt, catalogPlan.contract_months);

  const preferredVendorId =
    input.preferred_vendor_id?.trim() ||
    addressEntry.preferred_vendor_ids?.[0]?.trim() ||
    null;

  const metadata = {
    service_address_id: addressId,
    service_site_address: serviceSiteAddress,
    capacity_tier_code: sizing.tierCode,
    contract_months: catalogPlan.contract_months,
    ...(preferredVendorId ? { preferred_vendor_id: preferredVendorId } : {}),
    ...(geoAmcAddonCents > 0 || geoAddons.matched_tier_code
      ? {
          geo_amc_addon_cents: geoAmcAddonCents,
          geo_amc_addon_tier_code: geoAddons.matched_tier_code,
          geo_amc_addon_tier_label: geoAddons.matched_tier_label,
        }
      : {}),
  } as Json;

  const row = await createSubscription(client, {
    customer_id: customer.id,
    service_address_id: addressId,
    plan_code: catalogPlan.plan_code,
    plan_name: catalogPlan.plan_name,
    billing_period: catalogPlan.billing_period,
    starts_at: startsAt,
    ends_at: endsAt,
    visits_included: catalogPlan.visits_included,
    amount_cents: billedAmountCents,
    currency: "INR",
    metadata,
    status: "active",
  });

  await syncAmcVisitSlotsForSubscription(client, row);
  return row;
}

export async function createSubscription(
  client: SupabaseClient<Database>,
  input: CreateSubscriptionInput,
): Promise<SubscriptionRow> {
  const { data, error } = await client
    .from("subscriptions")
    .insert({
      customer_id: input.customer_id,
      service_address_id: input.service_address_id ?? null,
      plan_code: input.plan_code,
      plan_name: input.plan_name,
      billing_period: input.billing_period ?? "annual",
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      visits_included: input.visits_included ?? null,
      amount_cents: input.amount_cents ?? 0,
      currency: input.currency ?? "INR",
      external_provider: input.external_provider ?? null,
      external_subscription_id: input.external_subscription_id ?? null,
      metadata: input.metadata ?? {},
      status: input.status ?? "active",
    })
    .select()
    .single();

  return takeSingleRow(data, error);
}

export type SubscriptionPatch = Partial<
  Pick<
    SubscriptionRow,
    | "status"
    | "renewal_reminder_at"
    | "cancelled_at"
    | "cancelled_reason"
    | "metadata"
    | "visits_included"
    | "visits_used"
  >
>;

export async function updateSubscription(
  client: SupabaseClient<Database>,
  subscriptionId: string,
  patch: SubscriptionPatch,
): Promise<SubscriptionRow> {
  const { data, error } = await client
    .from("subscriptions")
    .update(patch)
    .eq("id", subscriptionId)
    .select()
    .single();

  return takeSingleRow(data, error);
}

/** Soft-cancel AMC record */
export async function cancelSubscription(
  client: SupabaseClient<Database>,
  subscriptionId: string,
  reason?: string,
): Promise<SubscriptionRow> {
  const now = new Date().toISOString();
  return updateSubscription(client, subscriptionId, {
    status: "cancelled",
    cancelled_at: now,
    cancelled_reason: reason ?? null,
  });
}

/**
 * Increment visits_used after a completed booking tied to this AMC (optimistic client-side bump).
 * For concurrency-sensitive billing, replace with an RPC transaction.
 */
export async function incrementSubscriptionVisitUsed(
  client: SupabaseClient<Database>,
  subscriptionId: string,
): Promise<SubscriptionRow> {
  const current = await getSubscriptionById(client, subscriptionId);
  const cap = current.visits_included;
  const next = current.visits_used + 1;
  if (cap != null && next > cap) {
    throw new Error("AMC visit quota exceeded");
  }

  const { data, error } = await client
    .from("subscriptions")
    .update({ visits_used: next })
    .eq("id", subscriptionId)
    .select()
    .single();

  return takeSingleRow(data, error);
}

/**
 * Historically linked a prepaid one-off visit to AMC. **Disabled:** product policy is forward-only —
 * paid one-time visits finish as booked; AMC schedules separate visits across the contract.
 *
 * Kept exported so callers get a deliberate error rather than silently doing nothing.
 */
export async function customerConvertUpcomingBookingToAmc(
  _client: SupabaseClient<Database>,
  _input: { bookingId: string; subscriptionId: string },
): Promise<void> {
  throw new SupabaseApiError(
    "One-time visits are not linked to AMC. Complete each paid visit as booked — your AMC covers separate future cleans on this calendar.",
  );
}

export type RenewalNudgeChannel = "email" | "sms" | "whatsapp";

export type SubscriptionRenewalNudgeCandidate = {
  subscription_id: string;
  customer_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  plan_name: string;
  ends_at: string;
  days_to_expiry: number;
};

export async function adminListSubscriptionRenewalNudgeCandidates(
  client: SupabaseClient<Database>,
  options?: { daysAhead?: number; limit?: number },
): Promise<SubscriptionRenewalNudgeCandidate[]> {
  const daysAhead = Math.max(1, Math.min(60, Math.round(Number(options?.daysAhead ?? 14))));
  const limit = Math.max(1, Math.min(500, Math.round(Number(options?.limit ?? 200))));
  const upperIso = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  const { data: subs, error: subErr } = await client
    .from("subscriptions")
    .select("id, customer_id, plan_name, ends_at, status")
    .in("status", ["active", "trialing"])
    .gte("ends_at", new Date().toISOString())
    .lte("ends_at", upperIso)
    .order("ends_at", { ascending: true })
    .limit(limit);
  if (subErr) throw new SupabaseApiError(subErr.message, subErr);
  const rows = subs ?? [];
  if (rows.length === 0) return [];

  const customerIds = [...new Set(rows.map((r) => r.customer_id))];
  const { data: customers, error: custErr } = await client
    .from("customers")
    .select("id, user_id, display_name, contact_email")
    .in("id", customerIds);
  if (custErr) throw new SupabaseApiError(custErr.message, custErr);
  const customerById = new Map((customers ?? []).map((c) => [c.id, c] as const));

  const userIds = [...new Set((customers ?? []).map((c) => c.user_id))];
  const { data: users, error: userErr } = await client
    .from("users")
    .select("id, email, phone")
    .in("id", userIds);
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const userById = new Map((users ?? []).map((u) => [u.id, u] as const));

  return rows.map((s) => {
    const c = customerById.get(s.customer_id);
    const u = c ? userById.get(c.user_id) : null;
    const days = Math.max(
      0,
      Math.ceil((new Date(s.ends_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    );
    return {
      subscription_id: s.id,
      customer_id: s.customer_id,
      customer_name: c?.display_name ?? null,
      customer_email:
        c?.contact_email ??
        (u?.email && !isDummyAuthEmail(u.email) ? u.email : null),
      customer_phone: u?.phone ?? null,
      plan_name: s.plan_name,
      ends_at: s.ends_at,
      days_to_expiry: days,
    };
  });
}

export async function adminQueueSubscriptionRenewalNudges(
  client: SupabaseClient<Database>,
  input: {
    subscriptionIds: string[];
    channels: RenewalNudgeChannel[];
    daysAhead?: number;
    cooldownDays?: number;
  },
): Promise<number> {
  const channels = [...new Set(input.channels)].filter(Boolean);
  if (channels.length === 0) throw new SupabaseApiError("Select at least one channel.");
  const idSet = new Set(input.subscriptionIds.map((x) => x.trim()).filter(Boolean));
  if (idSet.size === 0) return 0;
  const candidates = await adminListSubscriptionRenewalNudgeCandidates(client, {
    daysAhead: input.daysAhead ?? 14,
    limit: 500,
  });
  const selected = candidates.filter((c) => idSet.has(c.subscription_id));
  if (selected.length === 0) return 0;
  const cooldownDays = Math.max(0, Math.min(30, Math.round(Number(input.cooldownDays ?? 3))));
  const cutoffIso = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRows, error: recentErr } = await client
    .from("notification_events")
    .select("payload, created_at")
    .eq("event_type", "subscription_renewal_nudge")
    .gte("created_at", cutoffIso);
  if (recentErr) throw new SupabaseApiError(recentErr.message, recentErr);
  const recentlyNudgedIds = new Set<string>();
  for (const row of recentRows ?? []) {
    const payload = row.payload;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const subId = (payload as Record<string, unknown>).subscription_id;
      if (typeof subId === "string" && subId.trim()) recentlyNudgedIds.add(subId.trim());
    }
  }
  const filtered = selected.filter((c) => !recentlyNudgedIds.has(c.subscription_id));
  if (filtered.length === 0) return 0;

  const rows: Database["public"]["Tables"]["notification_events"]["Insert"][] = filtered.map((c) => ({
    booking_id: null,
    recipient_vendor_id: null,
    event_type: "subscription_renewal_nudge",
    channels: channels as unknown as Json,
    status: "queued",
    payload: {
      subscription_id: c.subscription_id,
      customer_id: c.customer_id,
      customer_name: c.customer_name,
      customer_email: c.customer_email,
      customer_phone: c.customer_phone,
      plan_name: c.plan_name,
      ends_at: c.ends_at,
      days_to_expiry: c.days_to_expiry,
    } as Json,
    attempt_count: 0,
    next_attempt_at: new Date().toISOString(),
    demo_mode: true,
  }));

  const { error } = await client.from("notification_events").insert(rows);
  if (error) throw new SupabaseApiError(error.message, error);
  return rows.length;
}

function renderTemplateText(
  text: string,
  context: Record<string, string | number | boolean | null | undefined>,
): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => String(context[key] ?? ""));
}

export async function adminPreviewSubscriptionRenewalNudge(
  client: SupabaseClient<Database>,
  input: { subscriptionId: string; channels?: RenewalNudgeChannel[] },
): Promise<Array<{ channel: RenewalNudgeChannel; subject: string | null; body: string }>> {
  const candidates = await adminListSubscriptionRenewalNudgeCandidates(client, { daysAhead: 60, limit: 500 });
  const candidate = candidates.find((c) => c.subscription_id === input.subscriptionId);
  if (!candidate) throw new SupabaseApiError("Subscription not found in upcoming renewal window.");
  const channels = [...new Set((input.channels ?? ["email", "sms", "whatsapp"]).filter(Boolean))];

  const { data: templates, error } = await client
    .from("notification_templates")
    .select("channel, subject, body")
    .eq("event_type", "subscription_renewal_nudge")
    .eq("is_active", true)
    .in("channel", channels);
  if (error) throw new SupabaseApiError(error.message, error);

  const context: Record<string, string | number | boolean | null | undefined> = {
    customer_name: candidate.customer_name ?? "Customer",
    plan_name: candidate.plan_name,
    ends_at: new Date(candidate.ends_at).toLocaleDateString("en-IN"),
    days_to_expiry: candidate.days_to_expiry,
  };
  const out: Array<{ channel: RenewalNudgeChannel; subject: string | null; body: string }> = [];
  for (const channel of channels) {
    const row = (templates ?? []).find((t) => t.channel === channel);
    if (!row) continue;
    out.push({
      channel: channel as RenewalNudgeChannel,
      subject: row.subject ? renderTemplateText(row.subject, context) : null,
      body: renderTemplateText(row.body, context),
    });
  }
  return out;
}
