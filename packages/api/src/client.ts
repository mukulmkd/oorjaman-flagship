import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { resolveSupabaseCredentials } from "./env";

export type SupabaseCredentials = {
  url: string;
  anonKey: string;
};

/** Matches `@react-native-async-storage/async-storage` - keeps `@oorjaman/api` RN-agnostic. */
export type NativeAuthStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export function createSupabaseClient(creds: SupabaseCredentials): SupabaseClient<Database> {
  return createClient<Database>(creds.url, creds.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

/**
 * React Native / Expo - persists refresh tokens so sessions survive restarts.
 * Call from app entry after `import "react-native-url-polyfill/auto"`.
 */
export function createSupabaseMobileClient(options: {
  storage: NativeAuthStorage;
  viteEnv?: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string };
}): SupabaseClient<Database> | null {
  const creds = resolveSupabaseCredentials(options);
  if (!creds) return null;
  return createClient<Database>(creds.url, creds.anonKey, {
    auth: {
      storage: options.storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Browser / React Native client from environment variables.
 * Expo: set `EXPO_PUBLIC_SUPABASE_*`. Vite: pass `{ viteEnv: import.meta.env }`.
 */
let browserClientSingleton: SupabaseClient<Database> | undefined;
let browserClientSingletonKey: string | undefined;

function browserClientCacheKey(creds: SupabaseCredentials): string {
  return `${creds.url}\0${creds.anonKey}`;
}

/**
 * Browser / Vite client from environment variables.
 *
 * Returns a **process-wide singleton** per URL/key pair so React 18 Strict Mode (double mount)
 * and HMR do not create multiple GoTrue clients competing for the same `localStorage` auth key.
 */
export function createSupabaseBrowserClient(opts?: {
  viteEnv?: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string };
}): SupabaseClient<Database> {
  const creds = resolveSupabaseCredentials(opts);
  if (!creds) {
    throw new Error(
      "Missing Supabase URL/anon key. Set EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY, or pass viteEnv with VITE_* keys.",
    );
  }
  const key = browserClientCacheKey(creds);
  if (!browserClientSingleton || browserClientSingletonKey !== key) {
    browserClientSingleton = createSupabaseClient(creds);
    browserClientSingletonKey = key;
  }
  return browserClientSingleton;
}
