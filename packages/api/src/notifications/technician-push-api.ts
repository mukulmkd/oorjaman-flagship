import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { SupabaseApiError, takeSingleRow } from "../result";
import type { CustomerPushPlatform } from "./customer-push-api";

export type TechnicianPushTokenRow = {
  id: string;
  user_id: string;
  technician_id: string;
  expo_push_token: string;
  platform: CustomerPushPlatform;
  app_slug: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export async function upsertTechnicianPushToken(
  client: SupabaseClient<Database>,
  params: { expo_push_token: string; platform?: CustomerPushPlatform },
): Promise<TechnicianPushTokenRow> {
  const token = params.expo_push_token.trim();
  if (!token) throw new SupabaseApiError("Push token is empty.");

  const { data, error } = await client.rpc("upsert_technician_push_token", {
    p_expo_push_token: token,
    p_platform: params.platform ?? "unknown",
  });
  return takeSingleRow(data as TechnicianPushTokenRow | null, error);
}

export async function removeTechnicianPushToken(
  client: SupabaseClient<Database>,
  expoPushToken: string,
): Promise<void> {
  const token = expoPushToken.trim();
  if (!token) return;
  const { error } = await client.from("technician_push_tokens").delete().eq("expo_push_token", token);
  if (error) throw new SupabaseApiError(error.message, error);
}
