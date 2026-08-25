import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRow } from "../database.types";
import { isAuthSessionMissingError, SupabaseApiError } from "../result";
import { resolveSignInAccountPhone } from "./session-display";

/**
 * `public.users` = auth identity; role tables = profile source of truth.
 * Display labels: sync via `syncUserDisplayName*` in `./user-display-name` after profile updates.
 */

/**
 * Mirror the signed-in auth.users row into public.users (phone/email + verification timestamps).
 * No-op when there is no session. Used after OTP verify and on session restore (incl. dummy password login).
 */
export async function syncMyUserFromAuth(
  client: SupabaseClient<Database>,
): Promise<UserRow | null> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) {
    if (isAuthSessionMissingError(userErr)) return null;
    throw new SupabaseApiError(userErr.message, userErr);
  }
  if (!userData.user?.id) return null;

  const { data, error } = await client.rpc("sync_my_user_from_auth");
  if (error) throw new SupabaseApiError(error.message, error);
  return data;
}

/**
 * Sign-in phone for invite matching and profile UI: syncs `public.users` from auth,
 * then falls back to the live auth session when the mirror row is stale or empty.
 */
export async function getMySignInPhoneE164(
  client: SupabaseClient<Database>,
): Promise<string> {
  try {
    await syncMyUserFromAuth(client);
  } catch {
    /* trigger may still provision; fall through */
  }
  const row = await getMyUserRecord(client);
  const { data: authData, error: authErr } = await client.auth.getUser();
  if (authErr) {
    if (isAuthSessionMissingError(authErr)) {
      return resolveSignInAccountPhone(row, null);
    }
    throw new SupabaseApiError(authErr.message, authErr);
  }
  return resolveSignInAccountPhone(row, authData.user);
}

export async function getMyUserRecord(
  client: SupabaseClient<Database>,
): Promise<UserRow | null> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) {
    if (isAuthSessionMissingError(userErr)) return null;
    throw new SupabaseApiError(userErr.message, userErr);
  }
  const uid = userData.user?.id;
  if (!uid) return null;

  const { data, error } = await client.from("users").select("*").eq("id", uid).maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  return data;
}

/** Wait for `public.users` after sign-in; syncs from auth first, then retries select. */
export async function getMyUserRecordWithRetry(
  client: SupabaseClient<Database>,
  opts?: { attempts?: number; delayMs?: number },
): Promise<UserRow | null> {
  const attempts = opts?.attempts ?? 6;
  const delayMs = opts?.delayMs ?? 200;

  try {
    await syncMyUserFromAuth(client);
  } catch {
    /* trigger may still provision; fall through to retries */
  }

  for (let i = 0; i < attempts; i++) {
    const row = await getMyUserRecord(client);
    if (row) return row;
    if (i < attempts - 1) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }
  }
  return null;
}

export {
  displayNameFromCustomer,
  displayNameFromSupportAgent,
  displayNameFromTechnician,
  displayNameFromVendor,
  normalizeDisplayName,
  syncUserDisplayName,
  syncUserDisplayNameFromCustomer,
  syncUserDisplayNameFromSupportAgent,
  syncUserDisplayNameFromTechnician,
  syncUserDisplayNameFromVendor,
} from "./user-display-name";

/**
 * Request permanent deletion of the signed-in customer account (Edge Function).
 * On success the auth session is invalid — caller must sign out locally.
 */
export async function requestDeleteMyCustomerAccount(
  client: SupabaseClient<Database>,
): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const { data, error } = await client.functions.invoke<{
    ok?: boolean;
    error?: string;
    code?: string;
    already_deleted?: boolean;
  }>("delete-customer-account", { body: {} });

  if (error) {
    return { ok: false, message: error.message };
  }
  if (data && typeof data === "object" && data.ok === false) {
    return {
      ok: false,
      message: typeof data.error === "string" ? data.error : "Account deletion failed.",
      code: typeof data.code === "string" ? data.code : undefined,
    };
  }
  if (data && typeof data === "object" && data.ok === true) {
    return { ok: true };
  }
  return { ok: false, message: "Unexpected response from delete-customer-account." };
}
