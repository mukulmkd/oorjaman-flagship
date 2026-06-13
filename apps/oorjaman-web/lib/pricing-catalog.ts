/** Published OorjaMan catalogue prices (INR). GST 18% is included in all amounts. */
export const OORJAMAN_GST_RATE_PERCENT = 18;

export const OORJAMAN_ONE_TIME_VISIT_PRICES_INR: ReadonlyArray<{ kw: number; priceInr: number }> = [
  { kw: 3, priceInr: 599 },
  { kw: 4, priceInr: 699 },
  { kw: 5, priceInr: 799 },
  { kw: 6, priceInr: 899 },
  { kw: 8, priceInr: 1099 },
  { kw: 9, priceInr: 1199 },
  { kw: 10, priceInr: 1299 },
];

export type OorjamanAmcPublishedPlan = {
  kw: number;
  spLabel: "SP-1" | "SP-2";
  visitsLabel: string;
  listPriceInr: number;
  specialPriceInr: number;
};

export const OORJAMAN_AMC_PLANS_INR: ReadonlyArray<OorjamanAmcPublishedPlan> = [
  { kw: 3, spLabel: "SP-1", visitsLabel: "3 services in 1 year", listPriceInr: 1797, specialPriceInr: 1599 },
  { kw: 3, spLabel: "SP-2", visitsLabel: "6 services in 2 years", listPriceInr: 3594, specialPriceInr: 3199 },
  { kw: 4, spLabel: "SP-1", visitsLabel: "3 services in 1 year", listPriceInr: 2097, specialPriceInr: 1999 },
  { kw: 4, spLabel: "SP-2", visitsLabel: "6 services in 2 years", listPriceInr: 4194, specialPriceInr: 3799 },
  { kw: 5, spLabel: "SP-1", visitsLabel: "3 services in 1 year", listPriceInr: 2397, specialPriceInr: 2299 },
  { kw: 5, spLabel: "SP-2", visitsLabel: "6 services in 2 years", listPriceInr: 4794, specialPriceInr: 4299 },
  { kw: 6, spLabel: "SP-1", visitsLabel: "3 services in 1 year", listPriceInr: 2697, specialPriceInr: 2599 },
  { kw: 6, spLabel: "SP-2", visitsLabel: "6 services in 2 years", listPriceInr: 5394, specialPriceInr: 4999 },
  { kw: 8, spLabel: "SP-1", visitsLabel: "3 services in 1 year", listPriceInr: 3297, specialPriceInr: 2999 },
  { kw: 8, spLabel: "SP-2", visitsLabel: "6 services in 2 years", listPriceInr: 6594, specialPriceInr: 5999 },
  { kw: 10, spLabel: "SP-1", visitsLabel: "3 services in 1 year", listPriceInr: 3897, specialPriceInr: 3599 },
  { kw: 10, spLabel: "SP-2", visitsLabel: "6 services in 2 years", listPriceInr: 7794, specialPriceInr: 7599 },
];

export function formatInrWhole(amountInr: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountInr);
}

export function splitGstFromInclusiveInr(totalInr: number, gstRatePercent = OORJAMAN_GST_RATE_PERCENT) {
  const total = Math.max(0, Math.round(totalInr));
  if (total === 0) return { totalInr: 0, taxableValueInr: 0, gstInr: 0 };
  const rate = gstRatePercent / 100;
  const taxableValueInr = Math.round(total / (1 + rate));
  const gstInr = total - taxableValueInr;
  return { totalInr: total, taxableValueInr, gstInr };
}
