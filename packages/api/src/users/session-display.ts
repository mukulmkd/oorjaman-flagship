import type { User } from "@supabase/supabase-js";
import type { UserRow } from "../database.types";
import { isDummyAuthEmail, normalizePhoneE164 } from "../auth/auth-identity";

function pickDisplayEmail(...candidates: (string | null | undefined)[]): string | null {
  for (const raw of candidates) {
    const email = raw?.trim();
    if (email && !isDummyAuthEmail(email)) return email;
  }
  return null;
}

/** Phone from Supabase Auth session (direct field, then sign-up metadata). */
export function authPhoneFromUser(authUser: User | null | undefined): string | null {
  if (!authUser) return null;
  const direct = authUser.phone?.trim();
  if (direct) return direct;
  const meta = authUser.user_metadata?.phone;
  if (typeof meta === "string" && meta.trim()) return meta.trim();
  return null;
}

/** Sign-in phone for profile UI: `public.users` after auth sync, then auth session. */
export function resolveSignInAccountPhone(
  publicUser: UserRow | null | undefined,
  authUser: User | null | undefined,
): string {
  const raw = publicUser?.phone?.trim() || authPhoneFromUser(authUser) || "";
  if (!raw) return "";
  return normalizePhoneE164(raw);
}

/** Sign-in email for profile UI — hides dummy-auth synthetic addresses. */
export function resolveSignInAccountEmail(
  publicUser: UserRow | null | undefined,
  authUser: User | null | undefined,
): string {
  return pickDisplayEmail(publicUser?.email, authUser?.email) ?? "";
}

/**
 * Customer contact mobile for crews / ops / invoices.
 * Prefer `customers.alternate_phone` (profile); fall back to Auth/`users.phone` for legacy phone-OTP accounts.
 */
export function resolveCustomerContactPhone(
  customer: { alternate_phone?: string | null } | null | undefined,
  publicUser?: { phone?: string | null } | null,
  authUser?: User | null,
): string {
  const fromProfile = customer?.alternate_phone?.trim();
  if (fromProfile) {
    const digits = fromProfile.replace(/\D/g, "");
    if (digits.length >= 10) {
      return fromProfile.startsWith("+") ? fromProfile : normalizePhoneE164(fromProfile);
    }
    return fromProfile;
  }
  const fromAuthMirror = publicUser?.phone?.trim() || authPhoneFromUser(authUser) || "";
  if (!fromAuthMirror) return "";
  return normalizePhoneE164(fromAuthMirror);
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
