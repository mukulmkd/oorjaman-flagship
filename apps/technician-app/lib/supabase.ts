import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSupabaseMobileClient, recoverStoredSupabaseSession } from "@oorjaman/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@oorjaman/api";

const client = createSupabaseMobileClient({ storage: AsyncStorage });

/** Clear invalid persisted refresh tokens before background auto-refresh logs errors. */
if (client) {
  void recoverStoredSupabaseSession(client);
}

export const supabase: SupabaseClient<Database> | null = client;
