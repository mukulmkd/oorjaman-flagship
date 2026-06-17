import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@oorjaman/api";
import { useSupabase } from "../lib/supabase-client";

/** Refetches partner bookings when dispatch or field crew update visit rows. */
export function VendorBookingRealtime({ vendorId }: { vendorId: string | null | undefined }) {
  const supabase = useSupabase();
  const qc = useQueryClient();

  useEffect(() => {
    if (!supabase || !vendorId) return;
    const client = supabase;

    const topicSuffix =
      typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const topic = `vendor-bookings-${vendorId}-${topicSuffix}`;

    const invalidateBookings = () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
    };

    const channel = client
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => {
          invalidateBookings();
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [vendorId, qc, supabase]);

  return null;
}
