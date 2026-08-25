/** Published OorjaMan catalogue prices (INR). GST 18% is included in all amounts. */
export const OORJAMAN_GST_RATE_PERCENT = 18;

export const OORJAMAN_ONE_TIME_VISIT_PRICES_INR: ReadonlyArray<{ kw: number; priceInr: number }> = [
  { kw: 3, priceInr: 619 },
  { kw: 4, priceInr: 719 },
  { kw: 5, priceInr: 819 },
  { kw: 6, priceInr: 929 },
  { kw: 8, priceInr: 1129 },
  { kw: 9, priceInr: 1229 },
  { kw: 10, priceInr: 1339 },
];

export type OorjamanAmcPublishedPlan = {
  kw: number;
  spLabel: "SP-1" | "SP-2";
  visitsLabel: string;
  listPriceInr: number;
  specialPriceInr: number;
};

export const OORJAMAN_AMC_PLANS_INR: ReadonlyArray<OorjamanAmcPublishedPlan> = [
  { kw: 3, spLabel: "SP-1", visitsLabel: "3 services in 1 year", listPriceInr: 1857, specialPriceInr: 1639 },
  { kw: 3, spLabel: "SP-2", visitsLabel: "6 services in 2 years", listPriceInr: 3714, specialPriceInr: 3279 },
  { kw: 4, spLabel: "SP-1", visitsLabel: "3 services in 1 year", listPriceInr: 2157, specialPriceInr: 2049 },
  { kw: 4, spLabel: "SP-2", visitsLabel: "6 services in 2 years", listPriceInr: 4314, specialPriceInr: 3899 },
  { kw: 5, spLabel: "SP-1", visitsLabel: "3 services in 1 year", listPriceInr: 2457, specialPriceInr: 2359 },
  { kw: 5, spLabel: "SP-2", visitsLabel: "6 services in 2 years", listPriceInr: 4914, specialPriceInr: 4409 },
  { kw: 6, spLabel: "SP-1", visitsLabel: "3 services in 1 year", listPriceInr: 2787, specialPriceInr: 2669 },
  { kw: 6, spLabel: "SP-2", visitsLabel: "6 services in 2 years", listPriceInr: 5574, specialPriceInr: 5129 },
  { kw: 8, spLabel: "SP-1", visitsLabel: "3 services in 1 year", listPriceInr: 3387, specialPriceInr: 3079 },
  { kw: 8, spLabel: "SP-2", visitsLabel: "6 services in 2 years", listPriceInr: 6774, specialPriceInr: 6149 },
  { kw: 10, spLabel: "SP-1", visitsLabel: "3 services in 1 year", listPriceInr: 4017, specialPriceInr: 3689 },
  { kw: 10, spLabel: "SP-2", visitsLabel: "6 services in 2 years", listPriceInr: 8034, specialPriceInr: 7789 },
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
