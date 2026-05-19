import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { SupabaseApiError, takeSingleRow } from "../result";

export type CustomerPushPlatform = "ios" | "android" | "unknown";

export type CustomerPushTokenRow = {
  id: string;
  user_id: string;
  customer_id: string;
  expo_push_token: string;
  platform: CustomerPushPlatform;
  app_slug: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export async function upsertCustomerPushToken(
  client: SupabaseClient<Database>,
  params: { expo_push_token: string; platform?: CustomerPushPlatform },
): Promise<CustomerPushTokenRow> {
  const token = params.expo_push_token.trim();
  if (!token) throw new SupabaseApiError("Push token is empty.");

  const { data, error } = await client.rpc("upsert_customer_push_token", {
    p_expo_push_token: token,
    p_platform: params.platform ?? "unknown",
  });
  return takeSingleRow(data as CustomerPushTokenRow | null, error);
}

export async function removeCustomerPushToken(
  client: SupabaseClient<Database>,
  expoPushToken: string,
): Promise<void> {
  const token = expoPushToken.trim();
  if (!token) return;
  const { error } = await client.from("customer_push_tokens").delete().eq("expo_push_token", token);
  if (error) throw new SupabaseApiError(error.message, error);
}
