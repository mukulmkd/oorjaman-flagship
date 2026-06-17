import type { SupabaseCredentials } from "./client";

const trim = (v: string | undefined) => (v == null ? undefined : v.trim());

/** Safe in Vite browser builds where `process` is undefined; Expo still inlines static `process.env.EXPO_PUBLIC_*` reads. */
function expoPublicEnv(name: "EXPO_PUBLIC_SUPABASE_URL" | "EXPO_PUBLIC_SUPABASE_ANON_KEY" | "EXPO_PUBLIC_USE_DUMMY_AUTH" | "EXPO_PUBLIC_DUMMY_OTP_CODE" | "EXPO_PUBLIC_DUMMY_AUTH_PASSWORD"): string | undefined {
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
    default:
      return undefined;
  }
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
 */
export function resolveDummyAuthSettings(
  frameworkEnv?: Record<string, string | boolean | undefined>,
): DummyAuthSettings {
  const enabled =
    expoPublicEnv("EXPO_PUBLIC_USE_DUMMY_AUTH") === "true" ||
    String(frameworkEnv?.VITE_USE_DUMMY_AUTH ?? "") === "true";
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
