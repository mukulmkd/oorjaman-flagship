import type { SupabaseCredentials } from "./client";

const trim = (v: string | undefined) => (v == null ? undefined : v.trim());

/** Safe in Vite browser builds where `process` is undefined; Expo still inlines static `process.env.EXPO_PUBLIC_*` reads. */
function expoPublicEnv(name: "EXPO_PUBLIC_SUPABASE_URL" | "EXPO_PUBLIC_SUPABASE_ANON_KEY" | "EXPO_PUBLIC_USE_DUMMY_AUTH" | "EXPO_PUBLIC_DUMMY_OTP_CODE" | "EXPO_PUBLIC_DUMMY_AUTH_PASSWORD" | "EXPO_PUBLIC_DEPLOY_ENV"): string | undefined {
  if (typeof process === "undefined") return undefined;
  switch (name) {
    case "EXPO_PUBLIC_SUPABASE_URL":
      return trim(process.env.EXPO_PUBLIC_SUPABASE_URL);
    case "EXPO_PUBLIC_SUPABASE_ANON_KEY":
      return trim(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
    case "EXPO_PUBLIC_USE_DUMMY_AUTH":
      return trim(process.env.EXPO_PUBLIC_USE_DUMMY_AUTH);
    case "EXPO_PUBLIC_DUMMY_OTP_CODE":
      return trim(process.env.EXPO_PUBLIC_DUMMY_OTP_CODE);
    case "EXPO_PUBLIC_DUMMY_AUTH_PASSWORD":
      return trim(process.env.EXPO_PUBLIC_DUMMY_AUTH_PASSWORD);
    case "EXPO_PUBLIC_DEPLOY_ENV":
      return trim(process.env.EXPO_PUBLIC_DEPLOY_ENV);
    default:
      return undefined;
  }
}

/** UAT project. Login against this host always uses the shared code, never Auth email or SMS. */
const UAT_SUPABASE_HOST = "caearbriteguqjvnbrcg.supabase.co";
/** Production project. Shared-code login is never used against this host. */
const PRODUCTION_SUPABASE_HOST = "nppfpegqnmclbcmmogux.supabase.co";

function supabaseUrl(frameworkEnv?: Record<string, string | boolean | undefined>): string {
  return (
    expoPublicEnv("EXPO_PUBLIC_SUPABASE_URL") ??
    String(frameworkEnv?.VITE_SUPABASE_URL ?? "")
  )
    .trim()
    .toLowerCase();
}

/**
 * True when this build targets PRODUCTION (Expo `EXPO_PUBLIC_DEPLOY_ENV` / Vite `VITE_DEPLOY_ENV`).
 * Used as a hard safety gate so dummy auth can never be active in production, regardless of the
 * dummy-auth flag. Local/UAT (or unset) are treated as non-production so dummy auth still works.
 */
function isProductionDeploy(frameworkEnv?: Record<string, string | boolean | undefined>): boolean {
  const raw = (
    expoPublicEnv("EXPO_PUBLIC_DEPLOY_ENV") ??
    String(frameworkEnv?.VITE_DEPLOY_ENV ?? "")
  )
    .trim()
    .toLowerCase();
  return raw === "production" || raw === "prod";
}

/**
 * Expo / Node: `EXPO_PUBLIC_SUPABASE_*` at build time.
 *
 * Must use static `process.env.EXPO_PUBLIC_*` property access so Expo's release
 * bundler can inline values into the APK. Dynamic `process.env[key]` is not inlined.
 */
export function supabaseCredentialsFromProcessEnv(): SupabaseCredentials | null {
  const url = expoPublicEnv("EXPO_PUBLIC_SUPABASE_URL");
  const anonKey = expoPublicEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");
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
 *
 * UAT database logins always use the shared code. Email and phone both sign in with that
 * password and do not call Auth OTP, so no login email or SMS is sent.
 */
export function resolveDummyAuthSettings(
  frameworkEnv?: Record<string, string | boolean | undefined>,
): DummyAuthSettings {
  const url = supabaseUrl(frameworkEnv);
  const uatDatabase = url.includes(UAT_SUPABASE_HOST);
  const productionDatabase = url.includes(PRODUCTION_SUPABASE_HOST);
  const flagEnabled =
    expoPublicEnv("EXPO_PUBLIC_USE_DUMMY_AUTH") === "true" ||
    String(frameworkEnv?.VITE_USE_DUMMY_AUTH ?? "") === "true";
  // UAT host forces the shared code even if the flag is missing.
  // Production host and production deploy never use it.
  const enabled =
    uatDatabase ||
    (flagEnabled && !isProductionDeploy(frameworkEnv) && !productionDatabase);
  const otpCode = (
    expoPublicEnv("EXPO_PUBLIC_DUMMY_OTP_CODE") ??
    String(frameworkEnv?.VITE_DUMMY_OTP_CODE ?? "123456")
  ).trim();
  const password = (
    expoPublicEnv("EXPO_PUBLIC_DUMMY_AUTH_PASSWORD") ??
    String(frameworkEnv?.VITE_DUMMY_AUTH_PASSWORD ?? "TestOtp123!")
  ).trim();
  return { enabled, otpCode, password };
}
