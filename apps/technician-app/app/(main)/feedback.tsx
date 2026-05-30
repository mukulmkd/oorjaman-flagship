import { useCallback, useLayoutEffect, useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import { bookingApi, queryKeys, technicianApi } from "@oorjaman/api";
import type { BookingRow } from "@oorjaman/api";
import {
  AppScaffold,
  Card,
  EmptyStateCard,
  ErrorStateCard,
  Screen,
  SCREEN_EDGES_BENEATH_NATIVE_HEADER,
  SkeletonBar,
} from "@oorjaman/ui";
import { colors, spacing } from "@oorjaman/config";
import { fontFamily, fontSize } from "../../constants/fonts";
import { JobListCard } from "../../components/job-list-card";
import { SupportChatHeaderButton } from "../../components/help-header-button";
import { TabNavTitle } from "../../components/tab-nav-title";
import { TabScreenHeader } from "../../components/tab-screen-header";
import { completedBookings } from "../../lib/job-list-filters";
import { supabase } from "../../lib/supabase";

function FeedbackRowSkeleton() {
  return (
    <Card variant="muted" padded>
      <SkeletonBar variant="dense" />
    </Card>
  );
}

export default function FeedbackTab() {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    const tab = navigation.getParent();
    tab?.setOptions({
      headerTitle: "",
      headerLeft: () => <TabNavTitle title="Feedback" />,
      headerRight: () => <SupportChatHeaderButton />,
    });
  }, [navigation]);

  const techQ = useQuery({
    queryKey: queryKeys.technicians.me(),
    queryFn: () => technicianApi.getMyTechnicianProfile(supabase!),
    enabled: Boolean(supabase),
  });

  const bookingsQ = useQuery({
    queryKey: queryKeys.bookings.list({ scope: "technician-assigned" }),
    queryFn: () => bookingApi.listVisibleBookings(supabase!),
    enabled: Boolean(supabase),
  });

  const reportsQ = useQuery({
    queryKey: queryKeys.jobReports.list({ limit: 200 }),
    queryFn: () => technicianApi.listVisibleJobReports(supabase!, { limit: 200 }),
    enabled: Boolean(supabase),
  });

  const rows = useMemo(() => completedBookings(bookingsQ.data ?? []), [bookingsQ.data]);
  const stats = useQuery({
    queryKey: queryKeys.technicians.publicStats(techQ.data?.id ?? ""),
    queryFn: () =>
      technicianApi.listTechnicianPublicStats(supabase!, techQ.data?.id ? [techQ.data.id] : []),
    enabled: Boolean(supabase && techQ.data?.id),
  }).data?.[0];

  const ratingByBooking = useMemo(
    () => new Map((reportsQ.data ?? []).map((r) => [r.booking_id, r.customer_rating] as const)),
    [reportsQ.data],
  );

  const renderItem: ListRenderItem<BookingRow> = useCallback(
    ({ item }) => {
      const rating = ratingByBooking.get(item.id);
      return (
        <View>
          <JobListCard item={item} cta="View summary" onPress={() => router.push(`/(main)/jobs/${item.id}`)} />
          {rating != null ? (
            <Text style={styles.ratingLine}>Customer rating: {rating} / 5</Text>
          ) : null}
        </View>
      );
    },
    [ratingByBooking],
  );

  const Separator = useCallback(() => <View style={styles.gapMd} />, []);

  const refreshControl = (
    <RefreshControl refreshing={bookingsQ.isRefetching} onRefresh={() => void bookingsQ.refetch()} />
  );

  const header = (
    <View style={styles.headerBlock}>
      <TabScreenHeader
        lede="Completed visits and customer ratings. Sorted by visit date, newest first."
        style={styles.headerInScaffold}
      />
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats?.total_jobs ?? 0}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {stats?.avg_rating != null ? stats.avg_rating.toFixed(1) : "-"}
          </Text>
          <Text style={styles.statLabel}>Avg rating</Text>
        </View>
      </View>
    </View>
  );

  if (!supabase) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        <TabScreenHeader lede="Configure Supabase to load feedback." />
      </Screen>
    );
  }

  return (
    <AppScaffold
      scrollable={false}
      edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}
      header={header}
      contentContainerStyle={styles.scaffoldBody}
    >
      {bookingsQ.isPending ? (
        <View style={styles.bodyTop}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skelGap}>
              <FeedbackRowSkeleton />
            </View>
          ))}
        </View>
      ) : bookingsQ.isError ? (
        <View style={styles.bodyTop}>
          <ErrorStateCard
            title="Couldn't load feedback"
            message={(bookingsQ.error as Error).message}
            onRetry={() => void bookingsQ.refetch()}
            retryLabel="Retry"
          />
        </View>
      ) : rows.length === 0 ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.bodyTop}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          <EmptyStateCard
            title="No customer feedback yet"
            description="Finished jobs will appear here with ratings when customers leave feedback."
          />
        </ScrollView>
      ) : (
        <FlashList
          data={rows}
          style={styles.list}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={styles.listContent}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      )}
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  scaffoldBody: {
    flex: 1,
    paddingVertical: 0,
  },
  headerBlock: {
    gap: spacing.sm,
  },
  headerInScaffold: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
  },
  statValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.foreground,
  },
  statLabel: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
  list: {
    flex: 1,
  },
  bodyTop: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  gapMd: { height: spacing.md },
  skelGap: { marginBottom: spacing.md },
  ratingLine: {
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
});
