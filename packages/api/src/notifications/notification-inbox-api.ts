import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationEventRow } from "../database.types";
import type { InAppNotificationPayload, NotificationAudience } from "./booking-notifications";
import { SupabaseApiError, takeRows } from "../result";

const IN_APP_CHANNEL = "in_app";

/** PostgREST `cs` on jsonb columns requires JSON array syntax (`["in_app"]`), not `{in_app}`. */
function jsonbChannelsContain(channel: string): string {
  return JSON.stringify([channel]);
}

export function parseInAppNotificationPayload(payload: unknown): InAppNotificationPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  const bookingId = typeof p.booking_id === "string" ? p.booking_id : null;
  const title = typeof p.title === "string" ? p.title : null;
  const body = typeof p.body === "string" ? p.body : null;
  if (!bookingId || !title || !body) return null;
  return {
    reference_code: typeof p.reference_code === "string" ? p.reference_code : null,
    booking_id: bookingId,
    title,
    body,
    href: typeof p.href === "string" ? p.href : null,
    vendor_id: typeof p.vendor_id === "string" ? p.vendor_id : null,
    vendor_name: typeof p.vendor_name === "string" ? p.vendor_name : null,
    technician_id: typeof p.technician_id === "string" ? p.technician_id : null,
    technician_name: typeof p.technician_name === "string" ? p.technician_name : null,
    status: typeof p.status === "string" ? p.status : null,
    emitted_at: typeof p.emitted_at === "string" ? p.emitted_at : new Date().toISOString(),
    note: typeof p.note === "string" ? p.note : null,
  };
}

function rowHasInAppChannel(channels: unknown): boolean {
  if (!Array.isArray(channels)) return false;
  return channels.some((c) => c === IN_APP_CHANNEL);
}

export async function listInAppNotifications(
  client: SupabaseClient<Database>,
  input: {
    audience: NotificationAudience;
    limit?: number;
    unreadOnly?: boolean;
  },
): Promise<NotificationEventRow[]> {
  const limit = input.limit ?? 40;
  let q = client
    .from("notification_events")
    .select("*")
    .eq("recipient_audience", input.audience)
    .filter("channels", "cs", jsonbChannelsContain(IN_APP_CHANNEL))
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.unreadOnly) {
    q = q.is("read_at", null);
  }

  const { data, error } = await q;
  const rows = takeRows(data, error);
  return rows.filter((r) => rowHasInAppChannel(r.channels));
}

export async function countUnreadInAppNotifications(
  client: SupabaseClient<Database>,
  audience: NotificationAudience,
): Promise<number> {
  const { count, error } = await client
    .from("notification_events")
    .select("id", { head: true, count: "exact" })
    .eq("recipient_audience", audience)
    .filter("channels", "cs", jsonbChannelsContain(IN_APP_CHANNEL))
    .is("read_at", null);
  if (error) throw new SupabaseApiError(error.message, error);
  return count ?? 0;
}

export async function markNotificationRead(
  client: SupabaseClient<Database>,
  eventId: string,
): Promise<NotificationEventRow> {
  const { data, error } = await client.rpc("mark_notification_read", { p_event_id: eventId });
  if (error) throw new SupabaseApiError(error.message, error);
  if (!data) throw new SupabaseApiError("Notification not found.");
  return data;
}

export async function markAllNotificationsRead(
  client: SupabaseClient<Database>,
  audience: NotificationAudience,
): Promise<number> {
  const { data, error } = await client.rpc("mark_all_notifications_read", { p_audience: audience });
  if (error) throw new SupabaseApiError(error.message, error);
  return typeof data === "number" ? data : 0;
}

export function subscribeInAppNotifications(
  client: SupabaseClient<Database>,
  input: {
    audience: NotificationAudience;
    vendorId?: string | null;
    onInsert: (row: NotificationEventRow) => void;
  },
): RealtimeChannel {
  const topic = `in-app-notifications:${input.audience}:${input.vendorId ?? "all"}:${Date.now()}`;
  const filter =
    input.audience === "vendor" && input.vendorId
      ? `recipient_vendor_id=eq.${input.vendorId}`
      : `recipient_audience=eq.admin`;

  const channel = client
    .channel(topic)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notification_events",
        filter,
      },
      (payload) => {
        const row = payload.new as NotificationEventRow;
        if (row.recipient_audience !== input.audience) return;
        if (input.audience === "vendor" && input.vendorId && row.recipient_vendor_id !== input.vendorId) {
          return;
        }
        if (!rowHasInAppChannel(row.channels)) return;
        input.onInsert(row);
      },
    )
    .subscribe();

  return channel;
}

export function unsubscribeNotificationChannel(
  client: SupabaseClient<Database>,
  channel: RealtimeChannel,
): void {
  void client.removeChannel(channel);
}
