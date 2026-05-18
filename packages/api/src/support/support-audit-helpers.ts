import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { SupabaseApiError } from "../result";

/** Display name for support desk audit / closure (users + support_agents). */
export async function supportAgentPublicNameFromUserId(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: agent } = await client
    .from("support_agents")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  const agentName = agent?.display_name?.trim();
  if (agentName) return agentName;

  const { data: user, error } = await client
    .from("users")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  const full = user?.full_name?.trim();
  if (full) return full;
  const email = user?.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "Support specialist";
}
