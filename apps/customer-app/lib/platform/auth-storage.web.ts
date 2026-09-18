import type { NativeAuthStorage } from "@oorjaman/api";

/**
 * Web: localStorage-backed Supabase auth persistence (CSR only — no cookie SSR).
 */
export const authStorage: NativeAuthStorage = {
  getItem: async (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Quota / private mode — session will be in-memory only for this tab.
    }
  },
  removeItem: async (key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
