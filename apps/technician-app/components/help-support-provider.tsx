import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, supportApi, technicianApi, userApi } from "@oorjaman/api";
import { supabase } from "../lib/supabase";
import {
  HelpSupportCtx,
  type HelpSupportOpenContext,
  type HelpSupportState,
} from "./help-support-context";
import { HelpSupportModal } from "./help-support-modal";
import { SupportChatRealtimeNotifications } from "./support-chat-realtime-notifications";
import { SupportNotificationResponse } from "./support-notification-response";
import { TechnicianPushRegistration } from "./technician-push-registration";

export type { HelpSupportOpenContext, HelpSupportState } from "./help-support-context";
export { useHelpSupport } from "./help-support-context";

export function HelpSupportProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [context, setContext] = useState<HelpSupportOpenContext | undefined>();
  const [focusedThreadId, setFocusedThreadId] = useState<string | null>(null);

  const userQ = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => userApi.getMyUserRecord(supabase!),
    enabled: Boolean(supabase),
  });

  const techQ = useQuery({
    queryKey: queryKeys.technicians.me(),
    queryFn: () => technicianApi.getMyTechnicianProfile(supabase!),
    enabled: Boolean(supabase),
  });

  const trackUnread =
    userQ.data?.role === "technician" && technicianApi.technicianIsFullyOnboarded(techQ.data);

  const unreadQ = useQuery({
    queryKey: queryKeys.support.unreadCount("technician"),
    queryFn: () => supportApi.countUnreadSupportMessagesForTechnician(supabase!),
    enabled: Boolean(supabase && trackUnread),
    refetchInterval: 120_000,
  });

  const openHelp = useCallback((ctx?: HelpSupportOpenContext) => {
    setContext(ctx);
    setVisible(true);
  }, []);

  const closeHelp = useCallback(() => {
    setVisible(false);
    setFocusedThreadId(null);
    setContext(undefined);
  }, []);

  const refreshUnreadCount = useCallback(() => {
    void unreadQ.refetch();
  }, [unreadQ.refetch]);

  const value = useMemo(
    () => ({
      openHelp,
      closeHelp,
      unreadCount: unreadQ.data ?? 0,
      helpVisible: visible,
      focusedThreadId,
      setFocusedThreadId,
      refreshUnreadCount,
    }),
    [openHelp, closeHelp, unreadQ.data, visible, focusedThreadId, refreshUnreadCount],
  );

  return (
    <HelpSupportCtx.Provider value={value}>
      {children}
      <TechnicianPushRegistration />
      <SupportChatRealtimeNotifications />
      <SupportNotificationResponse />
      <HelpSupportModal
        visible={visible}
        context={context}
        onClose={closeHelp}
        setFocusedThreadId={setFocusedThreadId}
        refreshUnreadCount={refreshUnreadCount}
      />
    </HelpSupportCtx.Provider>
  );
}
