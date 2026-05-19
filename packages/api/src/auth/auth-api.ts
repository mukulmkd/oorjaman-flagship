import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { resolveDummyAuthSettings } from "../env";
import { SupabaseApiError } from "../result";
import { syncMyUserFromAuth } from "../users/user-api";

/** Normalize typed mobile input toward E.164 (defaults 10-digit local numbers to `+91…`). */
export function normalizePhoneE164(raw: string, defaultCc = "91"): string {
  const trimmed = raw.trim().replace(/[\s-]/g, "");
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.startsWith(defaultCc) && digitsOnly.length >= defaultCc.length + 8) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.length === 10) {
    return `+${defaultCc}${digitsOnly}`;
  }
  return `+${digitsOnly}`;
}

/**
 * Synthetic email used only for dummy auth password sign-in (must match `seed-dummy-test-users.mjs`).
 * Supabase often rejects `signInWithPassword({ phone })` with 422; email + password is reliable.
 */
export function dummyEmailFromPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `u${digits}@oorjaman-dummy.test`;
}

/** Dev-only synthetic emails; not shown as a verified contact in product UI. */
export function isDummyAuthEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith("@oorjaman-dummy.test");
}

async function syncPublicUserAfterAuth(client: SupabaseClient<Database>): Promise<void> {
  try {
    await syncMyUserFromAuth(client);
  } catch {
    /* post-auth routes retry provisioning; do not fail login */
  }
}

/**
 * Phone OTP - requires Auth "Phone" provider enabled in Supabase (OorjaManDB).
 */
export async function requestPhoneOtp(
  client: SupabaseClient<Database>,
  phone: string,
  options?: {
    shouldCreateUser?: boolean;
    channel?: "sms" | "whatsapp";
    /** Applied on first sign-up as `raw_user_meta_data` (e.g. `{ role: "vendor" }`). */
    data?: Record<string, unknown>;
    /** Pass `import.meta.env` from Vite (admin-web) so dummy auth flags apply. */
    frameworkEnv?: Record<string, string | boolean | undefined>;
  },
) {
  const dummy = resolveDummyAuthSettings(options?.frameworkEnv);
  if (dummy.enabled) {
    return { user: null, session: null };
  }
  const { data, error } = await client.auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: options?.shouldCreateUser ?? true,
      channel: options?.channel ?? "sms",
      data: options?.data,
    },
  });
  if (error) throw new SupabaseApiError(error.message, error);
  return data;
}

export async function verifyPhoneOtp(
  client: SupabaseClient<Database>,
  phone: string,
  token: string,
  options?: {
    type?: "sms" | "phone_change";
    /** Pass `import.meta.env` from Vite (admin-web) so dummy auth flags apply. */
    frameworkEnv?: Record<string, string | boolean | undefined>;
  },
) {
  const dummy = resolveDummyAuthSettings(options?.frameworkEnv);
  if (dummy.enabled && token.trim() === dummy.otpCode) {
    const { data, error } = await client.auth.signInWithPassword({
      email: dummyEmailFromPhoneE164(phone),
      password: dummy.password,
    });
    if (error) throw new SupabaseApiError(error.message, error);
    await syncPublicUserAfterAuth(client);
    return data;
  }
  const { data, error } = await client.auth.verifyOtp({
    phone,
    token,
    type: options?.type ?? "sms",
  });
  if (error) throw new SupabaseApiError(error.message, error);
  await syncPublicUserAfterAuth(client);
  return data;
}

/**
 * Email OTP / magic link - requires email provider configuration in Supabase.
 */
export async function requestEmailOtp(
  client: SupabaseClient<Database>,
  email: string,
  options?: {
    shouldCreateUser?: boolean;
    /** Applied on first sign-up as `raw_user_meta_data` (e.g. `{ role: "vendor" }`). */
    data?: Record<string, unknown>;
  },
) {
  const { data, error } = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: options?.shouldCreateUser ?? true,
      data: options?.data,
    },
  });
  if (error) throw new SupabaseApiError(error.message, error);
  return data;
}

export async function verifyEmailOtp(client: SupabaseClient<Database>, email: string, token: string) {
  const { data, error } = await client.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) throw new SupabaseApiError(error.message, error);
  await syncPublicUserAfterAuth(client);
  return data;
}

/** Call while signed in (e.g. after phone OTP) to start linking / confirming this email on the account. */
export async function updateAuthenticatedUserEmail(client: SupabaseClient<Database>, email: string) {
  const trimmed = email.trim().toLowerCase();
  const { error } = await client.auth.updateUser({ email: trimmed });
  if (error) throw new SupabaseApiError(error.message, error);
}

/** OTP from the email sent after `updateAuthenticatedUserEmail` (email change / confirmation flow). */
export async function verifyEmailChangeOtp(client: SupabaseClient<Database>, email: string, token: string) {
  const { data, error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: "email_change",
  });
  if (error) throw new SupabaseApiError(error.message, error);
  await syncPublicUserAfterAuth(client);
  return data;
}

export async function resendEmailChangeOtp(client: SupabaseClient<Database>, email: string) {
  const { error } = await client.auth.resend({
    type: "email_change",
    email: email.trim().toLowerCase(),
  });
  if (error) throw new SupabaseApiError(error.message, error);
}

export async function signOut(client: SupabaseClient<Database>): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw new SupabaseApiError(error.message, error);
}

export function isInvalidRefreshTokenError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  return /invalid refresh token/i.test(message) || /refresh token not found/i.test(message);
}

/** Clear locally persisted auth when the refresh token was revoked or is from another project. */
export async function clearInvalidStoredSession(client: SupabaseClient<Database>): Promise<void> {
  try {
    await client.auth.signOut({ scope: "local" });
  } catch {
    /* best-effort */
  }
}

/**
 * Load persisted session; if the refresh token is invalid, wipe local auth and return null
 * (avoids uncaught refresh errors on app start).
 */
export async function recoverStoredSupabaseSession(
  client: SupabaseClient<Database>,
): Promise<Session | null> {
  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      if (isInvalidRefreshTokenError(error)) {
        await clearInvalidStoredSession(client);
        return null;
      }
      throw new SupabaseApiError(error.message, error);
    }
    if (data.session) {
      const { error: userError } = await client.auth.getUser();
      if (userError && isInvalidRefreshTokenError(userError)) {
        await clearInvalidStoredSession(client);
        return null;
      }
      await syncPublicUserAfterAuth(client);
    }
    return data.session;
  } catch (e) {
    if (isInvalidRefreshTokenError(e)) {
      await clearInvalidStoredSession(client);
      return null;
    }
    throw e;
  }
}

export async function getSession(client: SupabaseClient<Database>) {
  return recoverStoredSupabaseSession(client);
}

export async function getCurrentUser(client: SupabaseClient<Database>) {
  const { data, error } = await client.auth.getUser();
  if (error) {
    if (isInvalidRefreshTokenError(error) || error.message === "Auth session missing!") {
      await clearInvalidStoredSession(client);
      throw new SupabaseApiError("Your session has expired. Please sign in again.", error);
    }
    throw new SupabaseApiError(error.message, error);
  }
  return data.user;
}
