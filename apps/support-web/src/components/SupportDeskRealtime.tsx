import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, supportApi, type SupportConversationRow } from "@oorjaman/api";
import { shouldDeskNotifyForConversation } from "../lib/active-chat-notify";
import { useActiveChat } from "../lib/use-active-chat";
import {
  isNotificationSoundMuted,
  playNotificationChime,
} from "../lib/notification-sound";
import { useSupabase } from "../lib/supabase-client";
import "./support-chat-dock.css";

type DeskToast = {
  id: string;
  title: string;
  body: string;
  conversationId: string;
};

function isLiveDeskStatus(status: SupportConversationRow["status"]): boolean {
  return status === "queued" || status === "active";
}

export function SupportDeskRealtime() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { openChat, conversationId: activeConversationId, dockState } = useActiveChat();
  const [toast, setToast] = useState<DeskToast | null>(null);
  const readyRef = useRef(false);
  const lastAlertRef = useRef<{ conversationId: string; at: number } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 12_000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!supabase) return;

    const invalidateInbox = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.support.all() });
    };

    const alertForConversation = (
      conv: Pick<
        SupportConversationRow,
        "id" | "status" | "subject" | "category_slug" | "participant_audience"
      >,
    ) => {
      if (!readyRef.current) return;
      if (!shouldDeskNotifyForConversation(dockState, activeConversationId, conv.id)) return;

      const now = Date.now();
      const last = lastAlertRef.current;
      if (last && last.conversationId === conv.id && now - last.at < 2500) return;
      lastAlertRef.current = { conversationId: conv.id, at: now };

      if (!isNotificationSoundMuted()) playNotificationChime();

      const audience =
        conv.participant_audience === "technician" ? "technician" : "customer";
      const title =
        audience === "technician" ? "Technician support" : "Customer support";
      const body = conv.subject?.trim() || conv.category_slug || "Support request";

      setToast({
        id: `${conv.id}-${now}`,
        title,
        body,
        conversationId: conv.id,
      });

      if (isLiveDeskStatus(conv.status)) {
        openChat(conv.id, { expand: true });
      }
    };

    const channel = supportApi.subscribeSupportDeskRealtime(supabase, {
      onReady: () => {
        readyRef.current = true;
      },
      onAnyChange: invalidateInbox,
      onConversationInserted: (row) => {
        alertForConversation(row);
      },
      onParticipantMessageInserted: (message) => {
        invalidateInbox();
        if (!readyRef.current) return;
        if (
          !shouldDeskNotifyForConversation(dockState, activeConversationId, message.conversation_id)
        ) {
          return;
        }
        void (async () => {
          try {
            const conv = await supportApi.getSupportConversationById(supabase, message.conversation_id);
            if (!isLiveDeskStatus(conv.status)) return;
            alertForConversation(conv);
          } catch {
            /* ignore */
          }
        })();
      },
    });

    return () => {
      readyRef.current = false;
      supportApi.unsubscribeSupportChannel(supabase, channel);
    };
  }, [supabase, queryClient, openChat, dockState, activeConversationId]);

  if (!toast) return null;

  return (
    <button
      type="button"
      className="support-desk-toast"
      onClick={() => {
        navigate(`/inbox?conversation=${toast.conversationId}`);
        openChat(toast.conversationId, { expand: true });
        setToast(null);
      }}
    >
      <span className="support-desk-toast-title">{toast.title}</span>
      <span className="support-desk-toast-body">{toast.body}</span>
      <span className="support-desk-toast-hint">Tap to open</span>
    </button>
  );
}
