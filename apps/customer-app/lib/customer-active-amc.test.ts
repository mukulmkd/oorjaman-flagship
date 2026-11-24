import { describe, expect, it } from "vitest";
import type { CustomerRow, SubscriptionRow } from "@oorjaman/api";
import { activeSubscriptionForCurrentServiceSite } from "./customer-active-amc";

describe("activeSubscriptionForCurrentServiceSite", () => {
  it("returns null without subscriptions or address book", () => {
    expect(activeSubscriptionForCurrentServiceSite(null, [])).toBeNull();
    expect(activeSubscriptionForCurrentServiceSite({} as CustomerRow, null)).toBeNull();
  });

  it("resolves active sub for default service address", () => {
    const customer = {
      id: "c1",
      metadata: {
        default_service_address_id: "addr-1",
        service_addresses: [
          {
            id: "addr-1",
            label: "Home",
            address: { line1: "1 Main" },
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    } as unknown as CustomerRow;

    const active = {
      id: "sub-1",
      status: "active",
      service_address_id: "addr-1",
      starts_at: "2026-01-01T00:00:00.000Z",
      ends_at: "2027-01-01T00:00:00.000Z",
    } as SubscriptionRow;

    const other = {
      id: "sub-2",
      status: "active",
      service_address_id: "addr-2",
      starts_at: "2026-01-01T00:00:00.000Z",
      ends_at: "2027-01-01T00:00:00.000Z",
    } as SubscriptionRow;

    expect(activeSubscriptionForCurrentServiceSite(customer, [other, active])?.id).toBe("sub-1");
  });
});
