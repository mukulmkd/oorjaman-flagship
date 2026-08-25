import type { SupabaseClient } from "@supabase/supabase-js";
import { authPhoneFromUser, resolvePortalSessionDisplay } from "./session-display";
import { getMyUserRecord } from "./user-api";

/** Portal top bar — never leaves "Checking session…" if profile fetch fails. */
export async function loadPortalSessionDisplay(
  supabase: SupabaseClient,
  options?: { unsignedHint?: string },
): Promise<{ hint: string; chip: string }> {
  const unsignedHint = options?.unsignedHint ?? "Sign in required.";
  try {
    const { data } = await supabase.auth.getSession();
    const u = data.session?.user;
    if (!u) {
      return { hint: unsignedHint, chip: "?" };
    }
    let row: Awaited<ReturnType<typeof getMyUserRecord>> = null;
    try {
      row = await getMyUserRecord(supabase);
    } catch {
      // Fall back to auth identity when public.users is missing or unreachable.
    }
    return resolvePortalSessionDisplay({
      authEmail: u.email,
      authPhone: authPhoneFromUser(u),
      authUserId: u.id,
      publicFullName: row?.full_name,
      publicEmail: row?.email,
    });
  } catch {
    return { hint: "Session unavailable", chip: "?" };
  }
}
