import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BookingRow } from "@oorjaman/api";
import { bookingApi, queryKeys } from "@oorjaman/api";
import {
  notifyCustomerBookingAccepted,
  notifyCustomerJobCompleted,
  notifyCustomerTechnicianAssigned,
} from "@oorjaman/ui";
import { supabase } from "../lib/supabase";

type Snapshot = Pick<BookingRow, "id" | "status" | "technician_id" | "vendor_id">;

/**
 * Subscribes to booking row updates for this customer: refreshes list/detail queries and
 * fires local notifications on meaningful transitions.
 * Requires `bookings` on the `supabase_realtime` publication (see supabase migration).
 */
export function BookingRealtimeNotifications({ customerId }: { customerId: string | undefined }) {
  const qc = useQueryClient();
  const snapRef = useRef<Map<string, Snapshot>>(new Map());

  const seedQuery = useQuery({
    queryKey: customerId ? [...queryKeys.bookings.all(), "notify-seed", customerId] : [],
    queryFn: () => bookingApi.listVisibleBookings(supabase!, {}),
    enabled: Boolean(supabase && customerId),
  });

  useEffect(() => {
    const rows = seedQuery.data;
    if (!rows) return;
    for (const b of rows) {
      snapRef.current.set(b.id, {
        id: b.id,
        status: b.status,
        technician_id: b.technician_id,
        vendor_id: b.vendor_id,
      });
    }
  }, [seedQuery.data]);

  useEffect(() => {
    if (!supabase || !customerId || !seedQuery.isSuccess) return;
    const client = supabase;

    const topicSuffix =
      typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const topic = `customer-bookings-${customerId}-${topicSuffix}`;

    const invalidateBookings = () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
    };

    const channel = client
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `customer_id=eq.${customerId}`,
        },
        (payload) => {
          const row = payload.new as BookingRow | null;
          if (!row?.id) return;

          const prev = snapRef.current.get(row.id);
          snapRef.current.set(row.id, {
            id: row.id,
            status: row.status,
            technician_id: row.technician_id,
            vendor_id: row.vendor_id,
          });

          invalidateBookings();

          if (!prev) return;

          if (row.status === "accepted" && prev.status === "confirmed") {
            void notifyCustomerBookingAccepted(row.id);
          }
          if (!prev.technician_id && row.technician_id) {
            void notifyCustomerTechnicianAssigned(row.id);
          }
          if (prev.status !== "completed" && row.status === "completed") {
            void notifyCustomerJobCompleted(row.id);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bookings",
          filter: `customer_id=eq.${customerId}`,
        },
        () => {
          invalidateBookings();
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [customerId, qc, seedQuery.isSuccess, supabase]);

  return null;
}
