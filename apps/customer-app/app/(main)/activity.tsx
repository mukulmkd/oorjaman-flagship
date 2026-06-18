import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useIsFocused } from "expo-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  customerActivityApi,
  customerApi,
  queryKeys,
  type CustomerSiteActivityEventRow,
} from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { colors, spacing } from "@oorjaman/config";
import {
  Button,
  Card,
  EmptyStateCard,
  ErrorStateCard,
  FadeInView,
  Screen,
  SCREEN_EDGES_BENEATH_NATIVE_HEADER,
  SkeletonStack,
} from "@oorjaman/ui";
import { ActivityBookingMapPreview } from "../../components/activity-booking-map-preview";
import { ServiceAddressPickerSheet } from "../../components/service-address-picker-sheet";
import { fontFamily, fontSize } from "../../constants/fonts";
import {
  buildAddressBookPatch,
  mergeServiceGpsIntoCustomerPatch,
  readServiceAddressBook,
  serviceAddressFormatted,
  type ServiceAddressEntry,
  type ServiceAddressSaveExtras,
} from "../../lib/service-address-book";
import { supabase } from "../../lib/supabase";

const ACTIVITY_PAGE_SIZE = 10;

function activityIcon(kind: string): keyof typeof Ionicons.glyphMap {
  if (kind.startsWith("booking_status_in_progress") || kind === "booking_technician_assigned") {
    return "navigate-outline";
  }
  if (kind === "customer_rating_submitted") return "star-outline";
  if (kind === "booking_rescheduled") return "calendar-outline";
  if (kind.startsWith("booking_")) return "calendar-outline";
  if (kind.startsWith("amc_")) return "shield-checkmark-outline";
  return "ellipse-outline";
}

function ActivityEventRow({
  event,
  onPress,
}: {
  event: CustomerSiteActivityEventRow;
  onPress: () => void;
}) {
  const ref = customerActivityApi.readActivityReferenceCode(event);
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
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
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

export default function ActivityScreen() {
  const qc = useQueryClient();
  const isFocused = useIsFocused();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const customerQuery = useQuery({
    queryKey: queryKeys.customers.mine(),
    queryFn: () => customerApi.getMyCustomer(supabase!),
    enabled: Boolean(supabase),
  });

  const addressBook = useMemo(
    () => readServiceAddressBook(customerQuery.data ?? null),
    [customerQuery.data],
  );

  useEffect(() => {
    if (selectedAddressId && addressBook.entries.some((e) => e.id === selectedAddressId)) return;
    setSelectedAddressId(addressBook.defaultId ?? addressBook.entries[0]?.id ?? null);
  }, [addressBook.defaultId, addressBook.entries, selectedAddressId]);

  const selectedEntry = useMemo(
    () => addressBook.entries.find((e) => e.id === selectedAddressId) ?? null,
    [addressBook.entries, selectedAddressId],
  );

  const activityQuery = useInfiniteQuery({
    queryKey: queryKeys.customerActivity.forAddress(selectedAddressId ?? "__none__"),
    queryFn: ({ pageParam }) =>
      customerActivityApi.listCustomerSiteActivityPageForAddress(supabase!, {
        service_address_id: selectedAddressId!,
        offset: pageParam,
        limit: ACTIVITY_PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextOffset : undefined),
    enabled: Boolean(supabase && selectedAddressId),
  });

  const trackableQuery = useQuery({
    queryKey: queryKeys.customerActivity.trackableBooking(selectedAddressId ?? "__none__"),
    queryFn: () => customerActivityApi.getTrackableBookingForAddress(supabase!, selectedAddressId!),
    enabled: Boolean(supabase && selectedAddressId),
    /** Poll only while this tab is visible; realtime covers most timeline updates. */
    refetchInterval: isFocused ? 45_000 : false,
    refetchIntervalInBackground: false,
  });

  const silentRefetchActivity = useCallback(() => {
    void activityQuery.refetch();
    void trackableQuery.refetch();
  }, [activityQuery, trackableQuery]);

  const debouncedSilentRefetch = useDebouncedCallback(silentRefetchActivity, 600);

  const onPullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([activityQuery.refetch(), trackableQuery.refetch()]);
    } finally {
      setPullRefreshing(false);
    }
  }, [activityQuery, trackableQuery]);

  useEffect(() => {
    if (!supabase || !selectedAddressId || !isFocused) return;
    let unsub: (() => void) | undefined;
    void customerActivityApi
      .subscribeCustomerSiteActivityForAddress(supabase, selectedAddressId, debouncedSilentRefetch)
      .then((fn) => {
        unsub = fn;
      });
    return () => unsub?.();
  }, [selectedAddressId, debouncedSilentRefetch, isFocused]);

  const addressBookMut = useMutation({
    mutationFn: async (payload: {
      entries: ServiceAddressEntry[];
      defaultId: string | null;
      extras?: ServiceAddressSaveExtras;
    }) => {
      if (!supabase || !customerQuery.data) throw new Error("Customer profile unavailable.");
      const patch = buildAddressBookPatch(customerQuery.data, payload.entries, payload.defaultId);
      return customerApi.updateMyCustomer(supabase, mergeServiceGpsIntoCustomerPatch(patch, payload.extras));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.customers.mine() });
    },
  });

  const events = activityQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const showLoadMore = Boolean(activityQuery.hasNextPage);
  const loadingMore = activityQuery.isFetchingNextPage;
  const trackable = trackableQuery.data ?? null;

  const openEvent = useCallback((event: CustomerSiteActivityEventRow) => {
    if (event.booking_id) {
      router.push({ pathname: "/booking-detail", params: { id: event.booking_id } });
      return;
    }
    if (event.subscription_id) {
      router.push("/(main)/subscription");
    }
  }, []);

  if (!supabase) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        <Text style={styles.muted}>Configure Supabase to view activity.</Text>
      </Screen>
    );
  }

  const pending = customerQuery.isPending;

  return (
    <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={pullRefreshing} onRefresh={() => void onPullRefresh()} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.lede}>
            Bookings, visit status changes, reschedules, ratings, AMC updates, and more - grouped by service address.
          </Text>
        </View>

        {pending ? (
          <View style={styles.pad}>
            <Card variant="muted" padded>
              <SkeletonStack rows={6} />
            </Card>
          </View>
        ) : addressBook.entries.length === 0 ? (
          <View style={styles.pad}>
            <EmptyStateCard
              title="Add a service address"
              description="Activity is grouped by site. Add an address in Profile to see your timeline here."
            />
            <View style={{ marginTop: spacing.md }}>
              <Button variant="outline" size="md" onPress={() => router.push("/(main)/profile")}>
                Go to Profile
              </Button>
            </View>
          </View>
        ) : (
          <FadeInView style={styles.fadeStretch}>
            <View style={styles.pad}>
              <Text style={styles.sectionLabel}>Your site</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAddressPickerOpen(true)}
                style={({ pressed }) => [styles.addressPick, pressed && styles.addressPickPressed]}
              >
                <View style={styles.addressPickText}>
                  <Text style={styles.addressPickLabel}>{selectedEntry?.label ?? "Choose address"}</Text>
                  {selectedEntry ? (
                    <Text style={styles.addressPickBody} numberOfLines={2}>
                      {serviceAddressFormatted(selectedEntry.address)}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-down" size={20} color={colors.primary} />
              </Pressable>
            </View>

            {trackable ? (
              <View style={styles.pad}>
                <ActivityBookingMapPreview
                  bookingId={trackable.id}
                  referenceCode={trackable.reference_code}
                  scheduledStart={trackable.scheduled_start}
                  liveUpdatesEnabled={isFocused}
                  onOpenFullMap={() =>
                    router.push({ pathname: "/booking-track", params: { id: trackable.id } })
                  }
                />
              </View>
            ) : null}

            <View style={styles.pad}>
              <Text style={styles.sectionLabel}>Timeline</Text>
              {activityQuery.isError ? (
                <ErrorStateCard
                  title="Couldn't load activity"
                  message={(activityQuery.error as Error).message}
                  onRetry={() => void onPullRefresh()}
                  retryLabel="Retry"
                />
              ) : activityQuery.isPending ? (
                <Card variant="muted" padded>
                  <SkeletonStack rows={5} />
                </Card>
              ) : events.length === 0 ? (
                <EmptyStateCard
                  title="No activity yet"
                  description="Book a visit or subscribe to AMC for this address - updates will appear here."
                />
              ) : (
                <>
                  <Card variant="muted" padded={false}>
                    {events.map((event, index) => (
                      <View key={event.id}>
                        {index > 0 ? <View style={styles.eventDivider} /> : null}
                        <View style={styles.eventPad}>
                          <ActivityEventRow event={event} onPress={() => openEvent(event)} />
                        </View>
                      </View>
                    ))}
                  </Card>
                  {showLoadMore ? (
                    <Button
                      variant="outline"
                      size="md"
                      loading={loadingMore}
                      disabled={loadingMore}
                      accessibilityLabel="Load more activity"
                      onPress={() => void activityQuery.fetchNextPage()}
                      style={styles.loadMore}
                    >
                      Load more
                    </Button>
                  ) : null}
                </>
              )}
            </View>
          </FadeInView>
        )}
      </ScrollView>

      <ServiceAddressPickerSheet
        visible={addressPickerOpen}
        entries={addressBook.entries}
        defaultId={addressBook.defaultId}
        onClose={() => setAddressPickerOpen(false)}
        onSave={async (entries, defaultId, extras) => {
          await addressBookMut.mutateAsync({ entries, defaultId, extras });
          const nextId = defaultId ?? entries[0]?.id ?? null;
          if (nextId) setSelectedAddressId(nextId);
          setAddressPickerOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: 0,
    paddingBottom: spacing.sm,
  },
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
  },
  pad: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  fadeStretch: {
    alignSelf: "stretch",
    width: "100%",
  },
  sectionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  addressPick: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  addressPickPressed: {
    opacity: 0.94,
  },
  addressPickText: {
    flex: 1,
    gap: spacing.xs,
  },
  addressPickLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  addressPickBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
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
    marginTop: spacing.md,
    alignSelf: "center",
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
});
