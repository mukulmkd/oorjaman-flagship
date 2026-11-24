import { describe, expect, it } from "vitest";
import type { SubscriptionRow, SubscriptionVisitSlotRow } from "../database.types";
import {
  customerMayBookOneTimeVisit,
  customerMustUseAmcBookingFlow,
  listPendingAmcVisitSlots,
  readServiceAddressIdFromBookingMetadata,
  resolveAmcVisitBookingGate,
} from "./amc-visit-booking-eligibility";

function sub(partial: Partial<SubscriptionRow>): SubscriptionRow {
  return {
    id: "sub-1",
    status: "active",
    visits_included: 4,
    assigned_vendor_id: "vendor-1",
    starts_at: "2026-01-01T00:00:00.000Z",
    ends_at: "2027-01-01T00:00:00.000Z",
    ...partial,
  } as SubscriptionRow;
}

function slot(partial: Partial<SubscriptionVisitSlotRow>): SubscriptionVisitSlotRow {
  return {
    id: "slot-1",
    status: "pending",
    sequence: 1,
    ...partial,
  } as SubscriptionVisitSlotRow;
}

describe("resolveAmcVisitBookingGate", () => {
  it("returns none without an active subscription", () => {
    expect(resolveAmcVisitBookingGate(null, [])).toEqual({ kind: "none" });
    expect(resolveAmcVisitBookingGate(sub({ status: "cancelled" }), [])).toEqual({ kind: "none" });
  });

  it("requires funded wallet and assigned partner for use_amc_slot", () => {
    const slots = [slot({ id: "s1" }), slot({ id: "s2", sequence: 2 })];
    const waitingPayment = resolveAmcVisitBookingGate(sub({}), slots, {
      wallet: { status: "pending_funding" },
    });
    expect(waitingPayment.kind).toBe("awaiting_setup");

    const ready = resolveAmcVisitBookingGate(sub({}), slots, {
      wallet: { status: "funded" },
    });
    expect(ready.kind).toBe("use_amc_slot");
    expect(customerMustUseAmcBookingFlow(ready)).toBe(true);
    expect(customerMayBookOneTimeVisit(ready)).toBe(false);
  });

  it("marks allowance exhausted when no pending slots", () => {
    const gate = resolveAmcVisitBookingGate(sub({ visits_included: 2 }), [], {
      wallet: { status: "funded" },
    });
    expect(gate.kind).toBe("allowance_exhausted");
    expect(customerMayBookOneTimeVisit(gate)).toBe(true);
  });
});

describe("amc helpers", () => {
  it("lists pending slots and reads address metadata", () => {
    expect(
      listPendingAmcVisitSlots([slot({ status: "pending" }), slot({ status: "scheduled" })]),
    ).toHaveLength(1);
    expect(readServiceAddressIdFromBookingMetadata({ service_address_id: " addr-1 " })).toBe("addr-1");
    expect(readServiceAddressIdFromBookingMetadata({})).toBeNull();
  });
});
