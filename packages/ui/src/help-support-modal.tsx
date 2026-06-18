import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  initialWindowMetrics,
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import {
  queryKeys,
  supportApi,
  type Database,
  type SupportCategory,
  type SupportConversationRow,
  type SupportMessageRow,
} from "@oorjaman/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { colors, spacing } from "@oorjaman/config";
import { Button } from "./Button";
import { ModalSheetHeader } from "./ModalSheetHeader";
import { mobileBrandFontFamily as fontFamily } from "./brand/mobile-brand-fonts";
import { mobileBrandFontSize as fontSize } from "./brand/brand-assets";
import type { HelpSupportOpenContext } from "./help-support-context";
import {
  helpSupportCreateConversation,
  helpSupportGetCategory,
  helpSupportGetSubcategory,
  helpSupportListActiveConversations,
  helpSupportListCatalog,
  helpSupportMarkConversationRead,
  helpSupportParticipantSenderRole,
  helpSupportSendMessage,
  helpSupportSubmitCsat,
  helpSupportThreadSubtitle,
  helpSupportUnreadCountQueryKey,
  type HelpSupportRole,
} from "./help-support-role-api";

type Props = {
  role: HelpSupportRole;
  client: SupabaseClient<Database> | null;
  visible: boolean;
  context?: HelpSupportOpenContext;
  onClose: () => void;
  setFocusedThreadId: (id: string | null) => void;
  refreshUnreadCount: () => void;
  /** Full-screen stack modal (no dimmed backdrop / bottom sheet chrome). */
  presentation?: "overlay" | "screen";
};

type IntakeStep = "category" | "subcategory" | "details";
type ModalView = "loading" | "inbox" | "intake" | "thread";

function conversationStatusLabel(status: SupportConversationRow["status"]): string {
  switch (status) {
    case "active":
      return "In progress";
    case "queued":
      return "Waiting for support";
    case "intake":
      return "Starting";
    default:
      return "Closed";
  }
}

function latestAssignedAgentName(messages: SupportMessageRow[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (!msg) continue;
    if (supportApi.parseSupportMessageEvent(msg) === "agent_joined") {
      return supportApi.supportAgentNameFromMessage(msg);
    }
    if (supportApi.parseSupportMessageEvent(msg) === "agent_transferred") {
      return supportApi.supportAgentNameFromMessage(msg);
    }
  }
  return null;
}

type LocalBubble = {
  id: string;
  role: "bot" | "user";
  body: string;
};

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function HelpSupportModalBody({
  role,
  client,
  visible,
  context,
  onClose,
  setFocusedThreadId,
  refreshUnreadCount,
  presentation = "overlay",
}: Props) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const listRef = useRef<FlatList<SupportMessageRow | LocalBubble>>(null);
  const modalOpenSessionRef = useRef(false);
  const markThreadReadRef = useRef<(convId: string) => Promise<void>>(async () => {});

  const [intakeStep, setIntakeStep] = useState<IntakeStep>("category");
  const [categorySlug, setCategorySlug] = useState<string | null>(context?.category_slug ?? null);
  const [subcategorySlug, setSubcategorySlug] = useState<string | null>(null);
  const [detailsDraft, setDetailsDraft] = useState("");
  const [localBubbles, setLocalBubbles] = useState<LocalBubble[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  const [modalView, setModalView] = useState<ModalView>("loading");
  const [activeChats, setActiveChats] = useState<SupportConversationRow[]>([]);

  const participantRole = helpSupportParticipantSenderRole(role);
  const showSubcategoryHints = role === "customer";

  const catalog = useMemo(() => helpSupportListCatalog(role), [role]);
  const selectedCategory = useMemo(
    () => (categorySlug ? helpSupportGetCategory(role, categorySlug) : undefined),
    [role, categorySlug],
  );

  const messagesQ = useQuery({
    queryKey: conversationId ? queryKeys.support.messages(conversationId) : [],
    queryFn: () => supportApi.listSupportMessages(client!, conversationId!),
    enabled: Boolean(client && conversationId),
  });

  const conversationQ = useQuery({
    queryKey: conversationId ? queryKeys.support.conversation(conversationId) : [],
    queryFn: () => supportApi.getSupportConversationById(client!, conversationId!),
    enabled: Boolean(client && conversationId),
    refetchInterval: conversationId ? 60_000 : false,
  });

  const chatClosed =
    conversationQ.data?.status === "resolved" ||
    (conversationQ.data != null && supportApi.shouldTreatSupportConversationAsInactive(conversationQ.data));

  const needsCsat =
    conversationQ.data?.status === "resolved" && !conversationQ.data?.csat_submitted_at;

  const [csatRating, setCsatRating] = useState<number | null>(null);
  const [csatComment, setCsatComment] = useState("");

  const csatMut = useMutation({
    mutationFn: () => {
      if (!client || !conversationId || csatRating == null) {
        throw new Error("Choose a rating.");
      }
      return helpSupportSubmitCsat(role, client, conversationId, {
        rating: csatRating,
        comment: csatComment,
      });
    },
    onSuccess: async () => {
      await conversationQ.refetch();
    },
  });

  const createMut = useMutation({
    mutationFn: () => {
      if (!client || !categorySlug || !subcategorySlug) {
        throw new Error("Complete the help questions first.");
      }
      return helpSupportCreateConversation(role, client, {
        category_slug: categorySlug,
        subcategory_slug: subcategorySlug,
        details_text: detailsDraft,
        context,
      });
    },
    onSuccess: async (conv) => {
      setConversationId(conv.id);
      setModalView("thread");
      setFocusedThreadId(conv.id);
      setActiveChats((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
      await qc.invalidateQueries({ queryKey: queryKeys.support.myConversations() });
      await qc.invalidateQueries({ queryKey: queryKeys.support.messages(conv.id) });
      await markThreadRead(conv.id);
    },
  });

  const sendMut = useMutation({
    mutationFn: (body: string) => {
      if (!client || !conversationId) throw new Error("No active chat.");
      return helpSupportSendMessage(role, client, {
        conversation_id: conversationId,
        body,
      });
    },
    onSuccess: async () => {
      setComposerText("");
      await messagesQ.refetch();
    },
  });

  const resetIntake = useCallback(() => {
    const welcome: LocalBubble = {
      id: uid(),
      role: "bot",
      body: "Hi! I'm here to help. Choose a topic below and we'll connect you with OorjaMan support.",
    };

    if (
      role === "customer" &&
      context?.category_slug &&
      context?.subcategory_slug
    ) {
      const cat = helpSupportGetCategory(role, context.category_slug);
      const sub = helpSupportGetSubcategory(role, context.category_slug, context.subcategory_slug);
      if (cat && sub) {
        setIntakeStep("details");
        setCategorySlug(cat.slug);
        setSubcategorySlug(sub.slug);
        setDetailsDraft("");
        setLocalBubbles([
          welcome,
          { id: uid(), role: "user", body: cat.label },
          { id: uid(), role: "bot", body: "Got it. Which of these best describes your question?" },
          { id: uid(), role: "user", body: sub.label },
          { id: uid(), role: "bot", body: sub.prompt ?? "Please describe your issue (required)." },
        ]);
        setConversationId(null);
        setComposerText("");
        return;
      }
    }

    if (context?.category_slug) {
      const cat = helpSupportGetCategory(role, context.category_slug);
      setIntakeStep("subcategory");
      setCategorySlug(context.category_slug);
      setSubcategorySlug(null);
      setDetailsDraft("");
      setLocalBubbles([
        welcome,
        ...(cat
          ? [
              { id: uid(), role: "user" as const, body: cat.label },
              {
                id: uid(),
                role: "bot" as const,
                body: "Got it. Which of these best describes your question?",
              },
            ]
          : []),
      ]);
      setConversationId(null);
      setComposerText("");
      return;
    }

    setIntakeStep("category");
    setCategorySlug(null);
    setSubcategorySlug(null);
    setDetailsDraft("");
    setLocalBubbles([welcome]);
    setConversationId(null);
    setComposerText("");
  }, [context?.category_slug, context?.subcategory_slug, role]);

  const markThreadRead = useCallback(
    async (convId: string) => {
      if (!client) return;
      await helpSupportMarkConversationRead(role, client, convId);
      await qc.invalidateQueries({ queryKey: helpSupportUnreadCountQueryKey(role) });
      refreshUnreadCount();
    },
    [client, qc, refreshUnreadCount, role],
  );

  markThreadReadRef.current = markThreadRead;

  useEffect(() => {
    if (!visible) {
      modalOpenSessionRef.current = false;
      return;
    }
    if (!client || modalOpenSessionRef.current) return;
    const sb = client;
    modalOpenSessionRef.current = true;

    let cancelled = false;
    setModalView("loading");
    setConversationId(null);
    setFocusedThreadId(null);
    const deepLinkConversationId = context?.conversation_id?.trim() ?? null;
    const focusActiveThread = Boolean(context?.focus_active_thread);

    void (async () => {
      try {
        const active = await helpSupportListActiveConversations(role, sb);
        if (cancelled) return;
        setActiveChats(active);

        const openConversationThread = async (convId: string) => {
          const fromActive = active.find((c) => c.id === convId);
          const conv =
            fromActive ??
            (await supportApi.getSupportConversationById(sb, convId).catch(() => null));
          if (cancelled || !conv) return false;
          setConversationId(conv.id);
          setModalView("thread");
          setFocusedThreadId(conv.id);
          void markThreadReadRef.current(conv.id);
          return true;
        };

        if (deepLinkConversationId) {
          const opened = await openConversationThread(deepLinkConversationId);
          if (cancelled) return;
          if (opened) return;
        }

        if (focusActiveThread && active.length > 0) {
          const opened = await openConversationThread(active[0]!.id);
          if (cancelled) return;
          if (opened) return;
        }

        if (active.length > 0) {
          setModalView("inbox");
          return;
        }
      } catch {
        if (cancelled) return;
        setActiveChats([]);
      }
      if (!cancelled) {
        resetIntake();
        setModalView("intake");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    visible,
    client,
    resetIntake,
    setFocusedThreadId,
    context?.conversation_id,
    context?.focus_active_thread,
  ]);

  const openThread = useCallback(
    (conv: SupportConversationRow) => {
      setConversationId(conv.id);
      setModalView("thread");
      setFocusedThreadId(conv.id);
      void markThreadReadRef.current(conv.id);
    },
    [setFocusedThreadId],
  );

  const backToInbox = useCallback(() => {
    setConversationId(null);
    setComposerText("");
    setFocusedThreadId(null);
    setModalView(activeChats.length > 0 ? "inbox" : "intake");
  }, [activeChats.length, setFocusedThreadId]);

  const startNewConversation = useCallback(() => {
    resetIntake();
    setConversationId(null);
    setFocusedThreadId(null);
    setModalView("intake");
  }, [resetIntake, setFocusedThreadId]);

  useEffect(() => {
    if (!visible || !conversationId || !client) return;
    const sb = client;
    const messagesChannel = supportApi.subscribeSupportMessages(sb, conversationId, () => {
      void messagesQ.refetch();
      if (modalView === "thread") {
        void markThreadReadRef.current(conversationId);
      }
    });
    const conversationChannel = supportApi.subscribeSupportConversation(sb, conversationId, () => {
      void conversationQ.refetch();
      void messagesQ.refetch();
    });
    return () => {
      supportApi.unsubscribeSupportChannel(sb, messagesChannel);
      supportApi.unsubscribeSupportChannel(sb, conversationChannel);
    };
  }, [visible, conversationId, messagesQ, conversationQ, modalView]);

  useEffect(() => {
    if (!visible || !conversationId || modalView !== "thread" || !client) return;
    void markThreadReadRef.current(conversationId);
  }, [visible, conversationId, modalView, client]);

  const pickCategory = (cat: SupportCategory) => {
    setCategorySlug(cat.slug);
    setLocalBubbles((prev) => [
      ...prev,
      { id: uid(), role: "user", body: cat.label },
      {
        id: uid(),
        role: "bot",
        body: "Got it. Which of these best describes your question?",
      },
    ]);
    setIntakeStep("subcategory");
  };

  const pickSubcategory = (subSlug: string, label: string) => {
    setSubcategorySlug(subSlug);
    const sub = helpSupportGetSubcategory(role, categorySlug!, subSlug);
    setLocalBubbles((prev) => [
      ...prev,
      { id: uid(), role: "user", body: label },
      {
        id: uid(),
        role: "bot",
        body: sub?.prompt ?? "Please describe your issue (required).",
      },
    ]);
    setIntakeStep("details");
  };

  const submitDetails = () => {
    const text = detailsDraft.trim();
    if (text.length < 10) return;
    setLocalBubbles((prev) => [
      ...prev,
      { id: uid(), role: "user", body: text },
      { id: uid(), role: "bot", body: "Connecting you with OorjaMan support…" },
    ]);
    createMut.mutate();
  };

  const liveMessages = messagesQ.data ?? [];
  const showLive = modalView === "thread" && conversationId != null && !createMut.isPending;
  const showIntake = modalView === "intake" && !showLive;
  const showInbox = modalView === "inbox";
  const showLoading = modalView === "loading";
  const canBack =
    modalView === "thread" || (modalView === "intake" && activeChats.length > 0);

  const listData: (SupportMessageRow | LocalBubble)[] = showLive
    ? liveMessages
    : showIntake
      ? localBubbles
      : [];

  useEffect(() => {
    if (listData.length === 0) return;
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [listData.length, showLive]);

  const renderBubble = ({ item }: { item: SupportMessageRow | LocalBubble }) => {
    const isLocal = "role" in item && (item.role === "bot" || item.role === "user");
    if (isLocal) {
      const local = item as LocalBubble;
      const isBot = local.role === "bot";
      return (
        <View style={[styles.bubbleRow, isBot ? styles.bubbleRowBot : styles.bubbleRowUser]}>
          <View style={[styles.bubble, isBot ? styles.bubbleBot : styles.bubbleUser]}>
            <Text style={[styles.bubbleText, isBot ? styles.bubbleTextBot : styles.bubbleTextUser]}>
              {local.body}
            </Text>
          </View>
        </View>
      );
    }

    const msg = item as SupportMessageRow;
    const isParticipant = msg.sender_role === participantRole;
    const isSystem = msg.sender_role === "system";
    const eventKind = supportApi.parseSupportMessageEvent(msg);

    if (isSystem) {
      const iconName =
        eventKind === "agent_joined"
          ? "person-add-outline"
          : eventKind === "agent_transferred"
            ? "swap-horizontal-outline"
            : eventKind === "agent_left_queue"
              ? "time-outline"
              : "information-circle-outline";
      return (
        <View style={styles.timelineRow}>
          <View style={styles.timelineChip}>
            <Ionicons name={iconName} size={16} color={colors.primary} style={styles.timelineIcon} />
            <Text style={styles.timelineText}>{msg.body}</Text>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.bubbleRow,
          isParticipant ? styles.bubbleRowUser : styles.bubbleRowBot,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isParticipant ? styles.bubbleUser : styles.bubbleAdmin,
          ]}
        >
          {!isParticipant ? <Text style={styles.senderTag}>OorjaMan Support</Text> : null}
          <Text
            style={[
              styles.bubbleText,
              isParticipant ? styles.bubbleTextUser : styles.bubbleTextBot,
            ]}
          >
            {msg.body}
          </Text>
          <Text style={styles.bubbleTime}>{formatDisplayDateTime(msg.created_at)}</Text>
        </View>
      </View>
    );
  };

  const sheetTitle =
    modalView === "thread"
      ? conversationQ.data?.subject ??
      supportApi.supportCategoryLabel(
        conversationQ.data?.category_slug ?? "",
        conversationQ.data?.subcategory_slug ?? "",
      ) ??
      "Support chat"
      : modalView === "intake"
        ? "New conversation"
        : "Support chat";

  const assignedAgentName = useMemo(
    () => latestAssignedAgentName(liveMessages),
    [liveMessages],
  );

  const sheetSubtitle =
    modalView === "inbox"
      ? `${activeChats.length} active ${activeChats.length === 1 ? "chat" : "chats"}`
      : modalView === "thread" && conversationQ.data
        ? helpSupportThreadSubtitle(conversationQ.data, assignedAgentName)
        : "We typically reply within business hours";

  if (!visible) return null;

  const scrollBottomPad = Math.max(insets.bottom, spacing.lg) + spacing.xl;
  const footerBottomPad = Math.max(insets.bottom, spacing.sm);

  const fullscreen = presentation === "screen";

  return (
    <View style={[styles.root, fullscreen && styles.rootScreen]}>
      {fullscreen ? null : (
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close help" />
      )}
      <View
        style={[
          styles.sheet,
          fullscreen && styles.sheetScreen,
          fullscreen ? { paddingTop: insets.top } : null,
        ]}
      >
        <ModalSheetHeader
          title={sheetTitle}
          subtitle={sheetSubtitle}
          onClose={onClose}
          onBack={canBack ? backToInbox : undefined}
          closeAccessibilityLabel="Close support chat"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.sheetBody, fullscreen && styles.sheetBodyScreen]}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          {showLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : null}

          {showInbox ? (
            <FlatList
              style={styles.sheetScroll}
              data={activeChats}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[styles.inboxList, { paddingBottom: scrollBottomPad }]}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <Text style={styles.inboxHint}>Tap a chat to continue, or start a new one.</Text>
              }
              renderItem={({ item }) => {
                const label =
                  item.subject ??
                  supportApi.supportCategoryLabel(item.category_slug, item.subcategory_slug);
                return (
                  <Pressable
                    style={({ pressed }) => [styles.inboxCard, pressed && styles.inboxCardPressed]}
                    onPress={() => openThread(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open chat ${label}`}
                  >
                    <View style={styles.inboxCardTop}>
                      <Text style={styles.inboxCardTitle} numberOfLines={1}>
                        {label}
                      </Text>
                      <View style={styles.inboxBadge}>
                        <Text style={styles.inboxBadgeText}>
                          {conversationStatusLabel(item.status)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.inboxCardMeta} numberOfLines={2}>
                      {item.details_text}
                    </Text>
                    <Text style={styles.inboxCardTime}>
                      Last message {formatDisplayDateTime(item.last_message_at)}
                    </Text>
                  </Pressable>
                );
              }}
              ListFooterComponent={
                <View style={styles.newChatBtn}>
                  <Button variant="outline" size="md" onPress={startNewConversation}>
                    Start new conversation
                  </Button>
                </View>
              }
            />
          ) : null}

          {!showInbox && !showLoading ? (
            <FlatList
              style={styles.sheetScroll}
              ref={listRef}
              data={listData}
              keyExtractor={(item) => ("id" in item ? item.id : (item as SupportMessageRow).id)}
              renderItem={renderBubble}
              contentContainerStyle={[styles.chatList, { paddingBottom: scrollBottomPad }]}
              keyboardShouldPersistTaps="handled"
              ListFooterComponent={
                showIntake && intakeStep === "category" ? (
                  <View style={styles.chipsWrap}>
                    {catalog.map((cat) => (
                      <Pressable
                        key={cat.slug}
                        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                        onPress={() => pickCategory(cat)}
                      >
                        <Text style={styles.chipTitle}>{cat.label}</Text>
                        <Text style={styles.chipBody}>{cat.description}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : showIntake && intakeStep === "subcategory" && selectedCategory ? (
                  <View style={styles.chipsWrap}>
                    {selectedCategory.subcategories.map((sub) => (
                      <Pressable
                        key={sub.slug}
                        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                        onPress={() => pickSubcategory(sub.slug, sub.label)}
                      >
                        <Text style={styles.chipTitle}>{sub.label}</Text>
                        {showSubcategoryHints && sub.hint ? (
                          <Text style={styles.chipHint}>{sub.hint}</Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                ) : showIntake && intakeStep === "details" ? (
                  <View style={styles.detailsWrap}>
                    <TextInput
                      style={styles.detailsInput}
                      multiline
                      placeholder="Type your message…"
                      placeholderTextColor={colors.mutedForeground}
                      value={detailsDraft}
                      onChangeText={setDetailsDraft}
                      maxLength={2000}
                    />
                    <Button
                      variant="primary"
                      size="md"
                      loading={createMut.isPending}
                      disabled={detailsDraft.trim().length < 10}
                      onPress={submitDetails}
                    >
                      Send to support
                    </Button>
                  </View>
                ) : showIntake && createMut.isPending ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
                ) : null
              }
            />
          ) : null}

          {showLive && needsCsat ? (
            <View style={[styles.closedBar, { paddingBottom: footerBottomPad + spacing.md }]}>
              <Text style={styles.closedText}>How was this support experience?</Text>
              <View style={styles.csatRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setCsatRating(n)}
                    style={[styles.csatStar, csatRating === n && styles.csatStarActive]}
                  >
                    <Text style={[styles.csatStarText, csatRating === n && styles.csatStarTextActive]}>
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.csatComment}
                placeholder="Optional comment"
                placeholderTextColor={colors.mutedForeground}
                value={csatComment}
                onChangeText={setCsatComment}
                maxLength={500}
              />
              <Button
                variant="primary"
                size="sm"
                loading={csatMut.isPending}
                disabled={csatRating == null}
                onPress={() => csatMut.mutate()}
              >
                Submit feedback
              </Button>
            </View>
          ) : null}

          {showLive && chatClosed && !needsCsat ? (
            <View style={[styles.closedBar, { paddingBottom: footerBottomPad + spacing.md }]}>
              <Text style={styles.closedText}>This chat is closed. Start a new conversation if you need more help.</Text>
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  setConversationId(null);
                  void (async () => {
                    if (!client) return;
                    const active = await helpSupportListActiveConversations(role, client);
                    setActiveChats(active);
                    if (active.length > 0) {
                      setModalView("inbox");
                    } else {
                      resetIntake();
                      setModalView("intake");
                    }
                  })();
                }}
              >
                New conversation
              </Button>
            </View>
          ) : null}

          {showLive && !chatClosed ? (
            <View style={[styles.composerRow, { paddingBottom: footerBottomPad + spacing.md }]}>
              <TextInput
                style={styles.composerInput}
                placeholder="Message support…"
                placeholderTextColor={colors.mutedForeground}
                value={composerText}
                onChangeText={setComposerText}
                maxLength={2000}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send message"
                disabled={!composerText.trim() || sendMut.isPending}
                onPress={() => {
                  const t = composerText.trim();
                  if (t) sendMut.mutate(t);
                }}
                style={({ pressed }) => [
                  styles.sendBtn,
                  (!composerText.trim() || sendMut.isPending) && styles.sendBtnDisabled,
                  pressed && styles.sendBtnPressed,
                ]}
              >
                <Ionicons name="send" size={20} color={colors.primaryForeground} />
              </Pressable>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

export function HelpSupportModal(props: Props) {
  if (!props.visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={props.onClose}
      onDismiss={props.onClose}
      statusBarTranslucent={Platform.OS === "android"}
      navigationBarTranslucent={Platform.OS === "android"}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics ?? undefined}>
        <HelpSupportModalBody {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  rootScreen: {
    justifyContent: "flex-start",
    backgroundColor: colors.background,
  },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    maxHeight: "92%",
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.md,
    overflow: "hidden",
  },
  sheetScreen: {
    flex: 1,
    maxHeight: "100%",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  sheetBody: {
    flexShrink: 1,
    minHeight: 120,
  },
  sheetBodyScreen: {
    flex: 1,
    flexShrink: undefined,
  },
  sheetScroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  loadingWrap: {
    paddingVertical: spacing.xl * 2,
    alignItems: "center",
  },
  inboxList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    flexGrow: 1,
    gap: spacing.sm,
  },
  inboxHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  inboxCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  inboxCardPressed: {
    borderColor: colors.primary,
    opacity: 0.95,
  },
  inboxCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  inboxCardTitle: {
    flex: 1,
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  inboxBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.primaryMuted,
  },
  inboxBadgeText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  inboxCardMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  inboxCardTime: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  newChatBtn: {
    marginTop: spacing.sm,
  },
  chatList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    flexGrow: 1,
    gap: spacing.sm,
  },
  bubbleRow: { marginBottom: spacing.sm },
  bubbleRowBot: { alignItems: "flex-start" },
  bubbleRowUser: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "88%",
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleBot: { backgroundColor: colors.muted },
  bubbleUser: { backgroundColor: colors.primary },
  bubbleAdmin: { backgroundColor: colors.primaryMuted, borderWidth: 1, borderColor: colors.primary },
  bubbleSystem: { backgroundColor: colors.primaryMuted },
  timelineRow: {
    alignItems: "center",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  timelineChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    maxWidth: "96%",
    borderRadius: 12,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  timelineIcon: { flexShrink: 0 },
  timelineText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.foreground,
    textAlign: "center",
  },
  bubbleText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 20 },
  bubbleTextBot: { color: colors.foreground },
  bubbleTextUser: { color: colors.primaryForeground },
  senderTag: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: colors.primary,
    marginBottom: 4,
  },
  bubbleTime: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  chipsWrap: { gap: spacing.sm, marginTop: spacing.sm, paddingBottom: spacing.md },
  chip: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  chipPressed: { opacity: 0.92, borderColor: colors.primary },
  chipTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  chipHint: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.mutedForeground,
  },
  chipBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    marginTop: 4,
    lineHeight: 18,
  },
  detailsWrap: { gap: spacing.sm, marginTop: spacing.sm },
  detailsInput: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.foreground,
    textAlignVertical: "top",
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnPressed: { opacity: 0.88 },
  closedBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.muted,
  },
  closedText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  csatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  csatStar: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  csatStarActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  csatStarText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
  csatStarTextActive: {
    color: colors.primary,
  },
  csatComment: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.foreground,
    minHeight: 44,
  },
});
