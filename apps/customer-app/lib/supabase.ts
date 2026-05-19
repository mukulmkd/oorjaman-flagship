import AsyncStorage from "@react-native-async-storage/async-storage";
import { bootstrapMobileSupabaseAuth, createSupabaseMobileClient } from "@oorjaman/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@oorjaman/api";

const client = createSupabaseMobileClient({ storage: AsyncStorage });

/** Clears invalid refresh tokens once at startup before queries / auto-refresh run. */
export const supabaseAuthReady = client ? bootstrapMobileSupabaseAuth(client) : Promise.resolve(null);

export const supabase: SupabaseClient<Database> | null = client;
