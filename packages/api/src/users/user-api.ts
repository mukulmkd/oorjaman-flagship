import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRow } from "../database.types";
import { isAuthSessionMissingError, SupabaseApiError } from "../result";

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
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}
