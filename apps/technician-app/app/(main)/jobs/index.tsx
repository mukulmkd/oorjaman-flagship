import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { bookingApi, queryKeys } from "@oorjaman/api";
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
import { spacing } from "@oorjaman/config";
import { JobListCard } from "../../../components/job-list-card";
import { JobSegmentBar } from "../../../components/job-segment-bar";
import { TabScreenHeader } from "../../../components/tab-screen-header";
import {
  filterBookingsBySegment,
  sortBookingsForSegment,
  type JobListSegment,
} from "../../../lib/job-list-filters";
import { supabase } from "../../../lib/supabase";

function JobRowSkeleton() {
  return (
    <Card variant="muted" padded>
      <SkeletonBar variant="dense" />
    </Card>
  );
}

export default function AssignedJobsScreen() {
  const [segment, setSegment] = useState<JobListSegment>("today");

  const query = useQuery({
    queryKey: queryKeys.bookings.list({ scope: "technician-assigned" }),
    queryFn: () => bookingApi.listVisibleBookings(supabase!),
    enabled: Boolean(supabase),
  });

  const all = query.data ?? [];

  const segmentCounts = useMemo(() => {
    const counts: Partial<Record<JobListSegment, number>> = {};
    for (const seg of ["today", "upcoming", "active", "completed"] as JobListSegment[]) {
      counts[seg] = filterBookingsBySegment(all, seg).length;
    }
    return counts;
  }, [all]);

  const filtered = useMemo(
    () => sortBookingsForSegment(filterBookingsBySegment(all, segment), segment),
    [all, segment],
  );

  const renderItem: ListRenderItem<BookingRow> = useCallback(
    ({ item }) => (
      <JobListCard
        item={item}
        onPress={() => {
          if (item.status === "in_progress") {
            router.push(`/(main)/jobs/execute/${item.id}`);
          } else {
            router.push(`/(main)/jobs/${item.id}`);
          }
        }}
      />
    ),
    [],
  );

  const Separator = useCallback(() => <View style={styles.gapMd} />, []);

  const refreshControl = (
    <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
  );

  const header = (
    <View style={styles.headerBlock}>
      <TabScreenHeader
        lede="Filtered by visit timing. Open a job to start with the customer's Job Start Code."
        style={styles.headerInScaffold}
      />
      <View style={styles.segmentBleed}>
        <JobSegmentBar value={segment} onChange={setSegment} counts={segmentCounts} />
      </View>
    </View>
  );

  if (!supabase) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        <TabScreenHeader lede="Sign in to load your roster." />
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
      {query.isPending ? (
        <View style={styles.bodyTop}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skelGap}>
              <JobRowSkeleton />
            </View>
          ))}
        </View>
      ) : query.isError ? (
        <View style={styles.bodyTop}>
          <ErrorStateCard
            title="Couldn't load jobs"
            message={(query.error as Error).message}
            onRetry={() => void query.refetch()}
            retryLabel="Retry"
          />
        </View>
      ) : filtered.length === 0 ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.bodyTop}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          <EmptyStateCard
            title={`No ${segment} jobs`}
            description="Try another filter or pull down to refresh after dispatch assigns a visit."
          />
        </ScrollView>
      ) : (
        <FlashList
          data={filtered}
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
    gap: spacing.xs,
  },
  headerInScaffold: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  segmentBleed: {
    marginHorizontal: -spacing.md,
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
  skelGap: {
    marginBottom: spacing.md,
  },
  gapMd: {
    height: spacing.md,
  },
});
