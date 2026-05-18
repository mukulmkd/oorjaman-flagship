import type {
  PricingAmcPlanRow,
  PricingOneTimeRateRow,
  ServiceCapacityTierRow,
} from "../database.types";

/** Supported system sizes (no 7 kW or 9 kW). */
export const ALLOWED_CAPACITY_KW = [3, 4, 5, 6, 8, 10] as const;

export type AllowedCapacityKw = (typeof ALLOWED_CAPACITY_KW)[number];

const KW_TO_TIER_CODE: Record<AllowedCapacityKw, string> = {
  3: "kw_3",
  4: "kw_4",
  5: "kw_5",
  6: "kw_6",
  8: "kw_8",
  10: "kw_10",
};

const TIER_CODE_TO_KW: Record<string, AllowedCapacityKw> = {
  kw_3: 3,
  kw_4: 4,
  kw_5: 5,
  kw_6: 6,
  kw_8: 8,
  kw_10: 10,
};

export function capacityKwFromTierCode(code: string): AllowedCapacityKw | null {
  return TIER_CODE_TO_KW[code] ?? null;
}

export function tierCodeFromCapacityKw(kw: number): string | null {
  const snapped = snapCapacityKwToAllowed(kw);
  if (snapped == null) return null;
  return KW_TO_TIER_CODE[snapped];
}

/**
 * Map profile kW to an allowed tier. Exact match within 0.2 kW, else nearest allowed tier if within 0.75 kW.
 * Returns null when capacity is unsupported (e.g. 7 kW or 9 kW with no close match).
 */
export function snapCapacityKwToAllowed(kw: number): AllowedCapacityKw | null {
  if (!Number.isFinite(kw) || kw <= 0) return null;
  for (const t of ALLOWED_CAPACITY_KW) {
    if (Math.abs(kw - t) < 0.2) return t;
  }
  let best: AllowedCapacityKw = ALLOWED_CAPACITY_KW[0];
  let bestDist = Math.abs(kw - best);
  for (const t of ALLOWED_CAPACITY_KW) {
    const d = Math.abs(kw - t);
    if (d < bestDist) {
      best = t;
      bestDist = d;
    }
  }
  if (bestDist > 0.75) return null;
  return best;
}

export function isAllowedCapacityKw(kw: number): boolean {
  return snapCapacityKwToAllowed(kw) != null;
}

export type OneTimeCapacityQuote = {
  capacity_tier_code: string;
  capacity_kw: AllowedCapacityKw;
  typical_panel_count: number;
  tier_label: string;
  /** Catalogue visit price before geo-tier add-on. */
  catalogue_visit_cents: number;
  amount_cents: number;
  per_panel_rate_cents: number;
  /** INR add-on applied when customer city maps to a geo tier (on top of catalogue). */
  geo_visit_addon_cents: number;
  geo_pricing_tier_code: string | null;
  geo_pricing_tier_label: string | null;
};

export function quoteOneTimeFromCatalog(
  tiers: ServiceCapacityTierRow[],
  rates: PricingOneTimeRateRow[],
  capacityKw: number,
): OneTimeCapacityQuote | null {
  const code = tierCodeFromCapacityKw(capacityKw);
  if (!code) return null;
  const tier = tiers.find((t) => t.code === code && t.is_active);
  const rate = rates.find((r) => r.capacity_tier_code === code && r.is_active);
  if (!tier || !rate) return null;
  const kw = capacityKwFromTierCode(code);
  if (kw == null) return null;
  return {
    capacity_tier_code: code,
    capacity_kw: kw,
    typical_panel_count: tier.typical_panel_count,
    tier_label: tier.label,
    catalogue_visit_cents: rate.amount_cents,
    amount_cents: rate.amount_cents,
    geo_visit_addon_cents: 0,
    geo_pricing_tier_code: null,
    geo_pricing_tier_label: null,
    per_panel_rate_cents: rate.per_panel_rate_cents,
  };
}

function normalizeCapacityTierCode(code: string): string {
  return code.trim().toLowerCase();
}

/** Active unless explicitly disabled (null/undefined counts as active). */
export function isPricingCatalogRowActive(isActive: boolean | null | undefined): boolean {
  return isActive !== false;
}

export function listAmcPlansForTier(
  plans: PricingAmcPlanRow[],
  capacityTierCode: string,
): PricingAmcPlanRow[] {
  const tier = normalizeCapacityTierCode(capacityTierCode);
  return plans
    .filter(
      (p) =>
        isPricingCatalogRowActive(p.is_active) &&
        normalizeCapacityTierCode(p.capacity_tier_code) === tier,
    )
    .sort((a, b) => a.sort_order - b.sort_order || a.contract_months - b.contract_months);
}

export function formatAmcPlanSubtitle(plan: PricingAmcPlanRow): string {
  if (plan.contract_months === 24) {
    return `${plan.visits_included} visits over 2 years`;
  }
  if (plan.visits_per_year != null) {
    return `${plan.visits_per_year} times a year · 1 year`;
  }
  return `${plan.visits_included} visits · 1 year`;
}

/** Higher = more visits, longer contract, then admin sort order. */
export function compareAmcPlanTier(a: PricingAmcPlanRow, b: PricingAmcPlanRow): number {
  if (a.visits_included !== b.visits_included) return a.visits_included - b.visits_included;
  if (a.contract_months !== b.contract_months) return a.contract_months - b.contract_months;
  return a.sort_order - b.sort_order;
}

export function isAmcPlanUpgradeFrom(
  current: PricingAmcPlanRow,
  candidate: PricingAmcPlanRow,
): boolean {
  if (current.plan_code === candidate.plan_code) return false;
  if (current.capacity_tier_code !== candidate.capacity_tier_code) return false;
  return compareAmcPlanTier(candidate, current) > 0;
}

export function listAmcUpgradePlansForSubscription(
  catalog: PricingAmcPlanRow[],
  currentPlanCode: string,
): PricingAmcPlanRow[] {
  const current = catalog.find((p) => p.plan_code === currentPlanCode.trim());
  if (!current) return [];
  return listAmcPlansForTier(catalog, current.capacity_tier_code).filter((p) =>
    isAmcPlanUpgradeFrom(current, p),
  );
}
