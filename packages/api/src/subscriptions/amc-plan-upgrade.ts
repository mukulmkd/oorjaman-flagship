import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceAddressCityKeyFromJson } from "../bookings/customer-booking-payload";
import type { Database, Json, SubscriptionRow } from "../database.types";
import { getMyCustomer } from "../customers/customer-api";
import {
  buildEffectiveAmcPlanForUpgrade,
  listAmcUpgradePlansForSubscription,
} from "../pricing/capacity-pricing";
import {
  getPricingAmcPlanByCode,
  getPricingAmcPlanByCodeIncludingInactive,
  listPricingAmcPlans,
} from "../pricing/capacity-pricing-api";
import { normalizeCountryCode } from "../pricing/pricing-engine";
import { resolveGeoPricingTierAddons } from "../pricing/pricing-api";
import { getCustomerSolarSizing } from "../customers/customer-solar-sizing";
import { SupabaseApiError, takeSingleRow } from "../result";
import { reconcileAmcVisitSlotsForSubscription } from "./amc-tier-realignment";
import {
  isSubscriptionActive,
  resolveSubscriptionAddressEntry,
} from "./subscription-address";

export const AMC_PLAN_UPGRADE_DISCLAIMER =
  "Upgrading updates your visit allowance and plan price for the rest of this contract period. Visits you already scheduled or completed stay as they are. Any price difference may be reviewed by OorjaMan.";

function amcPlanUpgradeRejectedMessage(
  subscription: SubscriptionRow,
  allowedUpgrades: ReturnType<typeof listAmcUpgradePlansForSubscription>,
  targetPlanCode: string,
): string {
  if (subscription.plan_code.trim() === targetPlanCode.trim()) {
    return "You're already on this AMC plan. Pull to refresh your plan details.";
  }
  if (allowedUpgrades.length === 0) {
    return "You're already on the highest AMC plan for your system size. Contact support for additional visits, or wait until your contract renewal date.";
  }
  return "Choose a higher AMC plan than your current package. Pull to refresh if you just upgraded.";
}

export async function upgradeAmcSubscriptionAsCustomer(
  client: SupabaseClient<Database>,
  input: {
    subscription_id: string;
    plan_code: string;
  },
): Promise<SubscriptionRow> {
  const customer = await getMyCustomer(client);
  if (!customer) {
    throw new SupabaseApiError("Customer profile required - sign in again.");
  }

  const { data: subRow, error: subErr } = await client
    .from("subscriptions")
    .select("*")
    .eq("id", input.subscription_id.trim())
    .single();
  const subscription = takeSingleRow(subRow, subErr);
  if (subscription.customer_id !== customer.id) {
    throw new SupabaseApiError("This AMC does not belong to your account.");
  }
  if (!isSubscriptionActive(subscription)) {
    throw new SupabaseApiError(
      "This AMC is no longer active. Renew from the plans below.",
    );
  }

  const targetPlanCode = input.plan_code.trim();
  const [catalog, newPlan] = await Promise.all([
    listPricingAmcPlans(client),
    getPricingAmcPlanByCode(client, targetPlanCode),
  ]);

  let catalogCurrentPlan = catalog.find(
    (p) => p.plan_code === subscription.plan_code.trim(),
  );
  if (!catalogCurrentPlan) {
    try {
      catalogCurrentPlan = await getPricingAmcPlanByCodeIncludingInactive(
        client,
        subscription.plan_code,
      );
    } catch {
      catalogCurrentPlan = undefined;
    }
  }

  if (!buildEffectiveAmcPlanForUpgrade(catalogCurrentPlan, subscription)) {
    throw new SupabaseApiError(
      "Your current AMC package is no longer in our catalog. Contact support to upgrade.",
    );
  }

  const allowedUpgrades = listAmcUpgradePlansForSubscription(
    catalog,
    subscription.plan_code,
    subscription,
  );
  if (!allowedUpgrades.some((p) => p.plan_code === newPlan.plan_code)) {
    throw new SupabaseApiError(
      amcPlanUpgradeRejectedMessage(subscription, allowedUpgrades, targetPlanCode),
    );
  }

  const sizing = getCustomerSolarSizing(customer);
  if (sizing.ready && newPlan.capacity_tier_code !== sizing.tierCode) {
    throw new SupabaseApiError(
      "This plan does not match your system size in Profile.",
    );
  }

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
    capacity_tier_code: newPlan.capacity_tier_code,
    contract_months: newPlan.contract_months,
    amc_upgraded_at: new Date().toISOString(),
    previous_plan_code: subscription.plan_code,
    previous_plan_name: subscription.plan_name,
    previous_amount_cents: subscription.amount_cents,
    previous_visits_included: subscription.visits_included,
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
      billing_period: newPlan.billing_period,
      visits_included: newPlan.visits_included,
      amount_cents: billedAmountCents,
      metadata,
    })
    .eq("id", subscription.id)
    .select()
    .single();
  if (updErr) throw new SupabaseApiError(updErr.message, updErr);

  let updated = takeSingleRow(updatedRow, updErr);
  await reconcileAmcVisitSlotsForSubscription(client, updated);

  const { data: refreshed, error: refErr } = await client
    .from("subscriptions")
    .select("*")
    .eq("id", subscription.id)
    .single();
  if (!refErr && refreshed) updated = takeSingleRow(refreshed, refErr);

  return updated;
}
