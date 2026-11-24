import { describe, expect, it } from "vitest";
import type { SubscriptionRow } from "../database.types";
import { computeAmcVisitSlots } from "./amc-booking-generation";

describe("computeAmcVisitSlots", () => {
  it("returns empty when no visits included", () => {
    expect(
      computeAmcVisitSlots({
        visits_included: 0,
        starts_at: "2026-01-01T00:00:00.000Z",
        ends_at: "2027-01-01T00:00:00.000Z",
      } as SubscriptionRow),
    ).toEqual([]);
  });

  it("spaces visits across the contract window", () => {
    const slots = computeAmcVisitSlots({
      visits_included: 4,
      starts_at: "2026-01-01T00:00:00.000Z",
      ends_at: "2027-01-01T00:00:00.000Z",
    } as SubscriptionRow);
    expect(slots).toHaveLength(4);
    for (const s of slots) {
      expect(new Date(s.scheduled_end).getTime()).toBeGreaterThan(new Date(s.scheduled_start).getTime());
    }
    expect(new Date(slots[0]!.scheduled_start).getTime()).toBeLessThan(
      new Date(slots[3]!.scheduled_start).getTime(),
    );
  });
});
