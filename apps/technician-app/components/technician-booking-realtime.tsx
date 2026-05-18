import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@oorjaman/api";
import { supabase } from "../lib/supabase";

/** Refetch assigned bookings when dispatch updates rows for this technician. */
export function TechnicianBookingRealtime({ technicianId }: { technicianId: string | undefined }) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!supabase || !technicianId) return;
    const client = supabase;
    const topicSuffix =
      typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const topic = `technician-bookings-${technicianId}-${topicSuffix}`;

    const channel = client
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `technician_id=eq.${technicianId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [technicianId, qc]);

  return null;
}
