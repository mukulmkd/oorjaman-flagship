import { describe, expect, it, vi } from "vitest";
import type { BookingRow } from "@oorjaman/api";
import { filterBookingsBySegment, pickNextJob, sortBookingsForSegment } from "./job-list-filters";

vi.mock("./booking-display", () => ({
  todayIstDayKey: () => "2026-11-12",
  formatJobDayKey: (iso: string) => iso.slice(0, 10),
}));

function booking(partial: Partial<BookingRow> & { id: string; status: BookingRow["status"]; scheduled_start: string }): BookingRow {
  return partial as BookingRow;
}

describe("job-list-filters", () => {
  const rows = [
    booking({ id: "today", status: "accepted", scheduled_start: "2026-11-12T10:00:00.000Z" }),
    booking({ id: "later", status: "accepted", scheduled_start: "2026-11-14T10:00:00.000Z" }),
    booking({ id: "active", status: "in_progress", scheduled_start: "2026-11-12T08:00:00.000Z" }),
    booking({ id: "done", status: "completed", scheduled_start: "2026-11-10T10:00:00.000Z" }),
  ];

  it("filters by segment", () => {
    expect(filterBookingsBySegment(rows, "today").map((r) => r.id)).toEqual(
      expect.arrayContaining(["today", "active"]),
    );
    expect(filterBookingsBySegment(rows, "upcoming").map((r) => r.id)).toEqual(["later"]);
    expect(filterBookingsBySegment(rows, "active").map((r) => r.id)).toEqual(["active"]);
    expect(filterBookingsBySegment(rows, "completed").map((r) => r.id)).toEqual(["done"]);
  });

  it("prefers in-progress for next job", () => {
    expect(pickNextJob(rows)?.id).toBe("active");
  });

  it("sorts completed newest first", () => {
    const sorted = sortBookingsForSegment(
      [
        booking({ id: "a", status: "completed", scheduled_start: "2026-11-01T00:00:00.000Z" }),
        booking({ id: "b", status: "completed", scheduled_start: "2026-11-10T00:00:00.000Z" }),
      ],
      "completed",
    );
    expect(sorted.map((r) => r.id)).toEqual(["b", "a"]);
  });
});
