import type { Json, SupportConversationRow, SupportMessageRow } from "../database.types";

export type SupportMessageEventKind =
  | "agent_joined"
  | "agent_transferred"
  | "agent_left_queue"
  | "generic";

function metadataRecord(metadata: Json | null | undefined): Record<string, unknown> | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  return metadata as Record<string, unknown>;
}

export function parseSupportMessageEvent(message: SupportMessageRow): SupportMessageEventKind {
  if (message.sender_role !== "system") return "generic";
  const event = metadataRecord(message.metadata)?.event;
  if (event === "agent_joined" || event === "agent_transferred" || event === "agent_left_queue") {
    return event;
  }
  return "generic";
}

export function supportAgentNameFromMessage(message: SupportMessageRow): string | null {
  const name = metadataRecord(message.metadata)?.agent_display_name;
  if (typeof name === "string" && name.trim()) return name.trim();
  return null;
}

/** Subtitle under the thread title in the customer support sheet. */
export function supportThreadSubtitleForCustomer(
  conversation: Pick<SupportConversationRow, "status" | "assigned_admin_user_id">,
  assignedAgentName: string | null,
): string {
  if (conversation.status === "resolved") return "This conversation is closed";
  if (conversation.status === "queued") {
    return "Waiting for support — we typically reply during business hours";
  }
  if (conversation.assigned_admin_user_id && assignedAgentName) {
    return `${assignedAgentName} is helping you`;
  }
  if (conversation.status === "active") return "In progress";
  return "Support chat";
}
