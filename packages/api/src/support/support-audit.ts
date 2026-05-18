import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Json,
  SupportConversationEventRow,
  SupportConversationRow,
} from "../database.types";
import { SupabaseApiError, takeRows } from "../result";
import { supportAgentPublicNameFromUserId } from "./support-audit-helpers";
import { supportCloseReasonLabel, supportResolutionTagLabel } from "./support-desk-labels";

export type SupportConversationActorRole = "desk" | "customer" | "system";

export type SupportConversationEventType =
  | "conversation_started"
  | "claimed"
  | "assigned"
  | "unassigned"
  | "priority_changed"
  | "resolved"
  | "reopened"
  | "escalated"
  | "csat_submitted"
  | "auto_closed_inactivity";

export type SupportConversationEventWithActor = SupportConversationEventRow & {
  actor_display_name: string | null;
};

export async function logSupportConversationEvent(
  client: SupabaseClient<Database>,
  params: {
    conversation_id: string;
    event_type: SupportConversationEventType | string;
    summary: string;
    actor_user_id?: string | null;
    actor_role: SupportConversationActorRole;
    metadata?: Json;
  },
): Promise<void> {
  const { error } = await client.from("support_conversation_events").insert({
    conversation_id: params.conversation_id.trim(),
    actor_user_id: params.actor_user_id ?? null,
    actor_role: params.actor_role,
    event_type: params.event_type,
    summary: params.summary,
    metadata: params.metadata ?? {},
  });
  if (error) throw new SupabaseApiError(error.message, error);
}

export async function listSupportConversationEvents(
  client: SupabaseClient<Database>,
  conversationId: string,
): Promise<SupportConversationEventWithActor[]> {
  const { data, error } = await client
    .from("support_conversation_events")
    .select("*")
    .eq("conversation_id", conversationId.trim())
    .order("created_at", { ascending: true });
  const rows = takeRows(data, error) as SupportConversationEventRow[];

  const actorIds = [...new Set(rows.map((r) => r.actor_user_id).filter(Boolean))] as string[];
  const nameByUserId = new Map<string, string>();
  await Promise.all(
    actorIds.map(async (userId) => {
      const name = await supportAgentPublicNameFromUserId(client, userId);
      nameByUserId.set(userId, name);
    }),
  );

  return rows.map((row) => ({
    ...row,
    actor_display_name:
      row.actor_role === "system"
        ? "System"
        : row.actor_user_id
          ? (nameByUserId.get(row.actor_user_id) ?? "Support specialist")
          : null,
  }));
}

export async function getSupportDeskUserDisplayName(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  return supportAgentPublicNameFromUserId(client, userId);
}

export type SupportConversationClosureSummary = {
  closed_at: string | null;
  closed_by_display_name: string | null;
  close_reason_label: string | null;
  resolution_tag_label: string | null;
  csat: {
    rating: number;
    comment: string | null;
    submitted_at: string;
  } | null;
  pending_csat: boolean;
};

export async function buildSupportConversationClosureSummary(
  client: SupabaseClient<Database>,
  conversation: SupportConversationRow,
): Promise<SupportConversationClosureSummary> {
  let closedByName: string | null = null;
  if (conversation.resolved_by_user_id) {
    closedByName = await supportAgentPublicNameFromUserId(client, conversation.resolved_by_user_id);
  } else if (conversation.status === "resolved" && conversation.close_reason === "inactive_timeout") {
    closedByName = "System (inactivity)";
  }

  const closedAt = conversation.resolved_at ?? (conversation.status === "resolved" ? conversation.updated_at : null);

  const csat =
    conversation.csat_rating != null && conversation.csat_submitted_at
      ? {
          rating: conversation.csat_rating,
          comment: conversation.csat_comment,
          submitted_at: conversation.csat_submitted_at,
        }
      : null;

  return {
    closed_at: closedAt,
    closed_by_display_name: conversation.status === "resolved" ? closedByName : null,
    close_reason_label: supportCloseReasonLabel(conversation.close_reason),
    resolution_tag_label: supportResolutionTagLabel(conversation.resolution_tag),
    csat,
    pending_csat: conversation.status === "resolved" && !conversation.csat_submitted_at,
  };
}
