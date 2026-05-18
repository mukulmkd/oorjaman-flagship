import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  PricingAmcPlanRow,
  PricingCatalogAuditRow,
  PricingOneTimeRateRow,
  ServiceCapacityTierRow,
} from "../database.types";
import { SupabaseApiError, takeRows, takeSingleRow } from "../result";
import { offsetRangeForPage, type PagedParams, type PagedResult } from "../page-range";
import { normalizeCountryCode } from "./pricing-engine";
import { resolveGeoPricingTierAddons } from "./pricing-api";
import {
  quoteOneTimeFromCatalog,
  type OneTimeCapacityQuote,
} from "./capacity-pricing";

export type { OneTimeCapacityQuote } from "./capacity-pricing";
export {
  ALLOWED_CAPACITY_KW,
  formatAmcPlanSubtitle,
  isAllowedCapacityKw,
  listAmcPlansForTier,
  quoteOneTimeFromCatalog,
  snapCapacityKwToAllowed,
  tierCodeFromCapacityKw,
} from "./capacity-pricing";

export async function listServiceCapacityTiers(
  client: SupabaseClient<Database>,
  countryCode = "IN",
): Promise<ServiceCapacityTierRow[]> {
  const cc = normalizeCountryCode(countryCode);
  const { data, error } = await client
    .from("service_capacity_tiers")
    .select("*")
    .eq("country_code", cc)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return takeRows(data, error);
}

export async function listPricingOneTimeRates(
  client: SupabaseClient<Database>,
  countryCode = "IN",
): Promise<PricingOneTimeRateRow[]> {
  const cc = normalizeCountryCode(countryCode);
  const { data, error } = await client
    .from("pricing_one_time_rates")
    .select("*")
    .eq("country_code", cc)
    .order("capacity_tier_code", { ascending: true });
  return takeRows(data, error);
}

export async function listPricingAmcPlans(
  client: SupabaseClient<Database>,
  countryCode = "IN",
): Promise<PricingAmcPlanRow[]> {
  const cc = normalizeCountryCode(countryCode);
  const { data, error } = await client
    .from("pricing_amc_plans")
    .select("*")
    .eq("country_code", cc)
    .eq("is_active", true)
    .order("capacity_tier_code")
    .order("sort_order", { ascending: true });
  return takeRows(data, error);
}

export async function getPricingAmcPlanByCode(
  client: SupabaseClient<Database>,
  planCode: string,
): Promise<PricingAmcPlanRow> {
  const { data, error } = await client
    .from("pricing_amc_plans")
    .select("*")
    .eq("plan_code", planCode.trim())
    .eq("is_active", true)
    .single();
  return takeSingleRow(data, error);
}

export async function quoteOneTimeServicePrice(
  client: SupabaseClient<Database>,
  input: { capacityKw: number; countryCode?: string; cityKey?: string | null },
): Promise<OneTimeCapacityQuote> {
  const cc = normalizeCountryCode(input.countryCode ?? "IN");
  const cityKeyClean =
    input.cityKey == null || String(input.cityKey).trim() === "" ? null : String(input.cityKey).trim();
  const [tiers, rates, geoAddons] = await Promise.all([
    listServiceCapacityTiers(client, cc),
    listPricingOneTimeRates(client, cc),
    resolveGeoPricingTierAddons(client, { countryCode: cc, cityKey: cityKeyClean }),
  ]);
  const quote = quoteOneTimeFromCatalog(tiers, rates, input.capacityKw);
  if (!quote) {
    throw new SupabaseApiError(
      "We only service 3, 4, 5, 6, 8, and 10 kW systems. Update your solar size in Profile to match.",
    );
  }
  const addon = Math.max(0, geoAddons.visit_addon_cents);
  return {
    ...quote,
    catalogue_visit_cents: quote.catalogue_visit_cents,
    amount_cents: quote.catalogue_visit_cents + addon,
    geo_visit_addon_cents: addon,
    geo_pricing_tier_code: geoAddons.matched_tier_code,
    geo_pricing_tier_label: geoAddons.matched_tier_label,
  };
}

export type SaveOneTimeRateInput = {
  id?: string;
  country_code?: string;
  capacity_tier_code: string;
  amount_cents: number;
  per_panel_rate_cents: number;
  is_active?: boolean;
};

export async function adminSavePricingOneTimeRate(
  client: SupabaseClient<Database>,
  input: SaveOneTimeRateInput,
): Promise<PricingOneTimeRateRow> {
  const cc = normalizeCountryCode(input.country_code ?? "IN");
  const row = {
    country_code: cc,
    capacity_tier_code: input.capacity_tier_code.trim(),
    amount_cents: Math.max(0, Math.round(input.amount_cents)),
    per_panel_rate_cents: Math.max(0, Math.round(input.per_panel_rate_cents)),
    is_active: input.is_active ?? true,
  };
  if (input.id) {
    const { data, error } = await client
      .from("pricing_one_time_rates")
      .update(row)
      .eq("id", input.id)
      .select()
      .single();
    return takeSingleRow(data, error);
  }
  const { data, error } = await client.from("pricing_one_time_rates").insert(row).select().single();
  return takeSingleRow(data, error);
}

export type SaveAmcPlanInput = {
  id?: string;
  country_code?: string;
  capacity_tier_code: string;
  plan_code: string;
  plan_name: string;
  contract_months: 12 | 24;
  visits_included: number;
  visits_per_year?: number | null;
  amount_cents: number;
  sort_order?: number;
  is_active?: boolean;
};

export async function adminSavePricingAmcPlan(
  client: SupabaseClient<Database>,
  input: SaveAmcPlanInput,
): Promise<PricingAmcPlanRow> {
  const cc = normalizeCountryCode(input.country_code ?? "IN");
  const row = {
    country_code: cc,
    capacity_tier_code: input.capacity_tier_code.trim(),
    plan_code: input.plan_code.trim(),
    plan_name: input.plan_name.trim(),
    contract_months: input.contract_months,
    visits_included: Math.max(1, Math.round(input.visits_included)),
    visits_per_year: input.visits_per_year ?? null,
    amount_cents: Math.max(0, Math.round(input.amount_cents)),
    billing_period: "custom" as const,
    sort_order: input.sort_order ?? 0,
    is_active: input.is_active ?? true,
  };
  if (input.id) {
    const { data, error } = await client
      .from("pricing_amc_plans")
      .update(row)
      .eq("id", input.id)
      .select()
      .single();
    return takeSingleRow(data, error);
  }
  const { data, error } = await client.from("pricing_amc_plans").insert(row).select().single();
  return takeSingleRow(data, error);
}

export async function adminListPricingCatalogAudit(
  client: SupabaseClient<Database>,
  options?: { countryCode?: string; limit?: number },
): Promise<PricingCatalogAuditRow[]> {
  const cc = normalizeCountryCode(options?.countryCode ?? "IN");
  const limit = Math.max(1, Math.min(200, options?.limit ?? 80));
  const { data, error } = await client
    .from("pricing_catalog_audit")
    .select("*")
    .eq("country_code", cc)
    .order("changed_at", { ascending: false })
    .limit(limit);
  return takeRows(data, error);
}

export async function adminListPricingCatalogAuditPaged(
  client: SupabaseClient<Database>,
  options: { countryCode?: string },
  params: PagedParams,
): Promise<PagedResult<PricingCatalogAuditRow>> {
  const cc = normalizeCountryCode(options.countryCode ?? "IN");
  const { from, to } = offsetRangeForPage(params.page, params.pageSize);
  const { data, error, count } = await client
    .from("pricing_catalog_audit")
    .select("*", { count: "exact" })
    .eq("country_code", cc)
    .order("changed_at", { ascending: false })
    .range(from, to);
  return { rows: takeRows(data, error), total: count ?? 0 };
}
