import { describe, expect, it } from "vitest";
import type { VendorRow } from "../database.types";
import { resolveBookingVendor } from "./vendor-fallback";

function vendor(partial: Partial<VendorRow> & { id: string }): VendorRow {
  return {
    status: "approved",
    service_areas: null,
    ...partial,
  } as VendorRow;
}

describe("resolveBookingVendor", () => {
  const signals = { pincode: "560001", city: "Bengaluru", state: "Karnataka" };

  it("keeps preferred when eligible", () => {
    const preferred = vendor({ id: "v1" });
    const result = resolveBookingVendor({
      requestedVendorId: "v1",
      customerFallbackVendorId: "v2",
      platformDefaultVendorId: "v3",
      signals,
      approvedVendors: [preferred],
    });
    expect(result).toMatchObject({
      resolvedVendorId: "v1",
      usedFallback: false,
      reason: "preferred_ok",
    });
  });

  it("falls back to customer then platform default", () => {
    const preferred = vendor({
      id: "v1",
      service_areas: ["110001"],
    });
    const customerFb = vendor({ id: "v2" });
    const platform = vendor({ id: "v3" });

    const viaCustomer = resolveBookingVendor({
      requestedVendorId: "v1",
      customerFallbackVendorId: "v2",
      platformDefaultVendorId: "v3",
      signals,
      approvedVendors: [preferred, customerFb, platform],
    });
    expect(viaCustomer.resolvedVendorId).toBe("v2");
    expect(viaCustomer.usedFallback).toBe(true);

    const viaPlatform = resolveBookingVendor({
      requestedVendorId: "v1",
      customerFallbackVendorId: null,
      platformDefaultVendorId: "v3",
      signals,
      approvedVendors: [preferred, platform],
    });
    expect(viaPlatform.resolvedVendorId).toBe("v3");
  });

  it("throws when no eligible vendor remains", () => {
    const preferred = vendor({ id: "v1", service_areas: ["110001"] });
    expect(() =>
      resolveBookingVendor({
        requestedVendorId: "v1",
        customerFallbackVendorId: null,
        platformDefaultVendorId: null,
        signals,
        approvedVendors: [preferred],
      }),
    ).toThrow(/No partner covers/);
  });
});
