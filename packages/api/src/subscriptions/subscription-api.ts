import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, SubscriptionRow, SubscriptionStatus } from "../database.types";
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

export {
  RENEWAL_NUDGE_EVENT_TYPE,
  adminGetRenewalNudgeChannelSummary,
  adminGetRenewalNudgeQueueStats,
  adminListLapsedSubscriptionRenewalNudgeCandidates,
  adminListSubscriptionRenewalNudgeCandidates,
  adminPreviewSubscriptionRenewalNudge,
  adminQueueSubscriptionRenewalNudges,
  adminResolveRenewalNudgeCandidatesByIds,
  adminScheduleAndSendSubscriptionRenewalNudges,
  type RenewalNudgeAudience,
  type RenewalNudgeChannel,
  type RenewalNudgeChannelSummary,
  type RenewalNudgeQueueStats,
  type ScheduleAndSendRenewalNudgesResult,
  type SubscriptionRenewalNudgeCandidate,
} from "./subscription-renewal-nudges-api";
