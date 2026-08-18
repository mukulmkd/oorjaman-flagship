import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeAdminBookingChanges, unsubscribeBookingChannel } from "@oorjaman/api";
import { useSupabase } from "@oorjaman/web-ui";
import { invalidateAdminBookingOpsQueries } from "../lib/invalidate-admin-queries";

/**
 * Live-refresh all admin booking/ops views when any booking row changes (vendor accept,
 * technician complete, routing fallback, etc.) — without polling. Mount once in the admin
 * shell (DashboardLayout). Invalidation only force-refetches the queries currently on screen;
 * other booking views are marked stale and refetch when next opened.
 */
export function useAdminBookingsRealtime(): void {
  const supabase = useSupabase();
  const qc = useQueryClient();

  useEffect(() => {
    if (!supabase) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const channel = subscribeAdminBookingChanges(supabase, () => {
      // Debounce bursts (bulk status updates) into a single refetch.
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void invalidateAdminBookingOpsQueries(qc);
      }, 400);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribeBookingChannel(supabase, channel);
    };
  }, [supabase, qc]);
}
