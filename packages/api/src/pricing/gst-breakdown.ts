/** GST rate included in published OorjaMan catalogue prices (India). */
export const INDIAN_GST_RATE_PERCENT = 18;

export type GstInclusiveBreakdown = {
  total_cents: number;
  taxable_value_cents: number;
  gst_cents: number;
  gst_rate_percent: number;
};

/** Split an inclusive INR total (paise) into taxable value + GST. */
export function splitGstFromInclusiveTotal(
  totalCents: number,
  gstRatePercent = INDIAN_GST_RATE_PERCENT,
): GstInclusiveBreakdown {
  const total_cents = Math.max(0, Math.round(totalCents));
  if (total_cents === 0) {
    return {
      total_cents: 0,
      taxable_value_cents: 0,
      gst_cents: 0,
      gst_rate_percent: gstRatePercent,
    };
  }
  const rate = gstRatePercent / 100;
  const taxable_value_cents = Math.round(total_cents / (1 + rate));
  const gst_cents = total_cents - taxable_value_cents;
  return {
    total_cents,
    taxable_value_cents,
    gst_cents,
    gst_rate_percent: gstRatePercent,
  };
}
