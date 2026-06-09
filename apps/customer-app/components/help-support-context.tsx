import { createContext, useContext, type Dispatch, type SetStateAction } from "react";

export type HelpSupportOpenContext = {
  booking_id?: string | null;
  subscription_id?: string | null;
  service_address_id?: string | null;
  category_slug?: string | null;
  subcategory_slug?: string | null;
  /** Open this conversation thread when the sheet opens (e.g. from a push tap). */
  conversation_id?: string | null;
  /** Jump into the active thread (e.g. when opening from unread badge). */
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

/** @deprecated Use {@link HelpSupportOpenContext} */
export type HelpSupportContext = HelpSupportOpenContext;
