import { describe, expect, it } from "vitest";
import {
  normalizeVendorIfsc,
  normalizeVendorPan,
  validateVendorGstin,
  validateVendorIfsc,
  validateVendorPan,
  validateVendorPincode,
} from "./vendor-intake-validation";

describe("vendor-intake-validation", () => {
  it("normalizes and validates PAN", () => {
    expect(normalizeVendorPan(" abcde1234f ")).toBe("ABCDE1234F");
    expect(validateVendorPan("ABCDE1234F")).toBeNull();
    expect(validateVendorPan("BAD")).not.toBeNull();
  });

  it("validates GSTIN and IFSC", () => {
    expect(validateVendorGstin("29ABCDE1234F1Z5")).toBeNull();
    expect(validateVendorGstin("invalid")).not.toBeNull();
    expect(normalizeVendorIfsc("hdfc 0001234")).toBe("HDFC0001234");
    expect(validateVendorIfsc("HDFC0001234")).toBeNull();
    expect(validateVendorIfsc("HDFC")).not.toBeNull();
  });

  it("validates pincode", () => {
    expect(validateVendorPincode("560001")).toBeNull();
    expect(validateVendorPincode("56")).not.toBeNull();
  });

  it("rejects empty required fields", () => {
    expect(validateVendorPan("")).not.toBeNull();
    expect(validateVendorGstin("")).not.toBeNull();
    expect(validateVendorIfsc("")).not.toBeNull();
    expect(validateVendorPincode("")).not.toBeNull();
  });
});

