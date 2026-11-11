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
  /** Set once this device OTA supports visit lifecycle remote push. */
  visit_push_enabled_at: string | null;
};

/**
 * Capability flag for visit lifecycle remote push (confirm / tech / en route /
 * complete / cancel / reschedule). Older app binaries omit this and keep legacy
 * support/AMC/tech-change pushes only.
 */
export const CUSTOMER_VISIT_PUSH_ENABLED = true;

export async function upsertCustomerPushToken(
  client: SupabaseClient<Database>,
  params: {
    expo_push_token: string;
    platform?: CustomerPushPlatform;
    /** When true, stamps visit_push_enabled_at so the server may enqueue visit pushes. */
    visit_push_enabled?: boolean;
  },
): Promise<CustomerPushTokenRow> {
  const token = params.expo_push_token.trim();
  if (!token) throw new SupabaseApiError("Push token is empty.");

  const { data, error } = await client.rpc("upsert_customer_push_token", {
    p_expo_push_token: token,
    p_platform: params.platform ?? "unknown",
    p_visit_push_enabled: params.visit_push_enabled ?? false,
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
