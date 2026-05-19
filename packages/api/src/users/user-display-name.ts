import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerRow, Database, SupportAgentRow, TechnicianRow, VendorRow } from "../database.types";
import { SupabaseApiError } from "../result";

/**
 * Identity vs profile: `public.users` mirrors auth (id, role, phone, email).
 * Role tables hold editable profile fields; call these helpers after profile writes
 * so `users.full_name` and (when self) auth `user_metadata.full_name` stay aligned.
 */

/** Trimmed display label or null when empty. */
export function normalizeDisplayName(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function displayNameFromCustomer(row: Pick<CustomerRow, "display_name">): string | null {
  return normalizeDisplayName(row.display_name);
}

export function displayNameFromTechnician(row: Pick<TechnicianRow, "name_as_per_aadhaar">): string | null {
  return normalizeDisplayName(row.name_as_per_aadhaar);
}

export function displayNameFromVendor(
  row: Pick<VendorRow, "trade_name" | "business_name">,
): string | null {
  return normalizeDisplayName(row.trade_name) ?? normalizeDisplayName(row.business_name);
}

export function displayNameFromSupportAgent(row: Pick<SupportAgentRow, "display_name">): string | null {
  return normalizeDisplayName(row.display_name);
}

/**
 * Copy role-profile display name into `public.users.full_name`.
 * When the session user matches `userId`, also updates auth `user_metadata.full_name`
 * so `sync_my_user_from_auth` stays aligned after OTP login.
 */
export async function syncUserDisplayName(
  client: SupabaseClient<Database>,
  userId: string,
  displayName: string | null | undefined,
  options?: { syncAuthMetadata?: boolean },
): Promise<void> {
  const name = normalizeDisplayName(displayName);
  if (!name) return;

  const { error } = await client.from("users").update({ full_name: name }).eq("id", userId);
  if (error) throw new SupabaseApiError(error.message, error);

  const shouldSyncAuth = options?.syncAuthMetadata !== false;
  if (!shouldSyncAuth) return;

  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || userData.user?.id !== userId) return;

  const { error: metaErr } = await client.auth.updateUser({
    data: { full_name: name },
  });
  if (metaErr) {
    throw new SupabaseApiError(metaErr.message, metaErr);
  }
}

export async function syncUserDisplayNameFromCustomer(
  client: SupabaseClient<Database>,
  customer: Pick<CustomerRow, "user_id" | "display_name">,
): Promise<void> {
  await syncUserDisplayName(client, customer.user_id, displayNameFromCustomer(customer));
}

export async function syncUserDisplayNameFromTechnician(
  client: SupabaseClient<Database>,
  technician: Pick<TechnicianRow, "user_id" | "name_as_per_aadhaar">,
): Promise<void> {
  await syncUserDisplayName(client, technician.user_id, displayNameFromTechnician(technician));
}

export async function syncUserDisplayNameFromVendor(
  client: SupabaseClient<Database>,
  vendor: Pick<VendorRow, "user_id" | "trade_name" | "business_name">,
): Promise<void> {
  await syncUserDisplayName(client, vendor.user_id, displayNameFromVendor(vendor));
}

export async function syncUserDisplayNameFromSupportAgent(
  client: SupabaseClient<Database>,
  agent: Pick<SupportAgentRow, "user_id" | "display_name">,
): Promise<void> {
  await syncUserDisplayName(client, agent.user_id, displayNameFromSupportAgent(agent));
}
