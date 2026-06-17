import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatSupportCsatStars,
  queryKeys,
  supportApi,
  SUPPORT_ATTACHMENTS_BUCKET,
  type SupportConversationWithParticipant,
  type SupportMessageRow,
  type SupportResolutionTag,
} from "@oorjaman/api";
import { ResolveConversationDialog } from "./ResolveConversationDialog";
import { SupportComposer } from "./SupportComposer";
import { SupportThreadToolbar } from "./SupportThreadToolbar";
import { playNotificationChime } from "../lib/notification-sound";
import { useSupabase } from "../lib/supabase-client";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type Props = {
  conversationId: string;
  onRefreshInbox?: () => void;
  playSoundOnMessage?: boolean;
  /** Floating dock: hide duplicate header and use compact chrome. */
  compact?: boolean;
};

export function SupportChatPanel({
  conversationId,
  onRefreshInbox,
  playSoundOnMessage,
  compact = false,
}: Props) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const [composer, setComposer] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [agentUserId, setAgentUserId] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setAgentUserId(data.user?.id ?? null);
    });
  }, [supabase]);

  const conversationQ = useQuery({
    queryKey: queryKeys.support.conversation(conversationId),
    queryFn: () => supportApi.getSupportConversationForDeskWithParticipant(supabase!, conversationId),
    enabled: Boolean(supabase && conversationId),
  });

  const messagesQ = useQuery({
    queryKey: queryKeys.support.messages(conversationId),
    queryFn: () => supportApi.listSupportMessagesForDesk(supabase!, conversationId),
    enabled: Boolean(supabase && conversationId),
  });

  const selected: SupportConversationWithParticipant | null = conversationQ.data ?? null;

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.support.all() });
    onRefreshInbox?.();
  }, [queryClient, onRefreshInbox]);

  useEffect(() => {
    if (!supabase || !conversationId) return;
    const channel = supportApi.subscribeSupportMessages(supabase, conversationId, () => {
      if (playSoundOnMessage) playNotificationChime();
      void messagesQ.refetch();
      refresh();
    });
    return () => supportApi.unsubscribeSupportChannel(supabase, channel);
  }, [supabase, conversationId, messagesQ, refresh, playSoundOnMessage]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQ.data?.length]);

  const sendMut = useMutation({
    mutationFn: (body: string) => {
      const text = body.trim() || (pendingFile ? "Shared an attachment." : "");
      if (!text) throw new Error("Enter a message or attach a file.");
      if (internalNote) {
        return supportApi.sendSupportInternalNote(supabase!, {
          conversation_id: conversationId,
          body: text,
        });
      }
      return supportApi.sendSupportMessageAsAdmin(supabase!, {
        conversation_id: conversationId,
        body: text,
      });
    },
    onSuccess: async (message) => {
      if (pendingFile && supabase) {
        const path = supportApi.supportAttachmentStoragePath(
          conversationId,
          message.id,
          pendingFile.name,
        );
        const { error: upErr } = await supabase.storage
          .from(SUPPORT_ATTACHMENTS_BUCKET)
          .upload(path, pendingFile, { upsert: false });
        if (!upErr) {
          await supportApi.registerSupportMessageAttachment(supabase, {
            message_id: message.id,
            storage_path: path,
            file_name: pendingFile.name,
            mime_type: pendingFile.type || null,
            byte_size: pendingFile.size,
          });
        }
        setPendingFile(null);
      }
      setComposer("");
      setInternalNote(false);
      await messagesQ.refetch();
      refresh();
    },
  });

  const resolveMut = useMutation({
    mutationFn: (tag: SupportResolutionTag) =>
      supportApi.adminResolveSupportConversation(supabase!, conversationId, { resolution_tag: tag }),
    onSuccess: () => {
      setResolveOpen(false);
      refresh();
    },
  });

  const escalateMut = useMutation({
    mutationFn: (note: string) =>
      supportApi.adminEscalateSupportConversation(supabase!, conversationId, note),
    onSuccess: () => refresh(),
  });

  const reopenMut = useMutation({
    mutationFn: () => supportApi.adminReopenSupportConversation(supabase!, conversationId),
    onSuccess: () => refresh(),
  });

  if (conversationQ.isPending) {
    return <p className="support-inbox-muted">Loading chat…</p>;
  }

  if (!selected) {
    return <p className="support-inbox-error">Conversation not found.</p>;
  }

  const readOnly = selected.status === "resolved";

  const actionButtons = readOnly ? (
    <button
      type="button"
      className="support-inbox-btn-outline"
      disabled={reopenMut.isPending}
      onClick={() => reopenMut.mutate()}
    >
      Reopen
    </button>
  ) : (
    <>
      <button
        type="button"
        className="support-inbox-btn-outline"
        disabled={escalateMut.isPending}
        onClick={() => {
          const note = window.prompt("Note for operations (optional)") ?? "";
          escalateMut.mutate(note);
        }}
      >
        Escalate
      </button>
      <button
        type="button"
        className="support-inbox-btn-outline"
        disabled={resolveMut.isPending}
        onClick={() => setResolveOpen(true)}
      >
        Resolve
      </button>
    </>
  );

  return (
    <div className={`support-chat-panel${compact ? " support-chat-panel-compact" : ""}`}>
      {!compact ? (
        <header className="support-inbox-thread-header support-chat-panel-header">
          <div className="support-chat-panel-header-text">
            <h2>{supportApi.supportParticipantDisplayName(selected)}</h2>
            <p className="support-inbox-muted">{selected.subject ?? selected.category_slug}</p>
            {selected.status === "resolved" && selected.csat_rating != null ? (
              <span className="support-thread-csat-badge">
                {formatSupportCsatStars(selected.csat_rating)} {selected.csat_rating}/5
              </span>
            ) : null}
          </div>
          <div className="support-inbox-thread-actions">{actionButtons}</div>
        </header>
      ) : (
        <div className="support-chat-panel-dock-actions">{actionButtons}</div>
      )}

      {!readOnly ? (
        <SupportThreadToolbar
          conversation={selected}
          agentUserId={agentUserId}
          onUpdated={refresh}
          compact={compact}
        />
      ) : null}

      <div className="support-inbox-messages support-chat-panel-messages">
        {messagesQ.isPending ? <p className="support-inbox-muted">Loading messages…</p> : null}
        {(messagesQ.data ?? []).map((m: SupportMessageRow) => {
          const roleClass =
            m.sender_role === "customer" || m.sender_role === "technician"
              ? "support-msg-customer"
              : m.sender_role === "admin"
                ? "support-msg-admin"
                : m.sender_role === "internal"
                  ? "support-msg-internal"
                  : "support-msg-system";
          return (
            <div key={m.id} className={`support-msg ${roleClass}`}>
              {m.sender_role === "admin" ? <div className="support-msg-label">You</div> : null}
              {m.sender_role === "internal" ? (
                <div className="support-msg-label">Internal note</div>
              ) : null}
              {m.sender_role === "customer" ? (
                <div className="support-msg-label">Customer</div>
              ) : null}
              <div>{m.body}</div>
              <div className="support-msg-time">{formatWhen(m.created_at)}</div>
            </div>
          );
        })}
        <div ref={threadEndRef} />
      </div>

      <SupportComposer
        compact={compact}
        composer={composer}
        onComposerChange={setComposer}
        onSend={() => sendMut.mutate(composer.trim())}
        sendPending={sendMut.isPending}
        readOnly={readOnly}
        internalNote={internalNote}
        onInternalNoteChange={setInternalNote}
        pendingFile={pendingFile}
        onPendingFileChange={setPendingFile}
        categorySlug={selected.category_slug}
      />

      <ResolveConversationDialog
        open={resolveOpen}
        loading={resolveMut.isPending}
        onClose={() => setResolveOpen(false)}
        onConfirm={(tag) => resolveMut.mutate(tag)}
      />
    </div>
  );
}
