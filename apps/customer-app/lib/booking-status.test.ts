import { describe, expect, it } from "vitest";
import { bookingStatusLabel, bookingUiBucket, isValidBookingRow } from "./booking-status";

describe("booking-status", () => {
  it("buckets DB statuses for customer UI", () => {
    expect(bookingUiBucket("pending_payment")).toBe("pending");
    expect(bookingUiBucket("accepted")).toBe("accepted");
    expect(bookingUiBucket("in_progress")).toBe("accepted");
    expect(bookingUiBucket("completed")).toBe("completed");
    expect(bookingUiBucket("cancelled")).toBe("ended");
  });

  it("labels reflect technician / en-route context", () => {
    expect(bookingStatusLabel("confirmed")).toBe("Awaiting partner");
    expect(bookingStatusLabel("confirmed", { status: "confirmed", vendor_id: "v1", technician_id: null, technician_en_route_at: null })).toBe(
      "Partner confirming",
    );
    expect(
      bookingStatusLabel("accepted", {
        status: "accepted",
        vendor_id: "v1",
        technician_id: "t1",
        technician_en_route_at: "2026-11-12T10:00:00.000Z",
      }),
    ).toBe("Technician on the way");
  });

  it("validates booking rows", () => {
    expect(isValidBookingRow(null)).toBe(false);
    expect(isValidBookingRow({ id: "b1", status: "accepted" } as never)).toBe(true);
  });
});
