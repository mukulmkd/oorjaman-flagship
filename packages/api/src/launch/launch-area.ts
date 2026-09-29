import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";
import { SupabaseApiError } from "../result";

export const LAUNCH_AREA_UNAVAILABLE_MESSAGE =
  "OorjaMan is expanding to more cities. We will notify you when the service is available in your area.";

export function indianPincodeFromAddressJson(addr: Json | null | undefined): string | null {
  if (!addr || typeof addr !== "object" || Array.isArray(addr)) return null;
  const raw = (addr as Record<string, unknown>).pincode;
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const digits = String(raw).replace(/\D/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

export function isActiveLaunchPincode(pins: readonly string[], pin: string | null): boolean {
  return pin != null && pins.includes(pin);
}

export async function listActiveLaunchPincodes(
  client: SupabaseClient<Database>,
): Promise<string[]> {
  const { data, error } = await client
    .from("launch_service_pincodes")
    .select("pincode")
    .eq("active", true)
    .order("pincode", { ascending: true });

  if (error) throw new SupabaseApiError(error.message, error);
  return (data ?? []).map((row) => row.pincode);
}

export async function assertServiceAddressInLaunchArea(
  client: SupabaseClient<Database>,
  address: Json | null | undefined,
): Promise<void> {
  const pin = indianPincodeFromAddressJson(address ?? null);
  if (!pin) {
    throw new SupabaseApiError(LAUNCH_AREA_UNAVAILABLE_MESSAGE);
  }

  const { data, error } = await client
    .from("launch_service_pincodes")
    .select("pincode")
    .eq("pincode", pin)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new SupabaseApiError(error.message, error);
  if (!data) throw new SupabaseApiError(LAUNCH_AREA_UNAVAILABLE_MESSAGE);
}
