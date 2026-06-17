import type { SupportChatDockState } from "./active-chat-context-internal";

/** Desk toast/sound only when the agent is not actively reading this thread in the expanded dock. */
export function shouldDeskNotifyForConversation(
  dockState: SupportChatDockState,
  activeConversationId: string | null,
  targetConversationId: string,
): boolean {
  return !(dockState === "expanded" && activeConversationId === targetConversationId);
}
