import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  PricingCityTierRow,
  PricingNationalDefaultAuditRow,
  PricingRuleRow,
  PricingTierRow,
} from "../database.types";
import { SupabaseApiError, takeRows, takeSingleRow } from "../result";
import {
  buildCalculatedResult,
  lookupTierCodeForCity,
  normalizeCityKey,
  normalizeCountryCode,
  normalizeTierKey,
  resolvePricingQuote,
  type CalculatePriceInput,
  type CalculatedPriceResult,
} from "./pricing-engine";

export async function listPricingRules(
  client: SupabaseClient<Database>,
): Promise<PricingRuleRow[]> {
  const { data, error } = await client
    .from("pricing_rules")
    .select("*")
    .order("country_code", { ascending: true })
    .order("tier_code", { ascending: true, nullsFirst: true })
    .order("city", { ascending: true, nullsFirst: true });
  return takeRows(data, error);
}

export async function listPricingTiers(
  client: SupabaseClient<Database>,
  countryCode = "IN",
): Promise<PricingTierRow[]> {
  const cc = normalizeCountryCode(countryCode);
  const { data, error } = await client
    .from("pricing_tiers")
    .select("*")
    .eq("country_code", cc)
    .order("sort_order", { ascending: true })
    .order("code", { ascending: true });
  return takeRows(data, error);
}

export async function listPricingCityTiers(
  client: SupabaseClient<Database>,
  countryCode?: string,
): Promise<PricingCityTierRow[]> {
  let q = client
    .from("pricing_city_tiers")
    .select("*")
    .order("country_code")
    .order("city_key");
  const cc = countryCode ? normalizeCountryCode(countryCode) : null;
  if (cc) q = q.eq("country_code", cc);
  const { data, error } = await q;
  return takeRows(data, error);
}

export type CalculatePriceOptions = {
  cityTierRows?: PricingCityTierRow[];
  tierCatalog?: PricingTierRow[];
};

/**
 * Price estimate from an already-fetched rules list (avoids a second network round-trip).
 */
export function calculatePriceFromRules(
  rules: PricingRuleRow[],
  input: CalculatePriceInput,
  options?: CalculatePriceOptions,
): CalculatedPriceResult {
  const resolved = resolvePricingQuote(
    rules,
    options?.cityTierRows ?? [],
    options?.tierCatalog ?? [],
    input.location,
  );
  if (!resolved) {
    const cc = normalizeCountryCode(input.location.country_code);
    const hasAnyRuleForCountry = rules.some(
      (r) => normalizeCountryCode(r.country_code) === cc,
    );
    throw new SupabaseApiError(
      hasAnyRuleForCountry
        ? `No matching pricing rule for country ${cc} and this location (tier map / city). Check city→tier and tier rate cards, or add a national default for ${cc} in admin.`
        : `No pricing rules for country ${cc}. Admin rules use ISO alpha-2 (e.g. IN). If the customer address used "IND" or "India", it is normalized to IN - add a national default for ${cc} in Pricing.`,
    );
  }
  return buildCalculatedResult(resolved.rule, resolved.match, input);
}

export async function calculatePrice(
  client: SupabaseClient<Database>,
  input: CalculatePriceInput,
): Promise<CalculatedPriceResult> {
  const [rules, cityTiers, tiers] = await Promise.all([
    listPricingRules(client),
    listPricingCityTiers(client, input.location.country_code ?? "IN"),
    listPricingTiers(client, input.location.country_code ?? "IN"),
  ]);
  return calculatePriceFromRules(rules, input, {
    cityTierRows: cityTiers,
    tierCatalog: tiers,
  });
}

export type SavePricingRuleInput = {
  id?: string;
  country_code?: string;
  city?: string | null;
  tier_code?: string | null;
  base_price: number;
  per_panel_rate: number;
  per_kw_rate: number;
  multiplier: number;
};

/** Admin: national default, tier rate card, or legacy city row - mutually exclusive tier vs city. */
export async function adminSavePricingRule(
  client: SupabaseClient<Database>,
  input: SavePricingRuleInput,
): Promise<PricingRuleRow> {
  const country = normalizeCountryCode(input.country_code ?? "IN");
  const cityRaw =
    input.city == null || input.city.trim() === "" ? null : input.city.trim();
  const tierRaw =
    input.tier_code == null || String(input.tier_code).trim() === ""
      ? null
      : String(input.tier_code).trim();

  if (cityRaw && tierRaw) {
    throw new SupabaseApiError(
      "Choose either a tier rate card or a legacy city override, not both.",
    );
  }

  const row = {
    country_code: country,
    city: cityRaw,
    tier_code: tierRaw,
    base_price: Math.max(0, Math.round(input.base_price)),
    per_panel_rate: Math.max(0, Math.round(input.per_panel_rate)),
    per_kw_rate: Math.max(0, Math.round(input.per_kw_rate)),
    multiplier: input.multiplier > 0 ? input.multiplier : 1,
  };

  if (input.id) {
    const { data, error } = await client
      .from("pricing_rules")
      .update(row)
      .eq("id", input.id)
      .select()
      .single();
    return takeSingleRow(data, error);
  }
  const { data, error } = await client
    .from("pricing_rules")
    .insert(row)
    .select()
    .single();
  return takeSingleRow(data, error);
}

export async function adminListPricingNationalDefaultAudit(
  client: SupabaseClient<Database>,
  opts?: { countryCode?: string; limit?: number },
): Promise<PricingNationalDefaultAuditRow[]> {
  const lim = Math.min(200, Math.max(1, opts?.limit ?? 80));
  let q = client
    .from("pricing_national_default_audit")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(lim);
  const cc = opts?.countryCode ? normalizeCountryCode(opts.countryCode) : null;
  if (cc) q = q.eq("country_code", cc);
  const { data, error } = await q;
  return takeRows(data, error);
}

export async function adminDeletePricingRule(
  client: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  const { data, error: fetchErr } = await client
    .from("pricing_rules")
    .select("city, tier_code, country_code")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) throw new SupabaseApiError(fetchErr.message, fetchErr);
  const city =
    data?.city == null || String(data.city).trim() === "" ? null : data.city;
  const tier =
    data?.tier_code == null || String(data.tier_code).trim() === ""
      ? null
      : data.tier_code;
  if (!city && !tier) {
    throw new SupabaseApiError(
      "Cannot delete the national default rule for this country. Create another default first or edit in place.",
    );
  }
  const { error } = await client.from("pricing_rules").delete().eq("id", id);
  if (error) throw new SupabaseApiError(error.message, error);
}

export type SavePricingTierInput = {
  id?: string;
  country_code?: string;
  code: string;
  label: string;
  sort_order?: number;
};

export async function adminSavePricingTier(
  client: SupabaseClient<Database>,
  input: SavePricingTierInput,
): Promise<PricingTierRow> {
  const country = normalizeCountryCode(input.country_code ?? "IN");
  const code = input.code.trim().replace(/\s+/g, "_").toLowerCase();
  if (!/^[a-z0-9][a-z0-9_]{0,62}$/.test(code)) {
    throw new SupabaseApiError(
      "Tier code: use letters, numbers, underscores (lowercase).",
    );
  }
  const label = input.label.trim();
  if (!label) throw new SupabaseApiError("Tier label is required.");
  const sort =
    typeof input.sort_order === "number" && Number.isFinite(input.sort_order)
      ? input.sort_order
      : 0;
  const row = { country_code: country, code, label, sort_order: sort };
  if (input.id) {
    const { data, error } = await client
      .from("pricing_tiers")
      .update(row)
      .eq("id", input.id)
      .select()
      .single();
    return takeSingleRow(data, error);
  }
  const { data, error } = await client
    .from("pricing_tiers")
    .insert(row)
    .select()
    .single();
  return takeSingleRow(data, error);
}

export async function adminDeletePricingTier(
  client: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  const { error } = await client.from("pricing_tiers").delete().eq("id", id);
  if (error) throw new SupabaseApiError(error.message, error);
}

export type SavePricingCityTierInput = {
  id?: string;
  country_code?: string;
  /** Display / entry name; stored as normalized `city_key`. */
  city_name: string;
  state_key?: string | null;
  tier_code: string;
};

export async function adminSavePricingCityTier(
  client: SupabaseClient<Database>,
  input: SavePricingCityTierInput,
): Promise<PricingCityTierRow> {
  const country = normalizeCountryCode(input.country_code ?? "IN");
  const cityKey = normalizeCityKey(input.city_name);
  if (!cityKey) throw new SupabaseApiError("City name is required.");
  const tier = input.tier_code.trim();
  if (!tier) throw new SupabaseApiError("Select a tier.");

  const row = {
    country_code: country,
    city_key: cityKey,
    state_key:
      input.state_key == null || String(input.state_key).trim() === ""
        ? null
        : String(input.state_key).trim(),
    tier_code: tier,
  };

  if (input.id) {
    const { data, error } = await client
      .from("pricing_city_tiers")
      .update(row)
      .eq("id", input.id)
      .select()
      .single();
    return takeSingleRow(data, error);
  }

  const { data, error } = await client
    .from("pricing_city_tiers")
    .upsert(row, { onConflict: "country_code,city_key" })
    .select()
    .single();
  return takeSingleRow(data, error);
}

export async function adminDeletePricingCityTier(
  client: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("pricing_city_tiers")
    .delete()
    .eq("id", id);
  if (error) throw new SupabaseApiError(error.message, error);
}

export type ResolvedGeoPricingTierAddons = {
  matched_tier_code: string | null;
  matched_tier_label: string | null;
  visit_addon_cents: number;
  amc_addon_cents: number;
};

/**
 * Flat surcharges applied on top of fixed catalogue pricing when the customer's city maps to `pricing_city_tiers`.
 */
export async function resolveGeoPricingTierAddons(
  client: SupabaseClient<Database>,
  opts: { countryCode: string; cityKey?: string | null },
): Promise<ResolvedGeoPricingTierAddons> {
  const cc = normalizeCountryCode(opts.countryCode);
  const cityKey =
    opts.cityKey == null || opts.cityKey === ""
      ? null
      : normalizeCityKey(opts.cityKey.trim());
  if (!cityKey) {
    return {
      matched_tier_code: null,
      matched_tier_label: null,
      visit_addon_cents: 0,
      amc_addon_cents: 0,
    };
  }
  const [cityTiers, tierCatalog] = await Promise.all([
    listPricingCityTiers(client, cc),
    listPricingTiers(client, cc),
  ]);
  const tierCodeFromMap = lookupTierCodeForCity(cityTiers, cc, cityKey);
  if (!tierCodeFromMap) {
    return {
      matched_tier_code: null,
      matched_tier_label: null,
      visit_addon_cents: 0,
      amc_addon_cents: 0,
    };
  }
  const want = normalizeTierKey(tierCodeFromMap);
  const tierRow =
    want &&
    tierCatalog.find(
      (t) =>
        normalizeCountryCode(t.country_code) === cc &&
        normalizeTierKey(t.code) === want,
    );
  if (!tierRow) {
    return {
      matched_tier_code: tierCodeFromMap,
      matched_tier_label: null,
      visit_addon_cents: 0,
      amc_addon_cents: 0,
    };
  }
  return {
    matched_tier_code: tierRow.code,
    matched_tier_label: tierRow.label.trim() || tierRow.code,
    visit_addon_cents: Number(tierRow.visit_addon_cents) || 0,
    amc_addon_cents: Number(tierRow.amc_addon_cents) || 0,
  };
}

export type PatchPricingTierCapacityAddonsInput = {
  id: string;
  visit_addon_cents: number;
  amc_addon_cents: number;
};

export async function adminPatchPricingTierCapacityAddons(
  client: SupabaseClient<Database>,
  input: PatchPricingTierCapacityAddonsInput,
): Promise<PricingTierRow> {
  const visit_addon_cents = Math.max(0, Math.round(input.visit_addon_cents));
  const amc_addon_cents = Math.max(0, Math.round(input.amc_addon_cents));
  const { data, error } = await client
    .from("pricing_tiers")
    .update({ visit_addon_cents, amc_addon_cents })
    .eq("id", input.id.trim())
    .select()
    .single();
  return takeSingleRow(data, error);
}
