import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRow } from "../database.types";
import { isDummyAuthEmail } from "../auth/auth-api";
import { getMyUserRecord } from "./user-api";

function pickDisplayEmail(...candidates: (string | null | undefined)[]): string | null {
  for (const raw of candidates) {
    const email = raw?.trim();
    if (email && !isDummyAuthEmail(email)) return email;
  }
  return null;
}

/** Portal top-bar label: prefer public profile name/email over synthetic auth email. */
export function resolvePortalSessionDisplay(input: {
  authEmail?: string | null;
  authPhone?: string | null;
  authUserId: string;
  publicFullName?: string | null;
  publicEmail?: string | null;
}): { hint: string; chip: string } {
  const name = input.publicFullName?.trim() || "";
  const email = pickDisplayEmail(input.publicEmail, input.authEmail);
  const phone = input.authPhone?.trim() || null;

  const hint =
    name && email
      ? `${name} · ${email}`
      : name && phone
        ? `${name} · ${phone}`
        : name || email || phone || input.authUserId.slice(0, 8);

  const chip = name
    ? name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("") || "?"
    : (email || phone || input.authUserId).trim().slice(0, 2).toUpperCase() || "?";

  return { hint, chip };
}

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
    let row: UserRow | null = null;
    try {
      row = await getMyUserRecord(supabase);
    } catch {
      // Fall back to auth identity when public.users is missing or unreachable.
    }
    return resolvePortalSessionDisplay({
      authEmail: u.email,
      authPhone: u.phone,
      authUserId: u.id,
      publicFullName: row?.full_name,
      publicEmail: row?.email,
    });
  } catch {
    return { hint: "Session unavailable", chip: "?" };
  }
}
