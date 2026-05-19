import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SupportChatDockState = "hidden" | "minimized" | "expanded";

type ActiveChatContextValue = {
  conversationId: string | null;
  dockState: SupportChatDockState;
  /** Open or switch active chat (expands dock for live chats). */
  openChat: (conversationId: string, options?: { expand?: boolean }) => void;
  closeChat: () => void;
  minimizeChat: () => void;
  expandChat: () => void;
  isLiveChat: (status: string) => boolean;
};

const ActiveChatCtx = createContext<ActiveChatContextValue | null>(null);

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

export function useActiveChat(): ActiveChatContextValue {
  const ctx = useContext(ActiveChatCtx);
  if (!ctx) {
    throw new Error("useActiveChat must be used within ActiveChatProvider");
  }
  return ctx;
}

/** Desk toast/sound only when the agent is not actively reading this thread in the expanded dock. */
export function shouldDeskNotifyForConversation(
  dockState: SupportChatDockState,
  activeConversationId: string | null,
  targetConversationId: string,
): boolean {
  return !(dockState === "expanded" && activeConversationId === targetConversationId);
}
