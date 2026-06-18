import type { ReactNode } from "react";
import { useMemo } from "react";
import { createSupabaseBrowserClient } from "@oorjaman/api";
import { SupabaseContext } from "./supabase-client";

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    try {
      return createSupabaseBrowserClient({
        viteEnv: {
          VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
          VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });
    } catch {
      return null;
    }
  }, []);

  return <SupabaseContext.Provider value={client}>{children}</SupabaseContext.Provider>;
}
