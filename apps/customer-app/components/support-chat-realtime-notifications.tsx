import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customerApi, queryKeys, supportApi, userApi } from "@oorjaman/api";
import { notifyCustomerSupportMessage } from "@oorjaman/ui";
import { supabase } from "../lib/supabase";
import { useHelpSupport } from "./help-support-context";

/**
 * App-wide support message realtime: refreshes unread badge and shows local notifications
 * when the customer is on another screen or the app is backgrounded (OS permitting).
 */
export function SupportChatRealtimeNotifications() {
  const qc = useQueryClient();
  const { helpVisible, focusedThreadId } = useHelpSupport();

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

  const customerId =
    userQ.data?.role === "customer" && custQ.data?.onboarding_completed_at
      ? custQ.data.id
      : undefined;

  useEffect(() => {
    if (!supabase || !customerId || !userQ.isSuccess) return;
    const client = supabase;

    const channel = supportApi.subscribeSupportMessagesForCustomer(client, (message) => {
      void qc.invalidateQueries({ queryKey: queryKeys.support.unreadCount() });
      void qc.invalidateQueries({ queryKey: queryKeys.support.messages(message.conversation_id) });

      if (message.sender_role === "customer" || message.sender_role === "internal") return;

      const viewingThread =
        helpVisible && focusedThreadId != null && focusedThreadId === message.conversation_id;
      if (viewingThread) {
        void supportApi
          .markSupportConversationReadByCustomer(client, message.conversation_id)
          .then(() => {
            void qc.invalidateQueries({ queryKey: queryKeys.support.unreadCount() });
          });
        return;
      }

      void notifyCustomerSupportMessage(message);
    });

    return () => {
      supportApi.unsubscribeSupportChannel(client, channel);
    };
  }, [customerId, focusedThreadId, helpVisible, qc, userQ.isSuccess]);

  return null;
}
