import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationEventRow } from "../database.types";
import { offsetRangeForPage, type PagedParams, type PagedResult } from "../page-range";
import { SupabaseApiError, takeRows } from "../result";

export async function adminListNotificationEvents(
  client: SupabaseClient<Database>,
  limit = 200,
): Promise<NotificationEventRow[]> {
  const { data, error } = await client
    .from("notification_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return takeRows(data, error);
}

export async function adminListNotificationEventsPaged(
  client: SupabaseClient<Database>,
  params: PagedParams,
): Promise<PagedResult<NotificationEventRow>> {
  const { from, to } = offsetRangeForPage(params.page, params.pageSize);
  const { data, error, count } = await client
    .from("notification_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  return { rows: takeRows(data, error), total: count ?? 0 };
}

export async function adminProcessNotificationQueue(
  client: SupabaseClient<Database>,
  payload?: { limit?: number },
): Promise<{
  ok: boolean;
  processed: number;
  sent: number;
  failed: number;
  queued: number;
}> {
  const { data, error } = await client.functions.invoke("process-notification-events", {
    body: { limit: payload?.limit ?? 50 },
  });
  if (error) throw new SupabaseApiError(error.message, error);
  if (!data || typeof data !== "object") {
    throw new SupabaseApiError("Invalid processor response.");
  }
  const out = data as Record<string, unknown>;
  return {
    ok: out.ok === true,
    processed: Number(out.processed ?? 0),
    sent: Number(out.sent ?? 0),
    failed: Number(out.failed ?? 0),
    queued: Number(out.queued ?? 0),
  };
}
