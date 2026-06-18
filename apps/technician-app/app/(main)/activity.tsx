import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useIsFocused, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  listTechnicianActivityPage,
  queryKeys,
  readTechnicianActivityReferenceCode,
  subscribeTechnicianActivity,
  isTechnicianActivityExecutable,
  type TechnicianActivityEventRow,
} from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { colors, spacing } from "@oorjaman/config";
import {
  Button,
  Card,
  EmptyStateCard,
  ErrorStateCard,
  Screen,
  SCREEN_EDGES_BENEATH_NATIVE_HEADER,
  SkeletonStack,
} from "@oorjaman/ui";
import { SupportChatHeaderButton } from "../../components/help-header-button";
import { TabNavTitle } from "../../components/tab-nav-title";
import { fontFamily, fontSize } from "../../constants/fonts";
import { supabase } from "../../lib/supabase";

const PAGE_SIZE = 10;

function activityIcon(kind: string): keyof typeof Ionicons.glyphMap {
  if (kind === "job_status_in_progress" || kind === "job_assigned") {
    return "navigate-outline";
  }
  if (kind === "job_status_completed") {
    return "checkmark-circle-outline";
  }
  if (kind === "job_status_cancelled" || kind === "job_unassigned") {
    return "close-circle-outline";
  }
  if (kind === "customer_rating_received") {
    return "star-outline";
  }
  if (kind.startsWith("job_status_")) {
    return "briefcase-outline";
  }
  if (kind === "job_rescheduled") {
    return "calendar-outline";
  }
  return "ellipse-outline";
}

function ActivityEventRow({
  event,
  onPress,
}: {
  event: TechnicianActivityEventRow;
  onPress: () => void;
}) {
  const ref = readTechnicianActivityReferenceCode(event);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.eventRow, pressed && styles.eventRowPressed]}
    >
      <View style={styles.eventIconWrap}>
        <Ionicons name={activityIcon(event.kind)} size={20} color={colors.primary} />
      </View>
      <View style={styles.eventBody}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        {event.summary ? <Text style={styles.eventSummary}>{event.summary}</Text> : null}
        {ref ? <Text style={styles.eventRef}>{ref}</Text> : null}
        <Text style={styles.eventWhen}>{formatDisplayDateTime(event.occurred_at)}</Text>
      </View>
      {event.booking_id ? (
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      ) : null}
    </Pressable>
  );
}

/** Coalesce burst realtime events into one silent refetch. */
function useDebouncedCallback<T extends (...args: unknown[]) => void>(fn: T, delayMs: number): T {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  fnRef.current = fn;
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
  return useCallback(
    ((...args) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(...args), delayMs);
    }) as T,
    [delayMs],
  );
}

export default function ActivityTab() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  useLayoutEffect(() => {
    const tab = navigation.getParent();
    tab?.setOptions({
      headerTitle: "",
      headerLeft: () => <TabNavTitle title="Activity" />,
      headerRight: () => <SupportChatHeaderButton />,
    });
  }, [navigation]);

  const activityQ = useInfiniteQuery({
    queryKey: queryKeys.technicianActivity.all(),
    queryFn: ({ pageParam }) =>
      listTechnicianActivityPage(supabase!, { offset: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextOffset : undefined),
    enabled: Boolean(supabase),
  });

  const events = activityQ.data?.pages.flatMap((p) => p.items) ?? [];
  const showLoadMore = Boolean(activityQ.hasNextPage);
  const loadingMore = activityQ.isFetchingNextPage;

  const silentRefetch = useCallback(() => {
    void activityQ.refetch();
  }, [activityQ]);

  const debouncedSilentRefetch = useDebouncedCallback(silentRefetch, 600);

  useEffect(() => {
    if (!supabase || !isFocused) return;
    let unsub: (() => void) | undefined;
    void subscribeTechnicianActivity(supabase, debouncedSilentRefetch).then((fn) => {
      unsub = fn;
    });
    return () => unsub?.();
  }, [debouncedSilentRefetch, isFocused]);

  const openEvent = useCallback((event: TechnicianActivityEventRow) => {
    if (!event.booking_id) return;
    if (isTechnicianActivityExecutable(event)) {
      router.push(`/(main)/jobs/execute/${event.booking_id}`);
      return;
    }
    router.push(`/(main)/jobs/${event.booking_id}`);
  }, []);

  const onPullRefresh = useCallback(async () => {
    await activityQ.refetch();
  }, [activityQ]);

  if (!supabase) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        <Text style={styles.muted}>Configure Supabase to view activity.</Text>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={activityQ.isRefetching && !loadingMore} onRefresh={() => void onPullRefresh()} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lede}>
          Assignments, job started, job finished, ratings, and other updates on your visits - newest first.
        </Text>

        {activityQ.isPending ? (
          <Card variant="muted" padded>
            <SkeletonStack rows={6} />
          </Card>
        ) : activityQ.isError ? (
          <ErrorStateCard
            title="Couldn't load activity"
            message={(activityQ.error as Error).message}
            onRetry={() => void activityQ.refetch()}
            retryLabel="Retry"
          />
        ) : events.length === 0 ? (
          <EmptyStateCard
            title="No activity yet"
            description="When you are assigned visits and their status changes, updates will show up here."
          />
        ) : (
          <Card variant="elevated" padded={false}>
            {events.map((event, index) => (
              <View key={event.id}>
                {index > 0 ? <View style={styles.eventDivider} /> : null}
                <View style={styles.eventPad}>
                  <ActivityEventRow
                    event={event}
                    onPress={() => openEvent(event)}
                  />
                </View>
              </View>
            ))}
          </Card>
        )}

        {showLoadMore ? (
          <Button
            variant="outline"
            size="md"
            loading={loadingMore}
            disabled={loadingMore}
            accessibilityLabel="Load more activity"
            onPress={() => void activityQ.fetchNextPage()}
            style={styles.loadMore}
          >
            Load more
          </Button>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  lede: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
  },
  eventPad: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  eventDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 36,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  eventRowPressed: {
    opacity: 0.92,
  },
  eventIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  eventBody: {
    flex: 1,
    gap: 2,
  },
  eventTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  eventSummary: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  eventRef: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  eventWhen: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  loadMore: {
    alignSelf: "center",
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
});
