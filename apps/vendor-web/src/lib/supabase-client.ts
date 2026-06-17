import { createContext, useContext } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@oorjaman/api";

export const SupabaseContext = createContext<SupabaseClient<Database> | null>(null);

export function useSupabase(): SupabaseClient<Database> | null {
  return useContext(SupabaseContext);
}
