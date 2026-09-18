import { bootstrapMobileSupabaseAuth, createSupabaseMobileClient } from "@oorjaman/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@oorjaman/api";
import { authStorage } from "./platform/auth-storage";

const client = createSupabaseMobileClient({ storage: authStorage });

/** Clears invalid refresh tokens once at startup before queries / auto-refresh run. */
export const supabaseAuthReady = client ? bootstrapMobileSupabaseAuth(client) : Promise.resolve(null);

export const supabase: SupabaseClient<Database> | null = client;
