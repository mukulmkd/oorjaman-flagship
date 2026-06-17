import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatSupportCsatStars,
  queryKeys,
  supportApi,
  SUPPORT_ATTACHMENTS_BUCKET,
  type SupportConversationWithParticipant,
  type SupportInboxAudienceFilter,
  type SupportInboxFilter,
  type SupportMessageRow,
  type SupportResolutionTag,
} from "@oorjaman/api";
import { PageHeader } from "@oorjaman/web-ui";
import { ParticipantContextPanel } from "../components/ParticipantContextPanel";
import { SupportComposer } from "../components/SupportComposer";
import { SupportSlaBadges } from "../components/SupportSlaBadges";
import { ResolveConversationDialog } from "../components/ResolveConversationDialog";
import { SupportThreadToolbar } from "../components/SupportThreadToolbar";
import {
  isNotificationSoundMuted,
  playNotificationChime,
  setNotificationSoundMuted,
} from "../lib/notification-sound";
import { shouldDeskNotifyForConversation } from "../lib/active-chat-notify";
import { useActiveChat } from "../lib/use-active-chat";
import { parseInboxDrillDown } from "../lib/support-inbox-url";
import { useSupabase } from "../lib/supabase-client";
import "./support-inbox.css";

const INBOX_TABS: { id: SupportInboxFilter; label: string }[] = [
  { id: "queued", label: "Queued" },
  { id: "unassigned", label: "Unassigned" },
  { id: "mine", label: "Mine" },
  { id: "open", label: "All open" },
  { id: "resolved", label: "Resolved (30d)" },
];

const AUDIENCE_TABS: { id: SupportInboxAudienceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "customer", label: "Customer support" },
  { id: "technician", label: "Technician support" },
];

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

export function SupportInboxPage() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const {
    openChat,
    closeChat,
    expandChat,
    isLiveChat,
    conversationId: activeDockConversationId,
    dockState,
  } = useActiveChat();
  const [searchParams, setSearchParams] = useSearchParams();
  const drillDown = useMemo(() => parseInboxDrillDown(searchParams), [searchParams]);
  const deepLinkId = searchParams.get("conversation");
  const [filter, setFilter] = useState<SupportInboxFilter>(drillDown.filter);
  const [audience, setAudience] = useState<SupportInboxAudienceFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkId);
  const [composer, setComposer] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [soundMuted, setSoundMuted] = useState(() => isNotificationSoundMuted());
  const [agentUserId, setAgentUserId] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const soundMutedRef = useRef(soundMuted);
  soundMutedRef.current = soundMuted;

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setAgentUserId(data.user?.id ?? null);
    });
  }, [supabase]);

  const inboxQ = useQuery({
    queryKey: queryKeys.support.deskInbox(filter, agentUserId ?? "", audience),
    queryFn: () =>
      supportApi.listSupportInboxForDesk(supabase!, filter, {
        agentUserId,
        limit: 120,
        audience,
      }),
    enabled: Boolean(supabase && (filter !== "mine" || agentUserId)),
    refetchInterval: 60_000,
  });

  const conversations = useMemo(() => inboxQ.data ?? [], [inboxQ.data]);

  useEffect(() => {
    setFilter(drillDown.filter);
  }, [drillDown.filter]);

  const displayedConversations = useMemo(() => {
    let list = conversations;
    if (drillDown.category) {
      list = list.filter((c) => c.category_slug === drillDown.category);
    }
    if (drillDown.since === "24h") {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      list = list.filter(
        (c) => c.resolved_at && new Date(c.resolved_at).getTime() >= cutoff,
      );
    }
    const cutoff7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (drillDown.highlight === "csat") {
      list = list.filter(
        (c) => c.resolved_at && new Date(c.resolved_at).getTime() >= cutoff7d,
      );
      list = [...list].sort((a, b) => (b.csat_rating ?? -1) - (a.csat_rating ?? -1));
    }
    if (drillDown.highlight === "first-reply") {
      list = list.filter(
        (c) =>
          c.resolved_at &&
          new Date(c.resolved_at).getTime() >= cutoff7d &&
          c.first_admin_reply_at,
      );
      list = [...list].sort(
        (a, b) =>
          new Date(a.first_admin_reply_at!).getTime() -
          new Date(b.first_admin_reply_at!).getTime(),
      );
    }
    return list;
  }, [conversations, drillDown]);

  const selectedFromList = useMemo(
    () => displayedConversations.find((c) => c.id === selectedId) ?? null,
    [displayedConversations, selectedId],
  );

  const selectedFetchQ = useQuery({
    queryKey: selectedId ? queryKeys.support.conversation(selectedId) : [],
    queryFn: () => supportApi.getSupportConversationForDeskWithParticipant(supabase!, selectedId!),
    enabled: Boolean(supabase && selectedId && !selectedFromList),
  });

  const selected: SupportConversationWithParticipant | null =
    selectedFromList ?? selectedFetchQ.data ?? null;

  const messagesQ = useQuery({
    queryKey: selectedId ? queryKeys.support.messages(selectedId) : [],
    queryFn: () => supportApi.listSupportMessagesForDesk(supabase!, selectedId!),
    enabled: Boolean(supabase && selectedId),
  });

  const customerContextQ = useQuery({
    queryKey: selectedId ? [...queryKeys.support.deskContext(selectedId), "customer"] : [],
    queryFn: () => supportApi.getSupportDeskCustomerContext(supabase!, selected!),
    enabled: Boolean(
      supabase && selected && !supportApi.isTechnicianSupportConversation(selected),
    ),
  });

  const technicianContextQ = useQuery({
    queryKey: selectedId ? [...queryKeys.support.deskContext(selectedId), "technician"] : [],
    queryFn: () => supportApi.getSupportDeskTechnicianContext(supabase!, selected!),
    enabled: Boolean(supabase && selected && selected.participant_audience === "technician"),
  });

  const selectedIsTechnician =
    selected != null && supportApi.isTechnicianSupportConversation(selected);

  const contextLoading = selectedIsTechnician
    ? technicianContextQ.isLoading
    : customerContextQ.isLoading;

  const contextError = selectedIsTechnician
    ? ((technicianContextQ.error as Error | null) ?? null)
    : ((customerContextQ.error as Error | null) ?? null);

  const refreshInbox = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.support.all() });
  }, [queryClient]);

  useEffect(() => {
    if (!selectedId && displayedConversations[0]) {
      const c = displayedConversations[0];
      setSelectedId(c.id);
      if (isLiveChat(c.status)) openChat(c.id, { expand: true });
    }
  }, [displayedConversations, selectedId, openChat, isLiveChat]);

  useEffect(() => {
    if (selectedId && displayedConversations.some((c) => c.id === selectedId)) return;
    const next = displayedConversations[0] ?? null;
    setSelectedId(next?.id ?? null);
    if (next && isLiveChat(next.status)) openChat(next.id, { expand: true });
    else closeChat();
  }, [displayedConversations, selectedId, openChat, isLiveChat, closeChat]);

  useEffect(() => {
    if (!deepLinkId) return;
    setSelectedId(deepLinkId);
  }, [deepLinkId]);

  useEffect(() => {
    const conv = selectedFromList ?? selectedFetchQ.data;
    if (!deepLinkId || !conv || conv.id !== deepLinkId) return;
    if (isLiveChat(conv.status)) openChat(deepLinkId, { expand: true });
  }, [deepLinkId, selectedFromList, selectedFetchQ.data, openChat, isLiveChat]);

  useEffect(() => {
    if (!supabase || !selectedId) return;
    const channel = supportApi.subscribeSupportMessages(supabase, selectedId, () => {
      const notify = shouldDeskNotifyForConversation(
        dockState,
        activeDockConversationId,
        selectedId,
      );
      if (!soundMuted && notify) playNotificationChime();
      void messagesQ.refetch();
      refreshInbox();
    });
    return () => supportApi.unsubscribeSupportChannel(supabase, channel);
  }, [supabase, selectedId, messagesQ, refreshInbox, soundMuted, dockState, activeDockConversationId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQ.data?.length]);

  const sendMut = useMutation({
    mutationFn: (body: string) => {
      const text = body.trim() || (pendingFile ? "Shared an attachment." : "");
      if (!text) throw new Error("Enter a message or attach a file.");
      if (internalNote) {
        return supportApi.sendSupportInternalNote(supabase!, {
          conversation_id: selectedId!,
          body: text,
        });
      }
      return supportApi.sendSupportMessageAsAdmin(supabase!, {
        conversation_id: selectedId!,
        body: text,
      });
    },
    onSuccess: async (message) => {
      if (pendingFile && supabase && selectedId) {
        const path = supportApi.supportAttachmentStoragePath(
          selectedId,
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
      refreshInbox();
    },
  });

  const resolveMut = useMutation({
    mutationFn: (tag: SupportResolutionTag) =>
      supportApi.adminResolveSupportConversation(supabase!, selectedId!, { resolution_tag: tag }),
    onSuccess: () => {
      setResolveOpen(false);
      refreshInbox();
    },
  });

  const escalateMut = useMutation({
    mutationFn: (note: string) =>
      supportApi.adminEscalateSupportConversation(supabase!, selectedId!, note),
    onSuccess: () => refreshInbox(),
  });

  const reopenMut = useMutation({
    mutationFn: () => supportApi.adminReopenSupportConversation(supabase!, selectedId!),
    onSuccess: () => refreshInbox(),
  });

  const toggleSound = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    setNotificationSoundMuted(next);
  };

  const readOnly = selected?.status === "resolved";
  const selectedIsLive = selected ? isLiveChat(selected.status) : false;

  const selectConversation = (c: SupportConversationWithParticipant) => {
    setSelectedId(c.id);
    if (isLiveChat(c.status)) {
      openChat(c.id, { expand: true });
    } else {
      closeChat();
    }
  };

  return (
    <div className="support-inbox-page">
      <div className="support-inbox-page-header">
        <PageHeader
          title="Inbox"
          subtitle="Customer and technician support queues. Replies reach the mobile app in real time."
        />
        <div className="support-inbox-page-header-actions">
          <Link to="/search" className="support-inbox-sound-toggle">
            Search
          </Link>
          <button
            type="button"
            className="support-inbox-sound-toggle"
            onClick={toggleSound}
            title={soundMuted ? "Unmute new message sound" : "Mute new message sound"}
          >
            {soundMuted ? "Sound off" : "Sound on"}
          </button>
        </div>
      </div>

      {drillDown.label ? (
        <div className="support-inbox-drill-banner">
          <span>{drillDown.label}</span>
          <Link to="/insights" className="support-inbox-drill-banner-back">
            Back to insights
          </Link>
        </div>
      ) : null}

      <div className="support-inbox-audience-tabs" role="tablist" aria-label="Support audience">
        {AUDIENCE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={audience === tab.id}
            className={`support-inbox-audience-tab${audience === tab.id ? " support-inbox-audience-tab-active" : ""}`}
            onClick={() => {
              setAudience(tab.id);
              setSelectedId(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="support-inbox-tabs" role="tablist" aria-label="Inbox queue">
        {INBOX_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            className={`support-inbox-tab${filter === tab.id ? " support-inbox-tab-active" : ""}`}
            onClick={() => {
              setFilter(tab.id);
              setSelectedId(null);
              setSearchParams({ filter: tab.id });
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="support-inbox-shell">
        <aside className="support-inbox-list">
          {inboxQ.isPending ? <p className="support-inbox-muted">Loading…</p> : null}
          {inboxQ.isError ? (
            <p className="support-inbox-error">{(inboxQ.error as Error).message}</p>
          ) : null}
          {displayedConversations.length === 0 && !inboxQ.isPending ? (
            <p className="support-inbox-muted">
              {conversations.length > 0 && drillDown.label
                ? "No conversations match this insight filter."
                : "No conversations in this queue."}
            </p>
          ) : (
            displayedConversations.map((c) => {
              const active = c.id === selectedId;
              const name = supportApi.supportParticipantDisplayName(c);
              const audienceLabel = supportApi.supportParticipantAudienceLabel(c.participant_audience);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`support-inbox-row${active ? " support-inbox-row-active" : ""}`}
                  onClick={() => selectConversation(c)}
                >
                  <div className="support-inbox-row-top">
                    <span className={`support-inbox-audience-badge support-inbox-audience-badge-${c.participant_audience}`}>
                      {audienceLabel}
                    </span>
                    <span className="support-inbox-row-name">{name}</span>
                    <span className={`support-inbox-status support-inbox-status-${c.status}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="support-inbox-row-subject">{c.subject ?? c.category_slug}</div>
                  <SupportSlaBadges conversation={c} />
                  <div className="support-inbox-row-meta">{formatWhen(c.last_message_at)}</div>
                </button>
              );
            })
          )}
        </aside>

        <section className="support-inbox-thread">
          {!selected ? (
            <p className="support-inbox-muted support-inbox-thread-empty">Select a conversation.</p>
          ) : selectedIsLive ? (
            <div className="support-inbox-dock-placeholder">
              <h2>{supportApi.supportParticipantDisplayName(selected)}</h2>
              <p className="support-inbox-muted">{selected.subject ?? selected.category_slug}</p>
              <p className="support-inbox-dock-placeholder-lead">
                This live chat is in the floating window at the bottom-right. Use Search to look up
                bookings, AMC, and history while you reply.
              </p>
              <div className="support-inbox-dock-placeholder-actions">
                <button type="button" className="support-inbox-btn-primary" onClick={expandChat}>
                  Open chat window
                </button>
                <Link to="/search" className="support-inbox-btn-outline">
                  Search customers
                </Link>
              </div>
            </div>
          ) : (
            <div className="support-chat-panel">
              <header className="support-inbox-thread-header">
                <div>
                  <h2>{supportApi.supportParticipantDisplayName(selected)}</h2>
                  <p className="support-inbox-muted">
                    {selected.subject ?? selected.category_slug}
                  </p>
                  {selected.status === "resolved" ? (
                    <div className="support-thread-outcome-badges">
                      {selected.csat_rating != null ? (
                        <span className="support-thread-csat-badge" title="Customer CSAT">
                          {formatSupportCsatStars(selected.csat_rating)}{" "}
                          <span className="support-thread-csat-num">{selected.csat_rating}/5</span>
                        </span>
                      ) : (
                        <span className="support-thread-csat-pending">CSAT pending</span>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="support-inbox-thread-actions">
                  {selected.status === "resolved" ? (
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
                        Escalate to ops
                      </button>
                      <button
                        type="button"
                        className="support-inbox-btn-outline"
                        disabled={resolveMut.isPending}
                        onClick={() => setResolveOpen(true)}
                      >
                        Mark resolved
                      </button>
                    </>
                  )}
                </div>
              </header>

              {selected.status !== "resolved" ? (
                <SupportThreadToolbar
                  conversation={selected}
                  agentUserId={agentUserId}
                  onUpdated={refreshInbox}
                />
              ) : null}

              <div className="support-inbox-messages">
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
            </div>
          )}
        </section>

        {selected ? (
          <ParticipantContextPanel
            conversation={selected}
            customerContext={customerContextQ.data}
            technicianContext={technicianContextQ.data}
            loading={contextLoading}
            contextError={contextError}
          />
        ) : (
          <aside className="support-context-panel support-context-panel-empty">
            <p className="support-inbox-muted">Participant context appears when you select a chat.</p>
          </aside>
        )}
      </div>

      <ResolveConversationDialog
        open={resolveOpen}
        loading={resolveMut.isPending}
        onClose={() => setResolveOpen(false)}
        onConfirm={(tag) => resolveMut.mutate(tag)}
      />
    </div>
  );
}
