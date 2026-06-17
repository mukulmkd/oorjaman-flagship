import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@oorjaman/api";
import { useSupabase } from "../lib/supabase-client";

/**
 * Refetches Finance settlements when OorjaMan approves, settles, or inserts payout rows.
 * Requires `vendor_settlements` on the `supabase_realtime` publication.
 */
export function VendorSettlementRealtime({ vendorId }: { vendorId: string | null | undefined }) {
  const supabase = useSupabase();
  const qc = useQueryClient();

  useEffect(() => {
    if (!supabase || !vendorId) return;
    const client = supabase;

    const topicSuffix =
      typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const topic = `vendor-settlements-${vendorId}-${topicSuffix}`;

    const invalidateSettlements = () => {
      void qc.invalidateQueries({
        queryKey: queryKeys.vendors.dashboardSettlements(),
        refetchType: "active",
      });
    };

    const channel = client
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vendor_settlements",
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => {
          invalidateSettlements();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "vendor_settlements",
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => {
          invalidateSettlements();
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [vendorId, qc, supabase]);

  return null;
}
