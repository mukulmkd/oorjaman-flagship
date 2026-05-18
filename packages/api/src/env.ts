import type { SupabaseCredentials } from "./client";

const trim = (v: string | undefined) => (v == null ? undefined : v.trim());

function readEnv(key: string): string | undefined {
  const proc = (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process;
  return proc?.env?.[key];
}

/**
 * Expo / Node: `EXPO_PUBLIC_SUPABASE_*` at build time.
 */
export function supabaseCredentialsFromProcessEnv(): SupabaseCredentials | null {
  const url = trim(readEnv("EXPO_PUBLIC_SUPABASE_URL"));
  const anonKey = trim(readEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY"));
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

function mergeProcessAndFrameworkEnv(
  frameworkEnv?: Record<string, string | boolean | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const proc = (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  if (proc) {
    for (const [k, v] of Object.entries(proc)) {
      if (v !== undefined) out[k] = String(v);
    }
  }
  if (frameworkEnv) {
    for (const [k, v] of Object.entries(frameworkEnv)) {
      if (v !== undefined && v !== null) out[k] = String(v);
    }
  }
  return out;
}

/**
 * Resolves dummy-auth flags from `EXPO_PUBLIC_*` / `VITE_*` and optional `frameworkEnv`
 * (pass `import.meta.env` from Vite - it is not visible inside this package otherwise).
 */
export function resolveDummyAuthSettings(
  frameworkEnv?: Record<string, string | boolean | undefined>,
): DummyAuthSettings {
  const env = mergeProcessAndFrameworkEnv(frameworkEnv);
  const enabled = env.EXPO_PUBLIC_USE_DUMMY_AUTH === "true" || env.VITE_USE_DUMMY_AUTH === "true";
  const otpCode = (env.EXPO_PUBLIC_DUMMY_OTP_CODE ?? env.VITE_DUMMY_OTP_CODE ?? "123456").trim();
  const password = (
    env.EXPO_PUBLIC_DUMMY_AUTH_PASSWORD ??
    env.VITE_DUMMY_AUTH_PASSWORD ??
    "TestOtp123!"
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
