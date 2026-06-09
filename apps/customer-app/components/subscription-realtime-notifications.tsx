import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubscriptionRow } from "@oorjaman/api";
import { queryKeys, subscriptionApi } from "@oorjaman/api";
import { notifyCustomerAmcPartnerAssigned } from "@oorjaman/ui";
import { supabase } from "../lib/supabase";

type Snapshot = Pick<SubscriptionRow, "id" | "assigned_vendor_id" | "status">;

/**
 * Subscribes to subscription updates for this customer and notifies when an AMC partner is assigned.
 */
export function SubscriptionRealtimeNotifications({ customerId }: { customerId: string | undefined }) {
  const qc = useQueryClient();
  const snapRef = useRef<Map<string, Snapshot>>(new Map());

  const seedQuery = useQuery({
    queryKey: customerId ? [...queryKeys.subscriptions.all(), "notify-seed", customerId] : [],
    queryFn: () => subscriptionApi.listVisibleSubscriptions(supabase!),
    enabled: Boolean(supabase && customerId),
  });

  useEffect(() => {
    const rows = seedQuery.data;
    if (!rows) return;
    for (const sub of rows) {
      snapRef.current.set(sub.id, {
        id: sub.id,
        assigned_vendor_id: sub.assigned_vendor_id,
        status: sub.status,
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
    const topic = `customer-subscriptions-${customerId}-${topicSuffix}`;

    const invalidateSubscriptions = () => {
      void qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all() });
    };

    const channel = client
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "subscriptions",
          filter: `customer_id=eq.${customerId}`,
        },
        (payload) => {
          const row = payload.new as SubscriptionRow | null;
          if (!row?.id) return;

          const prev = snapRef.current.get(row.id);
          snapRef.current.set(row.id, {
            id: row.id,
            assigned_vendor_id: row.assigned_vendor_id,
            status: row.status,
          });

          invalidateSubscriptions();

          if (!prev?.assigned_vendor_id && row.assigned_vendor_id) {
            void notifyCustomerAmcPartnerAssigned(row.id);
          }
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [customerId, qc, seedQuery.isSuccess]);

  return null;
}
