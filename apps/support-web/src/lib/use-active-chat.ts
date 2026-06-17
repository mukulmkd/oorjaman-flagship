import { useContext } from "react";
import { ActiveChatCtx, type ActiveChatContextValue } from "./active-chat-context-internal";

export function useActiveChat(): ActiveChatContextValue {
  const ctx = useContext(ActiveChatCtx);
  if (!ctx) {
    throw new Error("useActiveChat must be used within ActiveChatProvider");
  }
  return ctx;
}
