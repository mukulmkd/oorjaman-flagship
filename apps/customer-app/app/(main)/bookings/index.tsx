import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  bookingApi,
  customerApi,
  customerBookingDisplayTitle,
  customerBookingVisitDateVisible,
  queryKeys,
  shouldHideAmcBookingFromCustomerList,
  readBookingOpsMeta,
  readBookingRecipientMeta,
  readBookingVendorReassignmentMeta,
  technicianApi,
  userApi,
} from "@oorjaman/api";
import type { BookingRow, BookingStatus } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { bookingStatusLabel, bookingUiBucket, isValidBookingRow } from "../../../lib/booking-status";
import {
  AppScaffold,
  Button,
  Card,
  SCREEN_EDGES_BENEATH_NATIVE_HEADER,
  EmptyStateCard,
  ErrorStateCard,
  FadeInView,
  Screen,
  SkeletonStack,
} from "@oorjaman/ui";
import { fontFamily, fontSize } from "../../../constants/fonts";
import { isBookingAwaitingOorjamanPartnerAssignment } from "../../../lib/booking-partner-messaging";
import { bookingSupportMailto } from "../../../lib/support";
import { navigateToBookVisit } from "../../../lib/book-visit-navigation";
import { supabase } from "../../../lib/supabase";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { TabNavTitle } from "../../../components/tab-nav-title";
import { SupportChatHeaderButton } from "../../../components/help-header-button";

const BOOKINGS_PAGE_SIZE = 4;

/** Visit date on the booking (`scheduled_start`), latest first; tie-break by when the row was created. */
function sortBookingsByScheduledStartDesc(rows: BookingRow[]): BookingRow[] {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.scheduled_start).getTime();
    const tb = new Date(b.scheduled_start).getTime();
    if (ta !== tb) return tb - ta;
    const ca = new Date(a.created_at).getTime();
    const cb = new Date(b.created_at).getTime();
    return cb - ca;
  });
}

function StatusChip(props: { row?: BookingRow | null; status?: BookingStatus }) {
  const status = props.row?.status ?? props.status;
  if (!status) return null;
  const bucket = bookingUiBucket(status);
  const label = bookingStatusLabel(status, props.row ?? undefined);
  const chipStyles =
    bucket === "pending"
      ? styles.chipPending
      : bucket === "accepted"
        ? styles.chipAccepted
        : bucket === "completed"
          ? styles.chipCompleted
          : styles.chipEnded;

  return (
    <View style={styles.chipMeasure}>
      <View style={[styles.chip, chipStyles]}>
        <Text style={styles.chipText} maxFontSizeMultiplier={1.35}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function bookingForLabel(row: BookingRow): string | null {
  const rec = readBookingRecipientMeta(row.metadata);
  if (!rec || rec.is_self) return null;
  return rec.recipient_name?.trim() || "Someone else";
}

function bookingOpsLabel(row: BookingRow): string | null {
  const reassign = readBookingVendorReassignmentMeta(row.metadata);
  if (row.status === "confirmed" && (reassign.awaitingAdminAssignment || isBookingAwaitingOorjamanPartnerAssignment(row))) {
    return "OorjaMan is assigning your partner";
  }
  const ops = readBookingOpsMeta(row.metadata);
  if (!ops || ops.issue_count <= 0) return null;
  return "Ops team is monitoring this booking";
}

export default function MyBookingsScreen() {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    const tab = navigation.getParent();
    tab?.setOptions({
      headerTitle: "",
      headerLeft: () => <TabNavTitle title="Bookings" />,
      headerRight: () => <SupportChatHeaderButton />,
    });
  }, [navigation]);

  const userQuery = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => userApi.getMyUserRecord(supabase!),
    enabled: Boolean(supabase),
  });

  const customerQuery = useQuery({
    queryKey: queryKeys.customers.mine(),
    queryFn: () => customerApi.getMyCustomer(supabase!),
    enabled: Boolean(supabase),
  });

  const roleReady = userQuery.isSuccess;

  const query = useQuery({
    queryKey: queryKeys.bookings.list(),
    queryFn: () => bookingApi.listVisibleBookings(supabase!),
    enabled: Boolean(supabase),
  });

  useFocusEffect(
    useCallback(() => {
      if (supabase) void query.refetch();
    }, [query, supabase]),
  );
  const reportsQuery = useQuery({
    queryKey: queryKeys.jobReports.list({ limit: 400 }),
    queryFn: () => technicianApi.listVisibleJobReports(supabase!, { limit: 400 }),
    enabled: Boolean(supabase),
  });
  const ratingByBookingId = new Map((reportsQuery.data ?? []).map((r) => [r.booking_id, r.customer_rating] as const));

  const sortedBookings = useMemo(
    () =>
      sortBookingsByScheduledStartDesc(
        (query.data ?? [])
          .filter(isValidBookingRow)
          .filter((b) => !shouldHideAmcBookingFromCustomerList(b)),
      ),
    [query.data],
  );

  const [visibleCount, setVisibleCount] = useState(BOOKINGS_PAGE_SIZE);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const displayedBookings = useMemo(
    () => sortedBookings.slice(0, Math.min(visibleCount, sortedBookings.length)),
    [sortedBookings, visibleCount],
  );
  const showLoadMore =
    sortedBookings.length >= BOOKINGS_PAGE_SIZE && visibleCount < sortedBookings.length;

  const onPullRefresh = useCallback(async () => {
    setVisibleCount(BOOKINGS_PAGE_SIZE);
    setPullRefreshing(true);
    try {
      await Promise.all([query.refetch(), reportsQuery.refetch()]);
    } finally {
      setPullRefreshing(false);
    }
  }, [query, reportsQuery]);

  const renderItem: ListRenderItem<BookingRow> = useCallback(
    ({ item }) => {
      if (!isValidBookingRow(item)) return null;
      const forLabel = bookingForLabel(item);
      const opsLabel = bookingOpsLabel(item);
      const go = () => {
        if (!roleReady) return;
        router.push({ pathname: "/booking-detail", params: { id: item.id } });
      };
      const canRateVisit =
        item.status === "completed" &&
        !(ratingByBookingId.get(item.id) && Number(ratingByBookingId.get(item.id)) > 0);
      const title = customerBookingDisplayTitle(item);
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}, ${bookingStatusLabel(item.status, item)}`}
          onPress={go}
          disabled={!roleReady}
          style={({ pressed }) => [styles.rowPress, pressed && styles.rowPressed, !roleReady && styles.rowDisabled]}
        >
          <Card variant="elevated" padded>
            <View style={styles.rowTop}>
              <Text style={styles.ref}>{title}</Text>
              <StatusChip row={item} />
            </View>
            {customerBookingVisitDateVisible(item) ? (
              <Text style={styles.when}>{formatDisplayDateTime(item.scheduled_start)}</Text>
            ) : null}
            {forLabel ? (
              <Text style={styles.forChip}>For: {forLabel}</Text>
            ) : null}
            {opsLabel ? <Text style={styles.opsChip}>{opsLabel}</Text> : null}
            {canRateVisit ? (
              <Text style={styles.ratingPendingChip}>Rate this visit (optional)</Text>
            ) : null}
            <Text style={styles.hint}>Tap for details</Text>
          </Card>
        </Pressable>
      );
    },
    [roleReady, ratingByBookingId],
  );

  const keyExtractor = useCallback((item: BookingRow) => item.id, []);

  const Separator = useCallback(() => <View style={styles.gapSm} />, []);

  if (!supabase) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        <Card variant="outline" padded>
          <Text style={styles.bodyMuted}>Sign in and configure Supabase to load your bookings.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <AppScaffold
      edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}
      contentContainerStyle={styles.listContent}
      header={
        <View style={styles.header}>
          <Text style={styles.lede}>
            Sorted by visit date (newest first). Up to four at a time; use Load more when you have more than four. Pull down to refresh.
          </Text>
          <Button
            variant="outline"
            size="sm"
            onPress={() => {
              if (!supabase) return;
              void navigateToBookVisit(supabase, customerQuery.data ?? null);
            }}
          >
            New request
          </Button>
        </View>
      }
    >

      {query.isPending ? (
        <Card variant="muted" padded>
          <SkeletonStack rows={6} />
        </Card>
      ) : query.isError ? (
        <View>
          <ErrorStateCard
            title="Something went wrong"
            message={(query.error as Error).message}
            onRetry={() => void query.refetch()}
            retryLabel="Retry"
          />
        </View>
      ) : (
        <FadeInView style={styles.flex}>
          <FlashList
            data={displayedBookings}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ItemSeparatorComponent={Separator}
            style={styles.flex}
            contentContainerStyle={[sortedBookings.length === 0 && styles.listEmpty]}
            refreshControl={<RefreshControl refreshing={pullRefreshing} onRefresh={() => void onPullRefresh()} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <EmptyStateCard
                  title="No bookings yet"
                  description="Request a slot with an approved partner - you'll track status here from pending through completion."
                  action={
                    <Button
                      variant="primary"
                      size="md"
                      onPress={() => {
                        if (!supabase) return;
                        void navigateToBookVisit(supabase, customerQuery.data ?? null);
                      }}
                    >
                      Book a visit
                    </Button>
                  }
                />
                <Pressable
                  accessibilityRole="link"
                  style={styles.emptySupport}
                  onPress={() => {
                    const url = bookingSupportMailto({ topic: "Help with my Oorjaman bookings" });
                    void Linking.openURL(url);
                  }}
                >
                  <Text style={styles.footerLink}>Email support</Text>
                </Pressable>
              </View>
            }
            ListFooterComponent={
              sortedBookings.length > 0 ? (
                <View style={styles.listFooterWrap}>
                  {showLoadMore ? (
                    <Button
                      variant="outline"
                      size="md"
                      accessibilityLabel="Load more bookings"
                      onPress={() =>
                        setVisibleCount((n) => Math.min(n + BOOKINGS_PAGE_SIZE, sortedBookings.length))
                      }
                    >
                      Load more
                    </Button>
                  ) : null}
                  <View style={styles.listFooter}>
                    <Text style={styles.footerHint}>Need help with a booking?</Text>
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => {
                        const url = bookingSupportMailto({ topic: "Help with my Oorjaman bookings" });
                        void Linking.openURL(url);
                      }}
                    >
                      <Text style={styles.footerLink}>Email support</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null
            }
            showsVerticalScrollIndicator={false}
          />
        </FadeInView>
      )}
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: { gap: spacing.sm, paddingTop: 0 },
  kicker: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  lede: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
    marginBottom: 0,
  },
  gapSm: {
    height: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  rowPress: {
    borderRadius: 16,
  },
  rowPressed: {
    opacity: 0.92,
  },
  rowDisabled: {
    opacity: 0.6,
  },
  rowTop: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: spacing.sm,
  },
  ref: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.foreground,
  },
  chipMeasure: {
    width: "100%",
  },
  when: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  hint: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  forChip: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing["3xs"] + 1,
  },
  opsChip: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.primaryBorder,
    backgroundColor: colors.primaryMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing["3xs"] + 1,
  },
  ratingPendingChip: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.primary,
    backgroundColor: colors.primaryMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing["3xs"] + 1,
  },
  chip: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexShrink: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing["3xs"] + 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.foreground,
  },
  chipPending: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primaryBorder,
  },
  chipAccepted: {
    backgroundColor: colors.muted,
    borderColor: colors.border,
  },
  chipCompleted: {
    backgroundColor: colors.elevated,
    borderColor: colors.primary,
  },
  chipEnded: {
    backgroundColor: colors.muted,
    borderColor: colors.border,
    opacity: 0.85,
  },
  bodyMuted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
  },
  emptyWrap: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  emptySupport: {
    marginTop: spacing.md,
  },
  listFooterWrap: {
    paddingTop: spacing.md,
    gap: spacing.md,
    alignItems: "stretch",
  },
  listFooter: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.xs,
    alignItems: "center",
  },
  footerHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  footerLink: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
});
