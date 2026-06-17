import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ActiveChatCtx, type SupportChatDockState } from "./active-chat-context-internal";

export function ActiveChatProvider({ children }: { children: ReactNode }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [dockState, setDockState] = useState<SupportChatDockState>("hidden");

  const isLiveChat = useCallback((status: string) => status === "queued" || status === "active", []);

  const openChat = useCallback((id: string, options?: { expand?: boolean }) => {
    setConversationId(id);
    setDockState(options?.expand === false ? "minimized" : "expanded");
  }, []);

  const closeChat = useCallback(() => {
    setConversationId(null);
    setDockState("hidden");
  }, []);

  const minimizeChat = useCallback(() => {
    setDockState(conversationId ? "minimized" : "hidden");
  }, [conversationId]);

  const expandChat = useCallback(() => {
    if (conversationId) setDockState("expanded");
  }, [conversationId]);

  const value = useMemo(
    () => ({
      conversationId,
      dockState,
      openChat,
      closeChat,
      minimizeChat,
      expandChat,
      isLiveChat,
    }),
    [conversationId, dockState, openChat, closeChat, minimizeChat, expandChat, isLiveChat],
  );

  return <ActiveChatCtx.Provider value={value}>{children}</ActiveChatCtx.Provider>;
}
