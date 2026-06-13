import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceAddressCityKeyFromJson } from "../bookings/customer-booking-payload";
import type {
  CustomerRow,
  Database,
  Json,
  PricingAmcPlanRow,
  SubscriptionRow,
} from "../database.types";
import { getCustomerSolarSizing } from "../customers/customer-solar-sizing";
import {
  getPricingAmcPlanByCode,
  listPricingAmcPlans,
} from "../pricing/capacity-pricing-api";
import { listAmcPlansForTier } from "../pricing/capacity-pricing";
import { normalizeCountryCode } from "../pricing/pricing-engine";
import { resolveGeoPricingTierAddons } from "../pricing/pricing-api";
import { SupabaseApiError, takeSingleRow } from "../result";
import { computeAmcVisitSlots } from "./amc-booking-generation";
import {
  isSubscriptionActive,
  resolveSubscriptionAddressEntry,
  subscriptionAddressLabel,
} from "./subscription-address";
import { listAmcVisitSlotsForSubscription } from "./amc-visit-slots";

export const AMC_CAPACITY_CHANGE_DISCLAIMER =
  "If you change your installed system size (kW), your active AMC plan will be re-priced for the new capacity band. Visit allowances are recalculated to match the updated plan. Visits you already scheduled or completed stay on your account - only remaining visit slots are adjusted. Any price difference may be reviewed by OorjaMan.";

export type AmcTierRealignmentSummary = {
  subscription_id: string;
  address_label: string;
  previous_tier_code: string;
  new_tier_code: string;
  previous_plan_code: string;
  new_plan_code: string;
  previous_plan_name: string;
  new_plan_name: string;
  previous_visits_included: number;
  new_visits_included: number;
  previous_amount_cents: number;
  new_amount_cents: number;
  pending_slots_added: number;
  pending_slots_removed: number;
};

export function readSubscriptionCapacityTierCode(
  sub: SubscriptionRow,
): string | null {
  if (
    !sub.metadata ||
    typeof sub.metadata !== "object" ||
    Array.isArray(sub.metadata)
  )
    return null;
  const v = (sub.metadata as Record<string, unknown>).capacity_tier_code;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function customerCapacityTierWillChangeAmc(
  customer: CustomerRow,
  subscriptions: SubscriptionRow[],
  newCapacityKw: number,
): boolean {
  const sizing = getCustomerSolarSizing({
    ...customer,
    solar_capacity_kw: newCapacityKw,
  });
  if (!sizing.ready) return false;
  const active = subscriptions.filter((s) => isSubscriptionActive(s));
  if (active.length === 0) return false;
  return active.some((s) => {
    const prev = readSubscriptionCapacityTierCode(s);
    return prev != null && prev !== sizing.tierCode;
  });
}

export async function findEquivalentAmcPlanForTierChange(
  client: SupabaseClient<Database>,
  subscription: SubscriptionRow,
  newTierCode: string,
): Promise<PricingAmcPlanRow> {
  const currentPlan = await getPricingAmcPlanByCode(
    client,
    subscription.plan_code,
  );
  const catalog = await listPricingAmcPlans(client);
  const candidates = listAmcPlansForTier(catalog, newTierCode);
  if (candidates.length === 0) {
    throw new SupabaseApiError(
      `No AMC plans are published for the ${newTierCode.replace(/^kw_/, "")} kW band.`,
    );
  }

  const exact = candidates.find(
    (p) =>
      p.contract_months === currentPlan.contract_months &&
      p.visits_included === currentPlan.visits_included,
  );
  if (exact) return exact;

  const sameContract = candidates.filter(
    (p) => p.contract_months === currentPlan.contract_months,
  );
  if (sameContract.length === 1) return sameContract[0]!;

  const closestVisits = [...candidates].sort(
    (a, b) =>
      Math.abs(a.visits_included - currentPlan.visits_included) -
      Math.abs(b.visits_included - currentPlan.visits_included),
  )[0];
  if (closestVisits) return closestVisits;

  throw new SupabaseApiError(
    "Could not match your current AMC package to a plan for the new system size. Contact support.",
  );
}

/**
 * Adjust pending visit placeholders to match `visits_included`. Booked slots are never removed.
 */
function slotBySequence(
  slots: Awaited<ReturnType<typeof listAmcVisitSlotsForSubscription>>,
): Map<number, (typeof slots)[number]> {
  const map = new Map<number, (typeof slots)[number]>();
  for (const slot of slots) {
    const prev = map.get(slot.sequence);
    if (!prev || (slot.booking_id != null && prev.booking_id == null)) {
      map.set(slot.sequence, slot);
    }
  }
  return map;
}

export async function reconcileAmcVisitSlotsForSubscription(
  client: SupabaseClient<Database>,
  subscription: SubscriptionRow,
): Promise<{ added: number; removed: number }> {
  const targetVisits = Math.max(0, subscription.visits_included ?? 0);
  const existing = await listAmcVisitSlotsForSubscription(
    client,
    subscription.id,
  );
  const booked = existing.filter((s) => s.booking_id != null);
  const bookedCount = booked.length;

  const effectiveTarget = Math.max(targetVisits, bookedCount);
  const bySequence = slotBySequence(existing);

  const idealWindows = computeAmcVisitSlots({
    ...subscription,
    visits_included: effectiveTarget,
  });

  let removed = 0;
  const excessUnbooked = existing.filter(
    (s) => s.booking_id == null && s.sequence > effectiveTarget,
  );
  if (excessUnbooked.length > 0) {
    const { error: delErr } = await client
      .from("subscription_visit_slots")
      .delete()
      .eq("subscription_id", subscription.id)
      .is("booking_id", null)
      .gt("sequence", effectiveTarget);
    if (delErr) throw new SupabaseApiError(delErr.message, delErr);
    removed = excessUnbooked.length;
  }

  let added = 0;
  for (let seq = 1; seq <= effectiveTarget; seq++) {
    const window = idealWindows[seq - 1];
    if (!window) break;

    const row = bySequence.get(seq);
    if (row?.booking_id != null) continue;

    const patch = {
      ideal_scheduled_start: window.scheduled_start,
      ideal_scheduled_end: window.scheduled_end,
      status: "pending" as const,
    };

    if (row && row.booking_id == null) {
      const { error: updErr } = await client
        .from("subscription_visit_slots")
        .update(patch)
        .eq("id", row.id);
      if (updErr) throw new SupabaseApiError(updErr.message, updErr);
      continue;
    }

    const { error: insErr } = await client
      .from("subscription_visit_slots")
      .insert({
        subscription_id: subscription.id,
        sequence: seq,
        ...patch,
      });
    if (insErr?.code === "23505") {
      const { error: updErr } = await client
        .from("subscription_visit_slots")
        .update(patch)
        .eq("subscription_id", subscription.id)
        .eq("sequence", seq)
        .is("booking_id", null);
      if (updErr) throw new SupabaseApiError(updErr.message, updErr);
      continue;
    }
    if (insErr) throw new SupabaseApiError(insErr.message, insErr);
    added += 1;
  }

  const visitsUsed = bookedCount;
  await client
    .from("subscriptions")
    .update({ visits_used: visitsUsed })
    .eq("id", subscription.id);

  if (effectiveTarget !== targetVisits) {
    const { error: capErr } = await client
      .from("subscriptions")
      .update({ visits_included: effectiveTarget })
      .eq("id", subscription.id);
    if (capErr) throw new SupabaseApiError(capErr.message, capErr);
  }

  return { added, removed };
}

export async function realignAmcSubscriptionForCapacityTier(
  client: SupabaseClient<Database>,
  params: {
    subscription: SubscriptionRow;
    customer: CustomerRow;
    newTierCode: string;
  },
): Promise<{
  subscription: SubscriptionRow;
  summary: AmcTierRealignmentSummary;
}> {
  const { subscription, customer, newTierCode } = params;
  const previousTier =
    readSubscriptionCapacityTierCode(subscription) ?? "unknown";
  if (previousTier === newTierCode) {
    throw new SupabaseApiError("AMC plan already matches this system size.");
  }

  const newPlan = await findEquivalentAmcPlanForTierChange(
    client,
    subscription,
    newTierCode,
  );
  const addressEntry = resolveSubscriptionAddressEntry(customer, subscription);
  const addressCityKey = serviceAddressCityKeyFromJson(
    addressEntry?.address ?? null,
  );
  const geoAddons = await resolveGeoPricingTierAddons(client, {
    countryCode: normalizeCountryCode("IN"),
    cityKey: addressCityKey,
  });
  const geoAmcAddonCents = Math.max(0, geoAddons.amc_addon_cents);
  const billedAmountCents = newPlan.amount_cents + geoAmcAddonCents;

  const prevMeta =
    subscription.metadata &&
    typeof subscription.metadata === "object" &&
    !Array.isArray(subscription.metadata)
      ? { ...(subscription.metadata as Record<string, unknown>) }
      : {};

  const metadata = {
    ...prevMeta,
    capacity_tier_code: newTierCode,
    capacity_tier_updated_at: new Date().toISOString(),
    capacity_tier_previous: previousTier,
    amc_price_reevaluated_at: new Date().toISOString(),
    previous_plan_code: subscription.plan_code,
    previous_plan_name: subscription.plan_name,
    previous_amount_cents: subscription.amount_cents,
    contract_months: newPlan.contract_months,
    ...(geoAmcAddonCents > 0 || geoAddons.matched_tier_code
      ? {
          geo_amc_addon_cents: geoAmcAddonCents,
          geo_amc_addon_tier_code: geoAddons.matched_tier_code,
          geo_amc_addon_tier_label: geoAddons.matched_tier_label,
        }
      : {}),
  } as Json;

  const { data: updatedRow, error: updErr } = await client
    .from("subscriptions")
    .update({
      plan_code: newPlan.plan_code,
      plan_name: newPlan.plan_name,
      visits_included: newPlan.visits_included,
      amount_cents: billedAmountCents,
      metadata,
    })
    .eq("id", subscription.id)
    .select()
    .single();
  if (updErr) throw new SupabaseApiError(updErr.message, updErr);
  let updated = takeSingleRow(updatedRow, updErr);

  const slotDelta = await reconcileAmcVisitSlotsForSubscription(
    client,
    updated,
  );

  const { data: refreshed, error: refErr } = await client
    .from("subscriptions")
    .select("*")
    .eq("id", subscription.id)
    .single();
  if (!refErr && refreshed) updated = takeSingleRow(refreshed, refErr);

  const summary: AmcTierRealignmentSummary = {
    subscription_id: subscription.id,
    address_label: subscriptionAddressLabel(customer, subscription),
    previous_tier_code: previousTier,
    new_tier_code: newTierCode,
    previous_plan_code: subscription.plan_code,
    new_plan_code: newPlan.plan_code,
    previous_plan_name: subscription.plan_name,
    new_plan_name: newPlan.plan_name,
    previous_visits_included: subscription.visits_included ?? 0,
    new_visits_included: updated.visits_included ?? newPlan.visits_included,
    previous_amount_cents: subscription.amount_cents,
    new_amount_cents: billedAmountCents,
    pending_slots_added: slotDelta.added,
    pending_slots_removed: slotDelta.removed,
  };

  return { subscription: updated, summary };
}

/**
 * After Profile kW change: re-price and reallocate visit slots for every active AMC.
 */
export async function realignActiveAmcSubscriptionsForCustomerCapacity(
  client: SupabaseClient<Database>,
  customer: CustomerRow,
): Promise<AmcTierRealignmentSummary[]> {
  const sizing = getCustomerSolarSizing(customer);
  if (!sizing.ready) return [];

  const { data: subs, error: subsErr } = await client
    .from("subscriptions")
    .select("*")
    .eq("customer_id", customer.id)
    .in("status", ["active", "trialing"]);
  if (subsErr) throw new SupabaseApiError(subsErr.message, subsErr);
  const active = (subs ?? []).filter((s) =>
    isSubscriptionActive(s as SubscriptionRow),
  ) as SubscriptionRow[];
  const out: AmcTierRealignmentSummary[] = [];

  for (const sub of active) {
    const prevTier = readSubscriptionCapacityTierCode(sub);
    if (!prevTier || prevTier === sizing.tierCode) continue;
    const { summary } = await realignAmcSubscriptionForCapacityTier(client, {
      subscription: sub,
      customer,
      newTierCode: sizing.tierCode,
    });
    out.push(summary);
  }

  return out;
}
