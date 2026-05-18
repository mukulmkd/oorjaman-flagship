import type { PricingAmcPlanRow, SubscriptionBillingPeriod } from "../database.types";

export const AMC_CONTRACT_MONTHS_DEFAULT = 12;

/** @deprecated Use `pricing_amc_plans` from admin catalog; kept for type compatibility. */
export type AmcSelectablePeriod = Extract<SubscriptionBillingPeriod, "monthly" | "quarterly">;

export type AmcPlanFromCatalog = Pick<
  PricingAmcPlanRow,
  | "plan_code"
  | "plan_name"
  | "billing_period"
  | "visits_included"
  | "amount_cents"
  | "contract_months"
  | "capacity_tier_code"
  | "visits_per_year"
>;

/** Contract end from start and plan length in months. */
export function computeContractEndsAtIso(startsAtIso: string, contractMonths = AMC_CONTRACT_MONTHS_DEFAULT): string {
  const d = new Date(startsAtIso);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid subscription start date");
  }
  const months = Math.max(1, Math.round(contractMonths));
  const end = new Date(d.getTime());
  end.setUTCMonth(end.getUTCMonth() + months);
  return end.toISOString();
}

export function amcPlanFromCatalogRow(row: PricingAmcPlanRow): AmcPlanFromCatalog {
  return {
    plan_code: row.plan_code,
    plan_name: row.plan_name,
    billing_period: row.billing_period,
    visits_included: row.visits_included,
    amount_cents: row.amount_cents,
    contract_months: row.contract_months,
    capacity_tier_code: row.capacity_tier_code,
    visits_per_year: row.visits_per_year,
  };
}

export function formatInrFromCents(amountCents: number): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amountCents / 100);
  } catch {
    return `₹${(amountCents / 100).toFixed(0)}`;
  }
}
