import { describe, expect, it } from "vitest";
import { isStoreVersionBelowMinimum } from "./app-update-policy";

describe("isStoreVersionBelowMinimum", () => {
  it("returns false when either side is null", () => {
    expect(isStoreVersionBelowMinimum(null, "1.0.1")).toBe(false);
    expect(isStoreVersionBelowMinimum("1.0.0", null)).toBe(false);
    expect(isStoreVersionBelowMinimum(null, null)).toBe(false);
  });

  it("compares semver numerically", () => {
    expect(isStoreVersionBelowMinimum("1.0.0", "1.0.1")).toBe(true);
    expect(isStoreVersionBelowMinimum("1.0.1", "1.0.1")).toBe(false);
    expect(isStoreVersionBelowMinimum("1.0.2", "1.0.1")).toBe(false);
    expect(isStoreVersionBelowMinimum("1.9.0", "1.10.0")).toBe(true);
    expect(isStoreVersionBelowMinimum("2.0.0", "1.9.9")).toBe(false);
  });
});
