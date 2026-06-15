import type { SupabaseCredentials } from "./client";

const trim = (v: string | undefined) => (v == null ? undefined : v.trim());

/**
 * Expo / Node: `EXPO_PUBLIC_SUPABASE_*` at build time.
 *
 * Must use static `process.env.EXPO_PUBLIC_*` property access so Expo's release
 * bundler can inline values into the APK. Dynamic `process.env[key]` is not inlined.
 */
export function supabaseCredentialsFromProcessEnv(): SupabaseCredentials | null {
  const url = trim(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const anonKey = trim(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/**
 * Vite: pass `import.meta.env` from the app (keeps this package free of `import.meta`).
 */
export function supabaseCredentialsFromViteEnv(env: {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}): SupabaseCredentials | null {
  const url = trim(env.VITE_SUPABASE_URL);
  const anonKey = trim(env.VITE_SUPABASE_ANON_KEY);
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/**
 * Prefer Expo env, then Vite-shaped env (when both exist in merged env objects).
 */
export function resolveSupabaseCredentials(
  opts?: { viteEnv?: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string } },
): SupabaseCredentials | null {
  const fromExpo = supabaseCredentialsFromProcessEnv();
  if (fromExpo) return fromExpo;
  if (opts?.viteEnv) {
    return supabaseCredentialsFromViteEnv(opts.viteEnv);
  }
  return null;
}

/** Dev-only: skip real SMS and verify with a fixed OTP + password sign-in (see seed script). */
export type DummyAuthSettings = {
  enabled: boolean;
  otpCode: string;
  password: string;
};

/**
 * Resolves dummy-auth flags from `EXPO_PUBLIC_*` / `VITE_*` and optional `frameworkEnv`
 * (pass `import.meta.env` from Vite - it is not visible inside this package otherwise).
 */
export function resolveDummyAuthSettings(
  frameworkEnv?: Record<string, string | boolean | undefined>,
): DummyAuthSettings {
  const enabled =
    process.env.EXPO_PUBLIC_USE_DUMMY_AUTH === "true" ||
    String(frameworkEnv?.VITE_USE_DUMMY_AUTH ?? "") === "true";
  const otpCode = (
    process.env.EXPO_PUBLIC_DUMMY_OTP_CODE ??
    String(frameworkEnv?.VITE_DUMMY_OTP_CODE ?? "123456")
  ).trim();
  const password = (
    process.env.EXPO_PUBLIC_DUMMY_AUTH_PASSWORD ??
    String(frameworkEnv?.VITE_DUMMY_AUTH_PASSWORD ?? "TestOtp123!")
  ).trim();
  return { enabled, otpCode, password };
}

/** Short message for login screens; `null` when dummy auth is off. */
export function getDummyAuthUiHint(
  frameworkEnv?: Record<string, string | boolean | undefined>,
): string | null {
  const s = resolveDummyAuthSettings(frameworkEnv);
  if (!s.enabled) return null;
  return `Dummy auth: SMS skipped - enter OTP ${s.otpCode}. Re-run npm run seed:dummy-users after updating the seed script so accounts include dummy emails.`;
}
