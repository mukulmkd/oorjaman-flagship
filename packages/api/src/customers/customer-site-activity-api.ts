import type { SupabaseClient } from "@supabase/supabase-js";
import { listVisibleBookings } from "../bookings/booking-api";
import type { BookingRow, CustomerSiteActivityEventRow, Database } from "../database.types";
import { readBookingServiceAddressId } from "../subscriptions/subscription-address";
import { takeRows } from "../result";

export type { CustomerSiteActivityEventRow, CustomerSiteActivityKind } from "../database.types";

const TRACKABLE_STATUSES = ["accepted"] as const;

function isTrackableBookingRow(b: BookingRow): boolean {
  if (!b.technician_id) return false;
  return b.status === "accepted" && Boolean(b.technician_en_route_at);
}

export function readActivityReferenceCode(event: CustomerSiteActivityEventRow): string | null {
  if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) return null;
  const v = (event.payload as Record<string, unknown>).reference_code;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function isActivityMapTrackable(event: CustomerSiteActivityEventRow): boolean {
  return (
    event.booking_id != null &&
    (event.kind === "booking_status_accepted" ||
      event.kind === "booking_technician_assigned" ||
      event.kind === "booking_technician_en_route")
  );
}

export type CustomerSiteActivityPage = {
  items: CustomerSiteActivityEventRow[];
  hasMore: boolean;
  nextOffset: number;
};

const DEFAULT_ACTIVITY_PAGE_SIZE = 10;

/** Paginated timeline for one service address (newest first). */
export async function listCustomerSiteActivityPageForAddress(
  client: SupabaseClient<Database>,
  params: {
    service_address_id: string;
    offset?: number;
    limit?: number;
  },
): Promise<CustomerSiteActivityPage> {
  const addressId = params.service_address_id.trim();
  if (!addressId) return { items: [], hasMore: false, nextOffset: 0 };

  const offset = Math.max(params.offset ?? 0, 0);
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_ACTIVITY_PAGE_SIZE, 1), 50);
  const fetchLimit = limit + 1;

  const { data, error } = await client
    .from("customer_site_activity_events")
    .select("*")
    .eq("service_address_id", addressId)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + fetchLimit - 1);

  const rows = takeRows(data, error);
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);

  return {
    items: pageRows,
    hasMore,
    nextOffset: offset + pageRows.length,
  };
}

/** @deprecated Prefer {@link listCustomerSiteActivityPageForAddress} for mobile timelines. */
export async function listCustomerSiteActivityForAddress(
  client: SupabaseClient<Database>,
  params: {
    service_address_id: string;
    limit?: number;
  },
): Promise<CustomerSiteActivityEventRow[]> {
  const page = await listCustomerSiteActivityPageForAddress(client, {
    service_address_id: params.service_address_id,
    offset: 0,
    limit: Math.min(Math.max(params.limit ?? 80, 1), 200),
  });
  return page.items;
}

export function bookingMatchesServiceAddress(booking: BookingRow, serviceAddressId: string): boolean {
  const addrId = readBookingServiceAddressId(booking.metadata);
  return addrId === serviceAddressId.trim();
}

/**
 * Active visit at this address where the customer can track the technician on the map.
 */
export async function getTrackableBookingForAddress(
  client: SupabaseClient<Database>,
  serviceAddressId: string,
): Promise<BookingRow | null> {
  const addressId = serviceAddressId.trim();
  if (!addressId) return null;

  const rows = await listVisibleBookings(client, {
    status: [...TRACKABLE_STATUSES],
    limit: 100,
  });

  const atAddress = rows.filter(
    (b) => bookingMatchesServiceAddress(b, addressId) && isTrackableBookingRow(b),
  );
  if (atAddress.length === 0) return null;

  return [...atAddress].sort(
    (a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime(),
  )[0]!;
}

export async function subscribeCustomerSiteActivityForAddress(
  client: SupabaseClient<Database>,
  serviceAddressId: string,
  onChange: () => void,
): Promise<() => void> {
  const addressId = serviceAddressId.trim();
  if (!addressId) return () => {};

  const channel = client
    .channel(`customer-site-activity:${addressId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "customer_site_activity_events",
        filter: `service_address_id=eq.${addressId}`,
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
