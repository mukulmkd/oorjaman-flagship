import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { bookingApi, customerApi, queryKeys, vendorApi } from "@oorjaman/api";
import type { VendorRow } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import {
  Button,
  Card,
  EmptyStateCard,
  ErrorStateCard,
  ModalSheetHeader,
  Screen,
  SkeletonBar,
  modalScrollContentStyle,
  SCREEN_EDGES_MODAL,
  useModalStackHeader,
} from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import {
  buildAddressBookPatch,
  MAX_PREFERRED_VENDORS_PER_ADDRESS,
  preferredIdsAfterAppend,
  readFallbackVendorIdFromCustomer,
  readPreferredVendorIdsForDefaultServiceLocation,
  readServiceAddressBook,
  setEntryPreferredVendorIds,
} from "../lib/service-address-book";
import { supabase } from "../lib/supabase";

const PARTNERS_PAGE_SIZE = 5;
const IOS_PARTNER_ROW_HEIGHT = 88;
const IOS_EMPTY_STATE_HEIGHT = 120;
const IOS_HEADER_BLOCK_HEIGHT = 118;
const IOS_LEDE_HEIGHT = 66;
const IOS_CLEAR_BUTTON_HEIGHT = 52;
const IOS_SHOW_MORE_HEIGHT = 44;
const IOS_SHEET_MIN_HEIGHT = 300;

function vendorStatsCaption(
  stats:
    | { avg_rating: number | null | undefined; total_jobs?: number | null; rating_count?: number | null }
    | undefined,
): string {
  const jobs = stats?.total_jobs ?? 0;
  const rating = stats?.avg_rating;
  const filled =
    rating != null && Number.isFinite(rating) ? Math.max(1, Math.min(5, Math.round(rating))) : 0;
  const stars = filled ? "★".repeat(filled) + "☆".repeat(5 - filled) : "☆☆☆☆☆";
  const ratingBit =
    rating != null && Number.isFinite(rating)
      ? `${rating.toFixed(1)} / 5${stats?.rating_count ? ` (${stats.rating_count})` : ""}`
      : "No rating yet";
  return `${jobs} services · ${stars} · ${ratingBit}`;
}

function computeIosSheetHeight(input: {
  windowHeight: number;
  bottomInset: number;
  rowCount: number;
  hasClearButton: boolean;
  hasShowMore: boolean;
  expanded: boolean;
}): number {
  const maxSheet = input.windowHeight * 0.92;
  if (input.expanded && input.rowCount > PARTNERS_PAGE_SIZE) {
    return maxSheet;
  }

  const rowsHeight = input.rowCount > 0 ? input.rowCount * IOS_PARTNER_ROW_HEIGHT : IOS_EMPTY_STATE_HEIGHT;
  const fit =
    IOS_HEADER_BLOCK_HEIGHT +
    IOS_LEDE_HEIGHT +
    (input.hasClearButton ? IOS_CLEAR_BUTTON_HEIGHT : 0) +
    rowsHeight +
    (input.hasShowMore ? IOS_SHOW_MORE_HEIGHT : 0) +
    spacing.md +
    input.bottomInset;

  return Math.min(maxSheet, Math.max(IOS_SHEET_MIN_HEIGHT, fit));
}

export default function PreferredPartnerModal() {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [showAllPartners, setShowAllPartners] = useState(false);
  const isIosSheet = Platform.OS === "ios";

  const customerQuery = useQuery({
    queryKey: queryKeys.customers.mine(),
    queryFn: () => customerApi.getMyCustomer(supabase!),
    enabled: Boolean(supabase),
  });

  const completedVendorIdsQuery = useQuery({
    queryKey: queryKeys.bookings.completedVendorIds(),
    queryFn: () => bookingApi.listDistinctVendorIdsFromCompletedCustomerBookings(supabase!),
    enabled: Boolean(supabase && customerQuery.data),
  });

  const vendorsQuery = useQuery({
    queryKey: queryKeys.vendors.approvedDirectory(),
    queryFn: () => vendorApi.listApprovedVendors(supabase!),
    enabled: Boolean(supabase),
  });

  const prefs = useMemo(() => {
    const c = customerQuery.data ?? null;
    return {
      preferredIds: readPreferredVendorIdsForDefaultServiceLocation(c),
      fallbackId: readFallbackVendorIdFromCustomer(c),
    };
  }, [customerQuery.data]);

  const vendorsToShow = useMemo((): VendorRow[] => {
    const approved = vendorsQuery.data ?? [];
    const byId = new Map(approved.map((v) => [v.id, v]));
    const completedOrdered = completedVendorIdsQuery.data ?? [];
    const preferred = prefs.preferredIds;
    const seen = new Set<string>();
    const idOrder: string[] = [];
    for (const id of completedOrdered) {
      const row = byId.get(id);
      if (!row || seen.has(id)) continue;
      seen.add(id);
      idOrder.push(id);
    }
    for (const id of preferred) {
      const row = byId.get(id);
      if (!row || seen.has(id)) continue;
      seen.add(id);
      idOrder.push(id);
    }
    return idOrder.map((id) => byId.get(id)!);
  }, [vendorsQuery.data, completedVendorIdsQuery.data, prefs.preferredIds]);

  const hasMorePartners = vendorsToShow.length > PARTNERS_PAGE_SIZE;
  const displayedVendors = useMemo(() => {
    if (showAllPartners || !hasMorePartners) return vendorsToShow;
    return vendorsToShow.slice(0, PARTNERS_PAGE_SIZE);
  }, [showAllPartners, hasMorePartners, vendorsToShow]);

  const vendorStatsIds = useMemo(() => vendorsToShow.map((v) => v.id).sort(), [vendorsToShow]);

  const vendorStatsQuery = useQuery({
    queryKey: queryKeys.vendors.publicStats(vendorStatsIds.join(",")),
    queryFn: () => vendorApi.listVendorPublicStats(supabase!, vendorStatsIds),
    enabled: Boolean(supabase && vendorStatsIds.length > 0),
  });

  const vendorStatsById = useMemo(() => {
    const m = new Map<string, Awaited<ReturnType<typeof vendorApi.listVendorPublicStats>>[number]>();
    for (const s of vendorStatsQuery.data ?? []) m.set(s.vendor_id, s);
    return m;
  }, [vendorStatsQuery.data]);

  const closeModal = useCallback(() => {
    router.back();
  }, []);

  const modalHeader = useModalStackHeader({
    title: "Preferred partners",
    onClose: closeModal,
    closeAccessibilityLabel: "Close preferred partners",
  });

  const saveMut = useMutation({
    mutationFn: async (nextIds: string[]) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const c = customerQuery.data;
      if (!c) throw new Error("Customer profile not loaded.");
      const { entries, defaultId } = readServiceAddressBook(c);
      const targetId = defaultId ?? entries[0]?.id ?? null;
      if (!targetId) throw new Error("Add a saved service address in Profile before choosing partners.");
      let fallback = prefs.fallbackId;
      if (fallback && nextIds.includes(fallback)) fallback = null;
      const nextEntries = setEntryPreferredVendorIds(entries, targetId, nextIds);
      const patch = buildAddressBookPatch(c, nextEntries, defaultId, { fallbackVendorId: fallback });
      return customerApi.updateMyCustomer(supabase, patch);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.customers.mine() });
    },
  });

  const onToggle = useCallback(
    (vendorId: string) => {
      if (saveMut.isPending) return;
      const c = customerQuery.data;
      if (!c) return;
      const current = readPreferredVendorIdsForDefaultServiceLocation(c);
      let next: string[];
      if (current.includes(vendorId)) {
        next = current.filter((id) => id !== vendorId);
      } else {
        const appended = preferredIdsAfterAppend(current, vendorId);
        if (!appended.includes(vendorId)) {
          Alert.alert(
            "Preferred list full",
            `You can save up to ${MAX_PREFERRED_VENDORS_PER_ADDRESS} preferred partners per saved address. Remove one before adding another.`,
          );
          return;
        }
        next = appended;
      }
      saveMut.mutate(next);
    },
    [saveMut, customerQuery.data],
  );

  const onClearAll = useCallback(() => {
    if (saveMut.isPending || prefs.preferredIds.length === 0) return;
    saveMut.mutate([]);
  }, [saveMut, prefs.preferredIds.length]);

  const iosSheetHeight = useMemo(
    () =>
      computeIosSheetHeight({
        windowHeight,
        bottomInset: insets.bottom,
        rowCount: displayedVendors.length,
        hasClearButton: prefs.preferredIds.length > 0,
        hasShowMore: hasMorePartners && !showAllPartners,
        expanded: showAllPartners,
      }),
    [
      windowHeight,
      insets.bottom,
      displayedVendors.length,
      prefs.preferredIds.length,
      hasMorePartners,
      showAllPartners,
    ],
  );

  const iosListScrollMax = Math.max(
    120,
    iosSheetHeight - IOS_HEADER_BLOCK_HEIGHT - IOS_LEDE_HEIGHT - spacing.md - insets.bottom,
  );

  const renderBody = (contentContainerStyle: typeof modalScrollContentStyle | undefined) => (
    <>
      <Text style={styles.lede}>
        Partners from completed visits on your account. Toggle who you prefer for your saved address — you still pick
        one partner when you book each visit.
      </Text>
      {prefs.preferredIds.length > 0 ? (
        <Button variant="outline" size="md" loading={saveMut.isPending} onPress={onClearAll}>
          Clear all preferred partners
        </Button>
      ) : null}
      {saveMut.isError ? <Text style={styles.error}>{(saveMut.error as Error).message}</Text> : null}
      {vendorStatsQuery.isError ? (
        <Text style={styles.warnMuted}>{(vendorStatsQuery.error as Error).message}</Text>
      ) : null}
      {vendorsToShow.length === 0 ? (
        <EmptyStateCard
          title="No partners here yet"
          description="After you complete a visit with a partner, they appear here so you can save them as preferred."
        />
      ) : (
        <View style={styles.list}>
          {displayedVendors.map((v) => {
            const checked = prefs.preferredIds.includes(v.id);
            const stats = vendorStatsById.get(v.id);
            return (
              <VendorToggleRow
                key={v.id}
                vendor={v}
                checked={checked}
                disabled={saveMut.isPending}
                statsCaption={vendorStatsCaption(stats)}
                onPress={() => onToggle(v.id)}
              />
            );
          })}
        </View>
      )}
      {hasMorePartners && !showAllPartners ? (
        <Button variant="ghost" size="md" onPress={() => setShowAllPartners(true)}>
          Show more ({vendorsToShow.length - PARTNERS_PAGE_SIZE})
        </Button>
      ) : null}
    </>
  );

  const renderLoading = () => (
    <Card variant="muted" padded>
      <SkeletonBar variant="title" />
      <View style={styles.gap} />
      <SkeletonBar variant="full" />
    </Card>
  );

  if (!supabase) {
    return (
      <PreferredPartnerShell
        isIosSheet={isIosSheet}
        modalHeader={modalHeader}
        iosSheetHeight={iosSheetHeight}
        bottomInset={insets.bottom}
        onClose={closeModal}
      >
        <Text style={styles.muted}>Configure Supabase.</Text>
      </PreferredPartnerShell>
    );
  }

  if (customerQuery.isPending || vendorsQuery.isPending || completedVendorIdsQuery.isPending) {
    return (
      <PreferredPartnerShell
        isIosSheet={isIosSheet}
        modalHeader={modalHeader}
        iosSheetHeight={iosSheetHeight}
        bottomInset={insets.bottom}
        onClose={closeModal}
      >
        {renderLoading()}
      </PreferredPartnerShell>
    );
  }

  if (vendorsQuery.isError) {
    return (
      <PreferredPartnerShell
        isIosSheet={isIosSheet}
        modalHeader={modalHeader}
        iosSheetHeight={iosSheetHeight}
        bottomInset={insets.bottom}
        onClose={closeModal}
      >
        <ErrorStateCard
          title="Could not load partners"
          message={(vendorsQuery.error as Error).message}
          onRetry={() => void vendorsQuery.refetch()}
        />
      </PreferredPartnerShell>
    );
  }

  if (completedVendorIdsQuery.isError) {
    return (
      <PreferredPartnerShell
        isIosSheet={isIosSheet}
        modalHeader={modalHeader}
        iosSheetHeight={iosSheetHeight}
        bottomInset={insets.bottom}
        onClose={closeModal}
      >
        <ErrorStateCard
          title="Could not load your visit history"
          message={(completedVendorIdsQuery.error as Error).message}
          onRetry={() => void completedVendorIdsQuery.refetch()}
        />
      </PreferredPartnerShell>
    );
  }

  if ((vendorsQuery.data ?? []).length === 0) {
    return (
      <PreferredPartnerShell
        isIosSheet={isIosSheet}
        modalHeader={modalHeader}
        iosSheetHeight={iosSheetHeight}
        bottomInset={insets.bottom}
        onClose={closeModal}
      >
        <EmptyStateCard title="No approved partners yet" description="Check back soon - the list updates as partners are verified." />
      </PreferredPartnerShell>
    );
  }

  if (isIosSheet) {
    const scrollEnabled = showAllPartners && hasMorePartners;
    return (
      <View style={styles.iosRoot}>
        <Pressable style={styles.backdrop} onPress={closeModal} accessibilityLabel="Close preferred partners" />
        <View
          style={[
            styles.iosSheet,
            {
              maxHeight: iosSheetHeight,
              paddingBottom: spacing.md + insets.bottom,
            },
          ]}
        >
          <ModalSheetHeader
            title="Preferred partners"
            subtitle={
              vendorsToShow.length > 0
                ? `${prefs.preferredIds.length} preferred · ${vendorsToShow.length} from your visits`
                : undefined
            }
            onClose={closeModal}
            closeAccessibilityLabel="Close preferred partners"
          />
          <ScrollView
            style={scrollEnabled ? { maxHeight: iosListScrollMax } : undefined}
            contentContainerStyle={styles.iosScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={scrollEnabled}
            scrollEnabled={scrollEnabled}
            bounces={scrollEnabled}
          >
            {renderBody(undefined)}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <Screen padded={false} edges={SCREEN_EDGES_MODAL}>
      {modalHeader}
      <ScrollView
        contentContainerStyle={[modalScrollContentStyle, styles.scroll]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderBody(undefined)}
      </ScrollView>
    </Screen>
  );
}

function PreferredPartnerShell({
  isIosSheet,
  modalHeader,
  iosSheetHeight,
  bottomInset,
  onClose,
  children,
}: {
  isIosSheet: boolean;
  modalHeader: React.ReactNode;
  iosSheetHeight: number;
  bottomInset: number;
  onClose: () => void;
  children: ReactNode;
}) {
  if (isIosSheet) {
    return (
      <View style={styles.iosRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close preferred partners" />
        <View
          style={[
            styles.iosSheet,
            {
              maxHeight: iosSheetHeight,
              paddingBottom: spacing.md + bottomInset,
            },
          ]}
        >
          <ModalSheetHeader
            title="Preferred partners"
            onClose={onClose}
            closeAccessibilityLabel="Close preferred partners"
          />
          <View style={styles.iosScrollContent}>{children}</View>
        </View>
      </View>
    );
  }

  return (
    <Screen padded={false} edges={SCREEN_EDGES_MODAL}>
      {modalHeader}
      <View style={modalScrollContentStyle}>{children}</View>
    </Screen>
  );
}

function VendorToggleRow({
  vendor,
  checked,
  disabled,
  statsCaption,
  onPress,
}: {
  vendor: VendorRow;
  checked: boolean;
  disabled: boolean;
  statsCaption: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && styles.rowDisabled]}
    >
      <View style={[styles.checkOuter, checked && styles.checkOuterOn]}>{checked ? <Text style={styles.checkMark}>✓</Text> : null}</View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{vendor.business_name}</Text>
        {vendor.trade_name ? <Text style={styles.rowSub}>{vendor.trade_name}</Text> : null}
        <Text style={styles.statsLine}>{statsCaption}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iosRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  iosSheet: {
    width: "100%",
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.md,
    overflow: "hidden",
  },
  iosScrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  scroll: {
    flexGrow: 1,
  },
  lede: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
  warnMuted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  error: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.destructive,
    marginBottom: spacing.sm,
  },
  gap: { height: spacing.sm },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: IOS_PARTNER_ROW_HEIGHT - spacing.sm,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  rowPressed: {
    opacity: 0.92,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  checkOuter: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkOuterOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkMark: {
    color: colors.primaryForeground,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semiBold,
    lineHeight: fontSize.sm + 2,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  rowSub: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  statsLine: {
    marginTop: 6,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
});
