import { describe, expect, it } from "vitest";
import {
  SAFETY_ITEMS,
  allSafetyChecked,
  emptySafetyRecord,
  toPreStartSafetyAck,
} from "./safety-checklist";

describe("safety-checklist", () => {
  it("starts unchecked and requires every item", () => {
    const empty = emptySafetyRecord();
    expect(SAFETY_ITEMS.length).toBe(4);
    expect(allSafetyChecked(empty)).toBe(false);
    for (const item of SAFETY_ITEMS) {
      empty[item.key] = true;
    }
    expect(allSafetyChecked(empty)).toBe(true);
    expect(toPreStartSafetyAck(empty).ack_ppe_on_site).toBe(true);
  });
});
