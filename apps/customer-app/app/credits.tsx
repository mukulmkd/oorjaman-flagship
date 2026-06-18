import { useCallback } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  formatInrFromCents,
  getCustomerOorjamanCreditsSummary,
  listCustomerOorjamanCreditGrants,
  OORJAMAN_CREDIT_PAISE,
  queryKeys,
  VENDOR_LAST_HOUR_CANCEL_CUSTOMER_CREDITS,
} from "@oorjaman/api";
import { formatDisplayDate } from "@oorjaman/utils";
import { colors, spacing } from "@oorjaman/config";
import {
  Card,
  EmptyStateCard,
  ErrorStateCard,
  ModalSheetHeader,
  Screen,
  SCREEN_EDGES_MODAL,
  useModalStackHeader,
} from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { supabase } from "../lib/supabase";

const CREDITS_SHEET_TITLE = "OorjaMan Credits";
const CREDITS_SHEET_SUBTITLE = "1 Credit = ₹1 off your next one-time visit";

export default function OorjamanCreditsScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const isIosSheet = Platform.OS === "ios";
  const iosSheetMaxHeight = windowHeight * 0.92;

  const summaryQuery = useQuery({
    queryKey: queryKeys.finance.customerOorjamanCredits(),
    queryFn: () => getCustomerOorjamanCreditsSummary(supabase!),
    enabled: Boolean(supabase),
  });

  const grantsQuery = useQuery({
    queryKey: [...queryKeys.finance.customerOorjamanCredits(), "grants"],
    queryFn: () => listCustomerOorjamanCreditGrants(supabase!),
    enabled: Boolean(supabase),
  });

  const closeModal = useCallback(() => {
    router.back();
  }, []);

  const modalHeader = useModalStackHeader({
    title: CREDITS_SHEET_TITLE,
    subtitle: CREDITS_SHEET_SUBTITLE,
    onClose: closeModal,
    closeAccessibilityLabel: "Close credits",
  });

  const isRefreshing = summaryQuery.isFetching || grantsQuery.isFetching;

  const onRefresh = useCallback(() => {
    void summaryQuery.refetch();
    void grantsQuery.refetch();
  }, [summaryQuery, grantsQuery]);

  const body = (
    <>
      {summaryQuery.isError ? (
        <ErrorStateCard
          title="Couldn't load credits"
          message={(summaryQuery.error as Error).message}
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : summaryQuery.isPending ? (
        <Card variant="muted" padded>
          <Text style={styles.meta}>Loading your wallet…</Text>
        </Card>
      ) : (
        <>
          <Card variant="elevated" padded>
            <Text style={styles.balanceLabel}>Available balance</Text>
            <Text style={styles.balanceValue}>{summaryQuery.data?.balance_credits ?? 0} Credits</Text>
            <Text style={styles.balanceHint}>
              Worth {formatInrFromCents(summaryQuery.data?.balance_paise ?? 0)} on future bookings
            </Text>
          </Card>

          <Card variant="muted" padded>
            <Text style={styles.infoTitle}>How credits work</Text>
            <Text style={styles.infoBody}>
              When a service partner cancels within the last hour before your visit, OorjaMan assigns a new partner and
              adds {VENDOR_LAST_HOUR_CANCEL_CUSTOMER_CREDITS} apology Credits to your wallet. Each Credit equals ₹
              {OORJAMAN_CREDIT_PAISE / 100}. Credits expire one year after they are issued and apply automatically at
              checkout on one-time visits.
            </Text>
          </Card>

          <Text style={styles.sectionLabel}>Credit history</Text>
          {(grantsQuery.data ?? []).length === 0 ? (
            <EmptyStateCard
              title="No credits yet"
              description="Credits appear here when we add an apology Credit after a late partner cancellation."
            />
          ) : (
            (grantsQuery.data ?? []).map((grant) => {
              const expired = new Date(grant.expires_at).getTime() <= Date.now();
              const usedUp = grant.credits_remaining <= 0;
              return (
                <View key={grant.id} style={styles.grantCard}>
                  <Card variant="elevated" padded>
                    <Text style={styles.grantTitle}>
                      {grant.credits_issued} Credits · {formatInrFromCents(grant.credits_issued * OORJAMAN_CREDIT_PAISE)}
                    </Text>
                    <Text style={styles.grantMeta}>
                      {grant.credits_remaining} remaining · Valid until {formatDisplayDate(grant.expires_at)}
                    </Text>
                    <Text style={styles.grantReason}>
                      {grant.reason === "vendor_last_hour_cancel"
                        ? "Apology credit - partner cancelled within the last hour before your visit"
                        : grant.reason}
                    </Text>
                    {expired ? (
                      <Text style={styles.grantStatus}>Expired</Text>
                    ) : usedUp ? (
                      <Text style={styles.grantStatus}>Fully used</Text>
                    ) : (
                      <Text style={styles.grantStatusActive}>Active</Text>
                    )}
                  </Card>
                </View>
              );
            })
          )}
        </>
      )}
    </>
  );

  if (isIosSheet) {
    return (
      <View style={styles.iosRoot}>
        <Pressable style={styles.backdrop} onPress={closeModal} accessibilityLabel="Close credits" />
        <View
          style={[
            styles.iosSheet,
            {
              maxHeight: iosSheetMaxHeight,
              paddingBottom: spacing.md + insets.bottom,
            },
          ]}
        >
          <ModalSheetHeader
            title={CREDITS_SHEET_TITLE}
            subtitle={CREDITS_SHEET_SUBTITLE}
            onClose={closeModal}
            closeAccessibilityLabel="Close credits"
          />
          <ScrollView
            style={styles.iosScroll}
            contentContainerStyle={styles.iosScrollContent}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {body}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <Screen edges={SCREEN_EDGES_MODAL}>
      {modalHeader}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {body}
      </ScrollView>
    </Screen>
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
  iosScroll: {
    flexShrink: 1,
    minHeight: 120,
  },
  iosScrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  scroll: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  balanceLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  balanceValue: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.foreground,
  },
  balanceHint: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  infoTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  infoBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  sectionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  grantCard: {
    marginBottom: spacing.sm,
  },
  grantTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  grantMeta: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  grantReason: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.foreground,
  },
  grantStatus: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    textTransform: "uppercase",
  },
  grantStatusActive: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.primary,
    textTransform: "uppercase",
  },
  meta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
});
