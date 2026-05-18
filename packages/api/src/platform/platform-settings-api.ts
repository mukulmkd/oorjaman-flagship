import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PlatformSettingsRow } from "../database.types";
import { SupabaseApiError, takeSingleRow } from "../result";

/**
 * Public defaults for customer booking (requires authenticated session; RLS select all).
 */
export async function getBookingRoutingDefaults(
  client: SupabaseClient<Database>,
): Promise<{
  defaultVendorId: string | null;
  customerLateCancelFeePaise: number;
}> {
  const { data, error } = await client
    .from("platform_settings")
    .select("default_vendor_id, customer_late_cancel_fee_paise")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new SupabaseApiError(error.message, error);
  const fee = Math.max(0, Math.round(Number(data?.customer_late_cancel_fee_paise) || 0));
  return {
    defaultVendorId: data?.default_vendor_id ?? null,
    customerLateCancelFeePaise: Number.isFinite(fee) ? fee : 0,
  };
}

export async function adminGetPlatformSettings(
  client: SupabaseClient<Database>,
): Promise<PlatformSettingsRow | null> {
  const { data, error } = await client.from("platform_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  return data;
}

export async function adminSetDefaultVendor(
  client: SupabaseClient<Database>,
  defaultVendorId: string | null,
): Promise<PlatformSettingsRow> {
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id ?? null;

  const { data, error } = await client
    .from("platform_settings")
    .update({
      default_vendor_id: defaultVendorId,
      updated_by: uid,
    })
    .eq("id", 1)
    .select()
    .single();

  return takeSingleRow(data, error);
}

export async function adminUpdatePlatformSettings(
  client: SupabaseClient<Database>,
  input: Partial<Pick<PlatformSettingsRow, "default_vendor_id" | "customer_late_cancel_fee_paise">>,
): Promise<PlatformSettingsRow> {
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id ?? null;

  const row: Database["public"]["Tables"]["platform_settings"]["Update"] = { updated_by: uid };
  if (input.default_vendor_id !== undefined) {
    row.default_vendor_id = input.default_vendor_id;
  }
  if (input.customer_late_cancel_fee_paise !== undefined) {
    row.customer_late_cancel_fee_paise = Math.max(
      0,
      Math.round(Number(input.customer_late_cancel_fee_paise) || 0),
    );
  }

  const { data, error } = await client
    .from("platform_settings")
    .update(row)
    .eq("id", 1)
    .select()
    .single();

  return takeSingleRow(data, error);
}
