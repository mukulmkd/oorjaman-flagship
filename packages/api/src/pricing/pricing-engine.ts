import type { PricingCityTierRow, PricingRuleRow, PricingTierRow } from "../database.types";

export type CalculatePriceLocation = {
  /** City name to match `pricing_city_tiers` or legacy `pricing_rules.city` (case-insensitive). */
  city?: string | null;
  state?: string | null;
  /** ISO 3166-1 alpha-2 (or short alpha-3). Defaults to `IN`. */
  country_code?: string | null;
};

export type CalculatePriceInput = {
  panel_count: number;
  capacity_kw: number;
  location: CalculatePriceLocation;
};

export type CalculatedPriceResult = {
  /** Before multiplier; paise. */
  subtotal_paise: number;
  /** After multiplier, rounded to integer paise. */
  final_paise: number;
  multiplier: number;
  /** Rule used for line items (base + rates). */
  line_rule: PricingRuleRow;
  /** Legacy per-city rule name when that row was used. */
  matched_city: string | null;
  /** Tier code when tier-based rule was used. */
  matched_tier_code: string | null;
  /** Human label from `pricing_tiers` when available. */
  matched_tier_label: string | null;
  pricing_country_code: string;
};

export type PricingMatchMeta = {
  matched_city: string | null;
  matched_tier_code: string | null;
  matched_tier_label: string | null;
  pricing_country_code: string;
};

/** ISO 3166-1 alpha-3 → alpha-2 for common markets (DB rules use alpha-2, e.g. IN). */
const ISO_ALPHA3_TO_ALPHA2: Record<string, string> = {
  IND: "IN",
  USA: "US",
  GBR: "GB",
  ARE: "AE",
  SAU: "SA",
  ZAF: "ZA",
  AUS: "AU",
  CAN: "CA",
  DEU: "DE",
  FRA: "FR",
  ITA: "IT",
  ESP: "ES",
  MEX: "MX",
  BRA: "BR",
  JPN: "JP",
  CHN: "CN",
  KOR: "KR",
  SGP: "SG",
  MYS: "MY",
  THA: "TH",
  IDN: "ID",
  PHL: "PH",
  VNM: "VN",
  BGD: "BD",
  LKA: "LK",
  PAK: "PK",
  NPL: "NP",
};

/**
 * Normalizes to ISO 3166-1 alpha-2 uppercase for matching `pricing_rules.country_code`.
 * Handles full country names and alpha-3 so customer addresses stay aligned with admin (IN).
 */
export function normalizeCountryCode(code: string | null | undefined): string {
  const raw = (code ?? "IN").trim();
  if (!raw) return "IN";
  const lower = raw.toLowerCase();
  if (lower === "india" || lower === "in" || lower === "ind") return "IN";
  if (lower === "united states" || lower === "usa" || lower === "us") return "US";
  if (lower === "united kingdom" || lower === "uk" || lower === "gb") return "GB";

  const c = raw.toUpperCase();
  if (c.length < 2) return "IN";
  if (c.length === 2 && /^[A-Z]{2}$/.test(c)) return c;
  if (c.length === 3 && /^[A-Z]{3}$/.test(c)) {
    return ISO_ALPHA3_TO_ALPHA2[c] ?? c;
  }
  if (c.length >= 3) {
    const prefix3 = c.slice(0, 3);
    if (/^[A-Z]{3}$/.test(prefix3)) {
      const mapped = ISO_ALPHA3_TO_ALPHA2[prefix3];
      if (mapped) return mapped;
    }
  }
  if (c.length >= 2 && /^[A-Z]{2}/.test(c)) return c.slice(0, 2);
  return "IN";
}

export function normalizeCityKey(city: string | null | undefined): string | null {
  if (city == null) return null;
  const t = city.trim();
  if (t.length === 0) return null;
  return t.toLowerCase();
}

export function normalizeTierKey(tier: string | null | undefined): string | null {
  if (tier == null) return null;
  const t = tier.trim();
  if (t.length === 0) return null;
  return t.toLowerCase();
}

function rulesForCountry(rules: PricingRuleRow[], country: string): PricingRuleRow[] {
  const cc = normalizeCountryCode(country);
  return rules.filter((r) => normalizeCountryCode(r.country_code) === cc);
}

function isNationalRule(r: PricingRuleRow): boolean {
  const noCity = r.city == null || r.city.trim() === "";
  const noTier = r.tier_code == null || String(r.tier_code).trim() === "";
  return noCity && noTier;
}

function isTierRule(r: PricingRuleRow): boolean {
  const hasTier = r.tier_code != null && String(r.tier_code).trim() !== "";
  const noCity = r.city == null || r.city.trim() === "";
  return hasTier && noCity;
}

function isLegacyCityRule(r: PricingRuleRow): boolean {
  const hasCity = r.city != null && r.city.trim() !== "";
  const noTier = r.tier_code == null || String(r.tier_code).trim() === "";
  return hasCity && noTier;
}

export function lookupTierCodeForCity(
  cityTiers: PricingCityTierRow[],
  countryCode: string,
  cityKey: string | null,
): string | null {
  if (!cityKey) return null;
  const cc = normalizeCountryCode(countryCode);
  const row = cityTiers.find(
    (t) => normalizeCountryCode(t.country_code) === cc && normalizeCityKey(t.city_key) === cityKey,
  );
  return row?.tier_code?.trim() ? row.tier_code.trim() : null;
}

function tierLabel(catalog: PricingTierRow[], countryCode: string, tierCode: string): string | null {
  const cc = normalizeCountryCode(countryCode);
  const want = normalizeTierKey(tierCode);
  const hit = catalog.find(
    (t) => normalizeCountryCode(t.country_code) === cc && normalizeTierKey(t.code) === want,
  );
  return hit?.label?.trim() ? hit.label.trim() : null;
}

/**
 * Resolution order: city → tier rate card → legacy city rule → national default (per country).
 */
export function resolvePricingQuote(
  rules: PricingRuleRow[],
  cityTiers: PricingCityTierRow[],
  tierCatalog: PricingTierRow[],
  location: CalculatePriceLocation,
): { rule: PricingRuleRow; match: PricingMatchMeta } | null {
  const country = normalizeCountryCode(location.country_code);
  const scoped = rulesForCountry(rules, country);
  const cityKey = normalizeCityKey(location.city ?? undefined);

  const tierCodeFromMap = lookupTierCodeForCity(cityTiers, country, cityKey);
  if (tierCodeFromMap) {
    const tk = normalizeTierKey(tierCodeFromMap);
    const tierRule =
      tk &&
      scoped.find((r) => isTierRule(r) && normalizeTierKey(r.tier_code) === tk);
    if (tierRule) {
      return {
        rule: tierRule,
        match: {
          matched_city: null,
          matched_tier_code: tierCodeFromMap,
          matched_tier_label: tierLabel(tierCatalog, country, tierCodeFromMap),
          pricing_country_code: country,
        },
      };
    }
  }

  if (cityKey) {
    const legacy = scoped.find(
      (r) => isLegacyCityRule(r) && normalizeCityKey(r.city) === cityKey,
    );
    if (legacy?.city) {
      return {
        rule: legacy,
        match: {
          matched_city: legacy.city.trim(),
          matched_tier_code: null,
          matched_tier_label: null,
          pricing_country_code: country,
        },
      };
    }
  }

  const national = scoped.find(isNationalRule);
  if (!national) return null;

  return {
    rule: national,
    match: {
      matched_city: null,
      matched_tier_code: null,
      matched_tier_label: null,
      pricing_country_code: country,
    },
  };
}

/**
 * Back-compat wrapper (tier map + catalogs empty). Prefer {@link resolvePricingQuote} for tier-aware resolution.
 */
export function resolvePricingRule(
  rules: PricingRuleRow[],
  location: CalculatePriceLocation,
): PricingRuleRow | null {
  return resolvePricingQuote(rules, [], [], location)?.rule ?? null;
}

/**
 * Computes estimate in INR paise from a single rule (no DB).
 * subtotal = base + panels * per_panel + kw * per_kw (fractional kW allowed).
 * final = round(subtotal * multiplier).
 */
export function calculatePriceFromRule(
  lineRule: PricingRuleRow,
  input: Pick<CalculatePriceInput, "panel_count" | "capacity_kw">,
  multiplier: number,
): Pick<CalculatedPriceResult, "subtotal_paise" | "final_paise"> {
  const panels = Math.max(0, Math.round(Number(input.panel_count) || 0));
  const kw = Math.max(0, Number(input.capacity_kw) || 0);
  const base = Number(lineRule.base_price) || 0;
  const perPanel = Number(lineRule.per_panel_rate) || 0;
  const perKw = Number(lineRule.per_kw_rate) || 0;
  const subtotal = base + panels * perPanel + Math.round(kw * perKw);
  const m = Number(multiplier) > 0 ? Number(multiplier) : 1;
  const final = Math.max(0, Math.round(subtotal * m));
  return { subtotal_paise: subtotal, final_paise: final };
}

export function buildCalculatedResult(
  lineRule: PricingRuleRow,
  match: PricingMatchMeta,
  input: CalculatePriceInput,
): CalculatedPriceResult {
  const m = Number(lineRule.multiplier) > 0 ? Number(lineRule.multiplier) : 1;
  const { subtotal_paise, final_paise } = calculatePriceFromRule(lineRule, input, m);
  return {
    subtotal_paise,
    final_paise,
    multiplier: m,
    line_rule: lineRule,
    matched_city: match.matched_city,
    matched_tier_code: match.matched_tier_code,
    matched_tier_label: match.matched_tier_label,
    pricing_country_code: match.pricing_country_code,
  };
}

/** Line items for customer-facing price transparency (amounts in INR paise). */
export type VisitPriceBreakdown = {
  base_paise: number;
  panels_line_paise: number;
  kw_line_paise: number;
  panel_count: number;
  capacity_kw: number;
  subtotal_paise: number;
  multiplier: number;
  matched_city: string | null;
  matched_tier_code: string | null;
  matched_tier_label: string | null;
  pricing_country_code: string;
  final_paise: number;
};

/** Derives per-line components from a calculated result (must match `calculatePriceFromRule` math). */
export function getVisitPriceBreakdown(
  calculated: CalculatedPriceResult,
  input: Pick<CalculatePriceInput, "panel_count" | "capacity_kw">,
): VisitPriceBreakdown {
  const panels = Math.max(0, Math.round(Number(input.panel_count) || 0));
  const kw = Math.max(0, Number(input.capacity_kw) || 0);
  const r = calculated.line_rule;
  const base = Number(r.base_price) || 0;
  const perPanel = Number(r.per_panel_rate) || 0;
  const perKw = Number(r.per_kw_rate) || 0;
  const panelsLine = panels * perPanel;
  const kwLine = Math.round(kw * perKw);
  return {
    base_paise: base,
    panels_line_paise: panelsLine,
    kw_line_paise: kwLine,
    panel_count: panels,
    capacity_kw: kw,
    subtotal_paise: calculated.subtotal_paise,
    multiplier: calculated.multiplier,
    matched_city: calculated.matched_city,
    matched_tier_code: calculated.matched_tier_code,
    matched_tier_label: calculated.matched_tier_label,
    pricing_country_code: calculated.pricing_country_code,
    final_paise: calculated.final_paise,
  };
}
