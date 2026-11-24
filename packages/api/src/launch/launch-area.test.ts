import { describe, expect, it } from "vitest";
import {
  LAUNCH_AREA_UNAVAILABLE_MESSAGE,
  indianPincodeFromAddressJson,
  isActiveLaunchPincode,
} from "./launch-area";

describe("launch-area", () => {
  it("extracts 6-digit Indian pincodes", () => {
    expect(indianPincodeFromAddressJson({ pincode: "110001" })).toBe("110001");
    expect(indianPincodeFromAddressJson({ pincode: 560001 })).toBe("560001");
    expect(indianPincodeFromAddressJson({ pincode: "PIN 560001" })).toBe("560001");
    expect(indianPincodeFromAddressJson({ pincode: "123" })).toBeNull();
    expect(indianPincodeFromAddressJson(null)).toBeNull();
    expect(indianPincodeFromAddressJson([])).toBeNull();
    expect(indianPincodeFromAddressJson("nope")).toBeNull();
  });

  it("checks active launch pins", () => {
    const pins = ["110001", "560001"] as const;
    expect(isActiveLaunchPincode(pins, "110001")).toBe(true);
    expect(isActiveLaunchPincode(pins, "400001")).toBe(false);
    expect(isActiveLaunchPincode(pins, null)).toBe(false);
    expect(LAUNCH_AREA_UNAVAILABLE_MESSAGE.length).toBeGreaterThan(10);
  });
});
