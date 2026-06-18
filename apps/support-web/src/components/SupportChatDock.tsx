import { useQuery } from "@tanstack/react-query";
import { queryKeys, supportApi } from "@oorjaman/api";
import { useActiveChat } from "../lib/use-active-chat";
import { useSupabase } from "@oorjaman/web-ui";
import { SupportChatPanel } from "./SupportChatPanel";
import "./support-chat-dock.css";

export function SupportChatDock() {
  const supabase = useSupabase();
  const { conversationId, dockState, closeChat, minimizeChat, expandChat } = useActiveChat();

  const conversationQ = useQuery({
    queryKey: conversationId ? queryKeys.support.conversation(conversationId) : [],
    queryFn: () => supportApi.getSupportConversationForDeskWithParticipant(supabase!, conversationId!),
    enabled: Boolean(supabase && conversationId),
  });

  if (!conversationId || dockState === "hidden") {
    return null;
  }

  const conv = conversationQ.data;
  const name = conv ? supportApi.supportParticipantDisplayName(conv) : "Support chat";
  const audienceLabel = conv
    ? supportApi.supportParticipantAudienceLabel(conv.participant_audience)
    : null;
  const subject = conv?.subject ?? conv?.category_slug ?? "Support chat";
  const isLive = conv?.status === "queued" || conv?.status === "active";

  if (dockState === "minimized") {
    return (
      <div className="support-chat-dock support-chat-dock-minimized">
        <button
          type="button"
          className="support-chat-dock-launcher"
          onClick={expandChat}
          aria-label={`Open chat with ${name}`}
        >
          <span className="support-chat-dock-launcher-dot" aria-hidden />
          <span className="support-chat-dock-launcher-text">
            <strong>{name}</strong>
            {audienceLabel ? (
              <span className="support-chat-dock-audience">{audienceLabel}</span>
            ) : null}
            <span>{subject}</span>
          </span>
        </button>
        <button
          type="button"
          className="support-chat-dock-close"
          onClick={closeChat}
          aria-label="Close chat"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="support-chat-dock support-chat-dock-expanded" role="dialog" aria-label="Active support chat">
      <header className="support-chat-dock-bar">
        <button type="button" className="support-chat-dock-bar-main" onClick={minimizeChat}>
          <span className="support-chat-dock-launcher-dot" aria-hidden />
          <span className="support-chat-dock-bar-title">
            <strong>{name}</strong>
            {audienceLabel ? (
              <span className="support-chat-dock-audience">{audienceLabel}</span>
            ) : null}
            <span>{isLive ? "Live chat" : conv?.status ?? "Chat"}</span>
          </span>
        </button>
        <div className="support-chat-dock-bar-actions">
          <button type="button" className="support-chat-dock-icon-btn" onClick={minimizeChat} title="Minimize">
            −
          </button>
          <button type="button" className="support-chat-dock-icon-btn" onClick={closeChat} title="Close">
            ×
          </button>
        </div>
      </header>
      <div className="support-chat-dock-body">
        <SupportChatPanel conversationId={conversationId} playSoundOnMessage={false} compact />
      </div>
    </div>
  );
}
