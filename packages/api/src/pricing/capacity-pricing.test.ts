import { describe, expect, it } from "vitest";
import {
  capacityKwFromTierCode,
  computeAmcListPriceFromVisitRate,
  isAllowedCapacityKw,
  snapCapacityKwToAllowed,
  tierCodeFromCapacityKw,
} from "./capacity-pricing";

describe("capacity-pricing", () => {
  it("maps tier codes to kW", () => {
    expect(capacityKwFromTierCode("kw_3")).toBe(3);
    expect(capacityKwFromTierCode("unknown")).toBeNull();
  });

  it("snaps near capacities and rejects far ones", () => {
    expect(snapCapacityKwToAllowed(3)).toBe(3);
    expect(snapCapacityKwToAllowed(3.1)).toBe(3);
    expect(isAllowedCapacityKw(7)).toBe(false);
    expect(tierCodeFromCapacityKw(5)).toBe("kw_5");
  });

  it("computes AMC list price from visit rate", () => {
    expect(computeAmcListPriceFromVisitRate(10000, 4)).toBe(40000);
  });

  it("treats null is_active as active catalog rows", async () => {
    const { isPricingCatalogRowActive } = await import("./capacity-pricing");
    expect(isPricingCatalogRowActive(null)).toBe(true);
    expect(isPricingCatalogRowActive(undefined)).toBe(true);
    expect(isPricingCatalogRowActive(false)).toBe(false);
  });
});

