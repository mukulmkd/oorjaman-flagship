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
  type SupportCategory,
  type SupportConversationRow,
  type SupportMessageRow,
} from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { colors, spacing } from "@oorjaman/config";
import { Button, ModalSheetHeader } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { supabase } from "../lib/supabase";
import type { HelpSupportContext } from "./help-support-provider";

type Props = {
  visible: boolean;
  context?: HelpSupportContext;
  onClose: () => void;
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

function HelpSupportModalBody({ visible, context, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const listRef = useRef<FlatList<SupportMessageRow | LocalBubble>>(null);

  const [intakeStep, setIntakeStep] = useState<IntakeStep>("category");
  const [categorySlug, setCategorySlug] = useState<string | null>(context?.category_slug ?? null);
  const [subcategorySlug, setSubcategorySlug] = useState<string | null>(null);
  const [detailsDraft, setDetailsDraft] = useState("");
  const [localBubbles, setLocalBubbles] = useState<LocalBubble[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  const [modalView, setModalView] = useState<ModalView>("loading");
  const [activeChats, setActiveChats] = useState<SupportConversationRow[]>([]);

  const catalog = useMemo(() => supportApi.listSupportCatalog(), []);
  const selectedCategory = useMemo(
    () => (categorySlug ? supportApi.getSupportCategory(categorySlug) : undefined),
    [categorySlug],
  );

  const messagesQ = useQuery({
    queryKey: conversationId ? queryKeys.support.messages(conversationId) : [],
    queryFn: () => supportApi.listSupportMessages(supabase!, conversationId!),
    enabled: Boolean(supabase && conversationId),
  });

  const conversationQ = useQuery({
    queryKey: conversationId ? queryKeys.support.conversation(conversationId) : [],
    queryFn: () => supportApi.getSupportConversationById(supabase!, conversationId!),
    enabled: Boolean(supabase && conversationId),
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
      if (!supabase || !conversationId || csatRating == null) {
        throw new Error("Choose a rating.");
      }
      return supportApi.submitSupportCsatAsCustomer(supabase, conversationId, {
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
      if (!supabase || !categorySlug || !subcategorySlug) {
        throw new Error("Complete the help questions first.");
      }
      return supportApi.createSupportConversationAsCustomer(supabase, {
        category_slug: categorySlug,
        subcategory_slug: subcategorySlug,
        details_text: detailsDraft,
        booking_id: context?.booking_id,
        subscription_id: context?.subscription_id,
        service_address_id: context?.service_address_id,
      });
    },
    onSuccess: async (conv) => {
      setConversationId(conv.id);
      setModalView("thread");
      setActiveChats((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
      await qc.invalidateQueries({ queryKey: queryKeys.support.myConversations() });
      await qc.invalidateQueries({ queryKey: queryKeys.support.messages(conv.id) });
    },
  });

  const sendMut = useMutation({
    mutationFn: (body: string) => {
      if (!supabase || !conversationId) throw new Error("No active chat.");
      return supportApi.sendSupportMessageAsCustomer(supabase, {
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
    setIntakeStep(context?.category_slug ? "subcategory" : "category");
    setCategorySlug(context?.category_slug ?? null);
    setSubcategorySlug(null);
    setDetailsDraft("");
    setLocalBubbles([
      {
        id: uid(),
        role: "bot",
        body: "Hi! I'm here to help. Choose a topic below and we'll connect you with OorjaMan support.",
      },
    ]);
    setConversationId(null);
    setComposerText("");
  }, [context?.category_slug]);

  useEffect(() => {
    if (!visible || !supabase) return;
    let cancelled = false;
    setModalView("loading");
    setConversationId(null);
    void (async () => {
      try {
        const active = await supportApi.listActiveSupportConversationsForCustomer(supabase);
        if (cancelled) return;
        setActiveChats(active);
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
  }, [visible, resetIntake]);

  const openThread = useCallback((conv: SupportConversationRow) => {
    setConversationId(conv.id);
    setModalView("thread");
  }, []);

  const backToInbox = useCallback(() => {
    setConversationId(null);
    setComposerText("");
    setModalView(activeChats.length > 0 ? "inbox" : "intake");
  }, [activeChats.length]);

  const startNewConversation = useCallback(() => {
    resetIntake();
    setConversationId(null);
    setModalView("intake");
  }, [resetIntake]);

  useEffect(() => {
    if (!visible || !conversationId || !supabase) return;
    const sb = supabase;
    const messagesChannel = supportApi.subscribeSupportMessages(sb, conversationId, () => {
      void messagesQ.refetch();
    });
    const conversationChannel = supportApi.subscribeSupportConversation(sb, conversationId, () => {
      void conversationQ.refetch();
      void messagesQ.refetch();
    });
    return () => {
      supportApi.unsubscribeSupportChannel(sb, messagesChannel);
      supportApi.unsubscribeSupportChannel(sb, conversationChannel);
    };
  }, [visible, conversationId, messagesQ, conversationQ]);

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
    const sub = supportApi.getSupportSubcategory(categorySlug!, subSlug);
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
    const isCustomer = msg.sender_role === "customer";
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
          isCustomer ? styles.bubbleRowUser : styles.bubbleRowBot,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isCustomer ? styles.bubbleUser : styles.bubbleAdmin,
          ]}
        >
          {!isCustomer ? <Text style={styles.senderTag}>OorjaMan Support</Text> : null}
          <Text
            style={[
              styles.bubbleText,
              isCustomer ? styles.bubbleTextUser : styles.bubbleTextBot,
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
        ? supportApi.supportThreadSubtitleForCustomer(conversationQ.data, assignedAgentName)
        : "We typically reply within business hours";

  if (!visible) return null;

  const scrollBottomPad = Math.max(insets.bottom, spacing.lg) + spacing.xl;
  const footerBottomPad = Math.max(insets.bottom, spacing.sm);

  return (
    <View style={styles.root}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close help" />
      <View style={styles.sheet}>
        <ModalSheetHeader
          title={sheetTitle}
          subtitle={sheetSubtitle}
          onClose={onClose}
          onBack={canBack ? backToInbox : undefined}
          closeAccessibilityLabel="Close support chat"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetBody}
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
                    if (!supabase) return;
                    const active = await supportApi.listActiveSupportConversationsForCustomer(supabase);
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
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="slide"
      onRequestClose={props.onClose}
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
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    maxHeight: "92%",
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.md,
    overflow: "hidden",
  },
  sheetBody: {
    flexShrink: 1,
    minHeight: 120,
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
