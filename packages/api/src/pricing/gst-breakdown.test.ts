import { describe, expect, it } from "vitest";
import { splitGstFromInclusiveTotal } from "./gst-breakdown";

describe("splitGstFromInclusiveTotal", () => {
  it("returns zeros for empty total", () => {
    expect(splitGstFromInclusiveTotal(0)).toEqual({
      total_cents: 0,
      taxable_value_cents: 0,
      gst_cents: 0,
      gst_rate_percent: 18,
    });
  });

  it("splits 18% inclusive totals so parts sum to total", () => {
    const b = splitGstFromInclusiveTotal(11800);
    expect(b.total_cents).toBe(11800);
    expect(b.taxable_value_cents + b.gst_cents).toBe(11800);
    expect(b.gst_rate_percent).toBe(18);
    expect(b.taxable_value_cents).toBe(10000);
    expect(b.gst_cents).toBe(1800);
  });
});
