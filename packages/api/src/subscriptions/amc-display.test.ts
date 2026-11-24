import { describe, expect, it } from "vitest";
import {
  customerBookingDisplayTitle,
  formatAmcVisitLabel,
  isAmcSubscriptionBooking,
  isAmcVisitSlotBookedByCustomer,
  readAmcVisitSequenceFromMetadata,
} from "./amc-display";

describe("amc-display", () => {
  it("formats ordinal visit labels", () => {
    expect(formatAmcVisitLabel(1)).toBe("1st visit");
    expect(formatAmcVisitLabel(2)).toBe("2nd visit");
    expect(formatAmcVisitLabel(3)).toBe("3rd visit");
    expect(formatAmcVisitLabel(4)).toBe("4th visit");
    expect(formatAmcVisitLabel(11)).toBe("11th visit");
    expect(formatAmcVisitLabel(21)).toBe("21st visit");
  });

  it("reads sequence from booking metadata", () => {
    expect(readAmcVisitSequenceFromMetadata({ sequence: 2 })).toBe(2);
    expect(readAmcVisitSequenceFromMetadata({ sequence: "3" })).toBe(3);
    expect(readAmcVisitSequenceFromMetadata({})).toBeNull();
  });

  it("detects AMC booking metadata helpers", () => {
    expect(isAmcSubscriptionBooking({ subscription_id: "sub-1" })).toBe(true);
    expect(isAmcSubscriptionBooking({ subscription_id: null })).toBe(false);
    expect(isAmcVisitSlotBookedByCustomer({ status: "scheduled", booking_id: "b1" })).toBe(true);
    expect(
      customerBookingDisplayTitle({
        subscription_id: "sub-1",
        metadata: { sequence: 2 },
        reference_code: "OM-TEST",
      }),
    ).toContain("visit");
  });
});


