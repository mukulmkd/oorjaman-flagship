import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationChannelSettingRow } from "../database.types";
import { takeRows, takeSingleRow } from "../result";

export async function adminListNotificationChannelSettings(
  client: SupabaseClient<Database>,
): Promise<NotificationChannelSettingRow[]> {
  const { data, error } = await client
    .from("notification_channel_settings")
    .select("*")
    .order("event_type", { ascending: true })
    .order("channel", { ascending: true });
  return takeRows(data, error);
}

export async function adminUpdateNotificationChannelSetting(
  client: SupabaseClient<Database>,
  settingId: string,
  patch: Database["public"]["Tables"]["notification_channel_settings"]["Update"],
): Promise<NotificationChannelSettingRow> {
  const { data, error } = await client
    .from("notification_channel_settings")
    .update(patch)
    .eq("id", settingId)
    .select("*")
    .single();
  return takeSingleRow(data, error);
}
