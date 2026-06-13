import { createContext, useContext, type Dispatch, type SetStateAction } from "react";

export type HelpSupportOpenContext = {
  booking_id?: string | null;
  category_slug?: string | null;
  conversation_id?: string | null;
  focus_active_thread?: boolean;
};

export type HelpSupportState = {
  openHelp: (context?: HelpSupportOpenContext) => void;
  closeHelp: () => void;
  unreadCount: number;
  helpVisible: boolean;
  focusedThreadId: string | null;
  setFocusedThreadId: Dispatch<SetStateAction<string | null>>;
  refreshUnreadCount: () => void;
};

export const HelpSupportCtx = createContext<HelpSupportState | null>(null);

export function useHelpSupport(): HelpSupportState {
  const ctx = useContext(HelpSupportCtx);
  if (!ctx) {
    throw new Error("useHelpSupport must be used within HelpSupportProvider");
  }
  return ctx;
}
