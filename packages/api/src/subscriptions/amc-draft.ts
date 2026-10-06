import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";
import { SupabaseApiError } from "../result";

/** Unpaid AMC stays open this long, then it is deactivated and kept. */
export const AMC_DRAFT_OPEN_DAYS = 14;

export function amcDraftMetadata(base: Json | null | undefined, extra?: Record<string, Json>): Json {
  const current =
    base && typeof base === "object" && !Array.isArray(base) ? (base as Record<string, Json>) : {};
  return {
    ...current,
    amc_phase: "draft",
    contract_started: false,
    ...extra,
  };
}

/** Close drafts that have been unpaid for more than 14 days. The row is kept. */
export async function deactivateStaleAmcDrafts(
  client: SupabaseClient<Database>,
): Promise<void> {
  const cutoff = new Date(Date.now() - AMC_DRAFT_OPEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from("subscriptions")
    .select("id, metadata")
    .eq("status", "trialing")
    .lt("created_at", cutoff);
  if (error) throw new SupabaseApiError(error.message, error);

  const closedAt = new Date().toISOString();
  for (const row of data ?? []) {
    const metadata =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, Json>)
        : {};
    const { error: updateError } = await client
      .from("subscriptions")
      .update({
        status: "expired",
        metadata: {
          ...metadata,
          amc_phase: "draft_inactive",
          contract_started: false,
          draft_deactivated_at: closedAt,
          draft_deactivated_reason: "unpaid_14_days",
        },
      })
      .eq("id", row.id)
      .eq("status", "trialing");
    if (updateError) throw new SupabaseApiError(updateError.message, updateError);
  }
}

export function readAmcPhase(metadata: Json | null | undefined): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const phase = (metadata as Record<string, unknown>).amc_phase;
  return typeof phase === "string" && phase.trim() ? phase.trim() : null;
}
