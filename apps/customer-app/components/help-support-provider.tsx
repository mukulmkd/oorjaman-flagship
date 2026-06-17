import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { customerApi, queryKeys, supportApi, userApi } from "@oorjaman/api";
import { supabase } from "../lib/supabase";
import { CustomerPushRegistration } from "./customer-push-registration";
import {
  HelpSupportCtx,
  type HelpSupportOpenContext,
} from "./help-support-context";
import { HelpSupportModal } from "./help-support-modal";
import { SupportChatRealtimeNotifications } from "./support-chat-realtime-notifications";
import { AmcNotificationResponse } from "./amc-notification-response";
import { SubscriptionRealtimeNotifications } from "./subscription-realtime-notifications";
import { SupportNotificationResponse } from "./support-notification-response";

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

  const custQ = useQuery({
    queryKey: queryKeys.customers.mine(),
    queryFn: () => customerApi.getMyCustomer(supabase!),
    enabled: Boolean(supabase) && userQ.data?.role === "customer",
  });

  const trackUnread =
    userQ.data?.role === "customer" && Boolean(custQ.data?.onboarding_completed_at);

  const unreadQ = useQuery({
    queryKey: queryKeys.support.unreadCount(),
    queryFn: () => supportApi.countUnreadSupportMessagesForCustomer(supabase!),
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
      <CustomerPushRegistration />
      {trackUnread && custQ.data?.id ? (
        <SubscriptionRealtimeNotifications customerId={custQ.data.id} />
      ) : null}
      <SupportChatRealtimeNotifications />
      <SupportNotificationResponse />
      <AmcNotificationResponse />
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
