import { describe, expect, it } from "vitest";
import {
  AFTERNOON_FIRST_SLOT_HOUR_IST,
  addCalendarDaysIST,
  isEveningBookingCutoff,
  istDayKeyFromDate,
  minSelectableDayKey,
  slotsForDay,
} from "./booking-slots";

/** Fixed IST wall times via +05:30 offset. */
function istDate(isoLocal: string): Date {
  return new Date(isoLocal);
}

describe("booking-slots IST rules", () => {
  it("detects evening cutoff at/after 19:00 IST", () => {
    expect(isEveningBookingCutoff(istDate("2026-11-12T18:59:00+05:30"))).toBe(false);
    expect(isEveningBookingCutoff(istDate("2026-11-12T19:00:00+05:30"))).toBe(true);
    expect(isEveningBookingCutoff(istDate("2026-11-12T22:15:00+05:30"))).toBe(true);
  });

  it("after 7 PM earliest day is tomorrow", () => {
    const now = istDate("2026-11-12T19:30:00+05:30");
    expect(istDayKeyFromDate(now)).toBe("2026-11-12");
    expect(minSelectableDayKey(now)).toBe("2026-11-13");
    expect(addCalendarDaysIST("2026-11-12", 1)).toBe("2026-11-13");
  });

  it("same-day slots before cutoff respect 2h lead time", () => {
    const now = istDate("2026-11-12T10:00:00+05:30");
    const today = "2026-11-12";
    const slots = slotsForDay(today, now);
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(new Date(slot.scheduledStart).getTime()).toBeGreaterThanOrEqual(
        now.getTime() + 2 * 60 * 60 * 1000,
      );
    }
  });

  it("first day after evening cutoff only offers afternoon slots", () => {
    const now = istDate("2026-11-12T20:00:00+05:30");
    const tomorrow = minSelectableDayKey(now);
    const slots = slotsForDay(tomorrow, now);
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      const hour = Number(slot.id.slice(-4, -2));
      expect(hour).toBeGreaterThanOrEqual(AFTERNOON_FIRST_SLOT_HOUR_IST);
    }
  });
});
