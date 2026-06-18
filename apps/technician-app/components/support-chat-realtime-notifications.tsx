import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys, supportApi, technicianApi, userApi } from "@oorjaman/api";
import { notifyTechnicianSupportMessage } from "@oorjaman/ui";
import { supabase } from "../lib/supabase";
import { useHelpSupport } from "@oorjaman/ui";

export function SupportChatRealtimeNotifications() {
  const qc = useQueryClient();
  const { helpVisible, focusedThreadId } = useHelpSupport();

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

  const technicianId =
    userQ.data?.role === "technician" && technicianApi.technicianIsFullyOnboarded(techQ.data)
      ? techQ.data?.id
      : undefined;

  useEffect(() => {
    if (!supabase || !technicianId || !userQ.isSuccess) return;
    const client = supabase;

    const channel = supportApi.subscribeSupportMessagesForTechnician(client, (message) => {
      void qc.invalidateQueries({ queryKey: queryKeys.support.unreadCount("technician") });
      void qc.invalidateQueries({ queryKey: queryKeys.support.messages(message.conversation_id) });

      if (message.sender_role === "technician" || message.sender_role === "internal") return;

      const viewingThread =
        helpVisible && focusedThreadId != null && focusedThreadId === message.conversation_id;
      if (viewingThread) {
        void supportApi
          .markSupportConversationReadByTechnician(client, message.conversation_id)
          .then(() => {
            void qc.invalidateQueries({ queryKey: queryKeys.support.unreadCount("technician") });
          });
        return;
      }

      void notifyTechnicianSupportMessage(message);
    });

    return () => {
      supportApi.unsubscribeSupportChannel(client, channel);
    };
  }, [technicianId, focusedThreadId, helpVisible, qc, userQ.isSuccess]);

  return null;
}
