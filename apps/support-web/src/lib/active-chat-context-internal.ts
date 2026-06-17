import { createContext } from "react";

export type SupportChatDockState = "hidden" | "minimized" | "expanded";

export type ActiveChatContextValue = {
  conversationId: string | null;
  dockState: SupportChatDockState;
  openChat: (conversationId: string, options?: { expand?: boolean }) => void;
  closeChat: () => void;
  minimizeChat: () => void;
  expandChat: () => void;
  isLiveChat: (status: string) => boolean;
};

export const ActiveChatCtx = createContext<ActiveChatContextValue | null>(null);
