import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

/**
 * Subscribe to live changes on public.bookings (INSERT / UPDATE / DELETE).
 *
 * `public.bookings` is already in the `supabase_realtime` publication
 * (migration 20260602120000_bookings_realtime_publication.sql), so admin
 * clients receive row changes made by any actor (vendor accept, technician
 * complete, routing fallback, etc.) without polling. RLS still applies — the
 * signed-in admin only receives rows they can read.
 *
 * The caller decides what to do on each change (typically: invalidate the
 * admin booking/ops React Query caches). Payload is intentionally opaque here
 * so callers stay decoupled from row shape.
 */
export function subscribeAdminBookingChanges(
  client: SupabaseClient<Database>,
  onChange: () => void,
): RealtimeChannel {
  const topic = `admin-bookings:${Date.now()}`;
  return client
    .channel(topic)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "bookings" },
      () => onChange(),
    )
    .subscribe();
}

/** Tear down a booking realtime channel (safe to call on unmount). */
export function unsubscribeBookingChannel(
  client: SupabaseClient<Database>,
  channel: RealtimeChannel,
): void {
  void client.removeChannel(channel);
}
