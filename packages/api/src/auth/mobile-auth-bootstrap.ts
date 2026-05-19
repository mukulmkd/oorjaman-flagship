import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { recoverStoredSupabaseSession } from "./auth-api";

/**
 * Prepare mobile auth on cold start: pause auto-refresh, clear invalid persisted sessions,
 * then return the session (or null). {@link MobileAuthSessionGuard} starts refresh when mounted.
 */
export async function bootstrapMobileSupabaseAuth(
  client: SupabaseClient<Database>,
): Promise<Session | null> {
  try {
    await client.auth.stopAutoRefresh();
  } catch {
    /* no-op on unsupported runtimes */
  }
  return recoverStoredSupabaseSession(client);
}
