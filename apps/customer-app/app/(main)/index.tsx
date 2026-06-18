import { StyleSheet, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { useLayoutEffect, useMemo, useState } from "react";
import { useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerApi, queryKeys, subscriptionApi } from "@oorjaman/api";
import { SupportChatHeaderButton } from "../../components/help-header-button";
import { customerFirstName } from "../../lib/customer-first-name";
import { Screen, Button } from "@oorjaman/ui";
import { colors, spacing } from "@oorjaman/config";
import { fontFamily, fontSize } from "../../constants/fonts";
import { supabase } from "../../lib/supabase";
import {
  buildAddressBookPatch,
  mergeServiceGpsIntoCustomerPatch,
  readServiceAddressBook,
  serviceAddressFormatted,
  type ServiceAddressEntry,
  type ServiceAddressSaveExtras,
} from "../../lib/service-address-book";
import { ServiceAddressPickerSheet } from "../../components/service-address-picker-sheet";
import {
  activeSubscriptionForCurrentServiceSite,
  formatSubscriptionValidThrough,
  renewalDueSubscriptionForCurrentServiceSite,
} from "../../lib/customer-active-amc";
import { navigateToBookVisit } from "../../lib/book-visit-navigation";

export default function HomeTab() {
  const navigation = useNavigation();
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const customerQ = useQuery({
    queryKey: queryKeys.customers.mine(),
    queryFn: () => customerApi.getMyCustomer(supabase!),
    enabled: Boolean(supabase),
  });
  const subsQ = useQuery({
    queryKey: queryKeys.subscriptions.list(),
    queryFn: () => subscriptionApi.listVisibleSubscriptions(supabase!),
    enabled: Boolean(supabase),
  });
  const activeAmc = useMemo(
    () => activeSubscriptionForCurrentServiceSite(customerQ.data ?? null, subsQ.data),
    [customerQ.data, subsQ.data],
  );
  const renewalDueAmc = useMemo(
    () =>
      activeAmc
        ? null
        : renewalDueSubscriptionForCurrentServiceSite(customerQ.data ?? null, subsQ.data),
    [activeAmc, customerQ.data, subsQ.data],
  );
  const addressMut = useMutation({
    mutationFn: async (payload: {
      entries: ServiceAddressEntry[];
      defaultId: string | null;
      extras?: ServiceAddressSaveExtras;
    }) => {
      if (!supabase || !customerQ.data) throw new Error("Customer profile unavailable.");
      const patch = buildAddressBookPatch(customerQ.data, payload.entries, payload.defaultId);
      return customerApi.updateMyCustomer(supabase, mergeServiceGpsIntoCustomerPatch(patch, payload.extras));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.customers.mine() });
    },
  });
  const { entries, defaultId } = readServiceAddressBook(customerQ.data ?? null);
  const selected = defaultId ? entries.find((e) => e.id === defaultId) ?? null : entries[0] ?? null;
  const locationLine = selected
    ? `${selected.label} - ${serviceAddressFormatted(selected.address)}`
    : "Add service address";

  const greetingName = customerFirstName(customerQ.data?.display_name);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: colors.background,
      },
      headerTintColor: colors.foreground,
      headerRight: () => <SupportChatHeaderButton />,
      headerRightContainerStyle: { paddingRight: 8 },
      headerLeftContainerStyle: {
        paddingLeft: 8,
        maxWidth: "72%",
      },
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            selected ? `Service location ${locationLine}. Tap to change` : "Add service location"
          }
          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
          style={styles.navLocation}
          onPress={() => setPickerOpen(true)}
        >
          <Ionicons name="location-outline" size={21} color={colors.primary} />
          <Text style={styles.navLocationText} numberOfLines={1}>
            {locationLine}
          </Text>
          <Ionicons name="chevron-down" size={17} color={colors.mutedForeground} />
        </Pressable>
      ),
    });
  }, [navigation, selected, locationLine]);

  return (
    <Screen padded edges={["left", "right"]}>
      <View style={styles.hero}>
        <Text style={styles.hello}>Hello, {greetingName}</Text>
        <Text style={styles.headline}>Plan your next clean</Text>
        <Text style={styles.sub}>
          Book a visit, track status, and keep production high - all from one place.
        </Text>
      </View>
      {activeAmc ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Active AMC plan ${activeAmc.plan_name}, valid until ${formatSubscriptionValidThrough(activeAmc.ends_at)}. Opens AMC plans.`}
          onPress={() => router.push("/(main)/subscription")}
          style={({ pressed }) => [styles.amcHomeCard, pressed && styles.amcHomeCardPressed]}
        >
          <View style={styles.amcPill}>
            <Text style={styles.amcPillText}>AMC active</Text>
          </View>
          <Text style={styles.amcHomePlan} numberOfLines={2}>
            {activeAmc.plan_name}
          </Text>
          <Text style={styles.amcHomeMeta}>
            Valid through {formatSubscriptionValidThrough(activeAmc.ends_at)} · tap to manage
          </Text>
        </Pressable>
      ) : renewalDueAmc ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`AMC ended ${formatSubscriptionValidThrough(renewalDueAmc.ends_at)}. Renew from AMC plans.`}
          onPress={() => router.push("/(main)/subscription")}
          style={({ pressed }) => [styles.amcHomeCard, styles.amcHomeCardRenew, pressed && styles.amcHomeCardPressed]}
        >
          <View style={[styles.amcPill, styles.amcPillRenew]}>
            <Text style={[styles.amcPillText, styles.amcPillTextRenew]}>Renew AMC</Text>
          </View>
          <Text style={styles.amcHomePlan} numberOfLines={2}>
            {renewalDueAmc.plan_name}
          </Text>
          <Text style={styles.amcHomeMeta}>
            Ended {formatSubscriptionValidThrough(renewalDueAmc.ends_at)} · choose a plan below
          </Text>
        </Pressable>
      ) : null}
      <Button
        variant="primary"
        size="lg"
        onPress={() => {
          if (!supabase) return;
          void navigateToBookVisit(supabase, customerQ.data ?? null, subsQ.data);
        }}
      >
        Book a visit
      </Button>
      <View style={{ height: spacing.sm }} />
      <Button variant="outline" size="lg" onPress={() => router.push("/(main)/subscription")}>
        Solar AMC plans
      </Button>
      <View style={[styles.card, styles.cardSpacing]}>
        <Text style={styles.cardTitle}>Quick tips</Text>
        <Text style={styles.cardBody}>
          Pick a preferred partner in Profile if you like, or let OorjaMan assign one. Choose a slot that respects same-day
          lead times, then confirm your site address.
        </Text>
      </View>
      <ServiceAddressPickerSheet
        visible={pickerOpen}
        entries={entries}
        defaultId={defaultId}
        onClose={() => setPickerOpen(false)}
        onSave={async (nextEntries, nextDefaultId, extras) => {
          await addressMut.mutateAsync({ entries: nextEntries, defaultId: nextDefaultId, extras });
          setPickerOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  navLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
    minHeight: 40,
    flexShrink: 1,
  },
  navLocationText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  hero: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  hello: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
  headline: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxl,
    letterSpacing: -0.3,
    color: colors.foreground,
  },
  sub: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 24,
    color: colors.mutedForeground,
  },
  amcHomeCard: {
    alignSelf: "stretch",
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  amcHomeCardPressed: {
    opacity: 0.92,
  },
  amcHomeCardRenew: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  amcPill: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: `${colors.primary}18`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.primary}40`,
  },
  amcPillText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    letterSpacing: 0.3,
    color: colors.primary,
    textTransform: "uppercase",
  },
  amcPillRenew: {
    backgroundColor: `${colors.destructive}14`,
    borderColor: `${colors.destructive}35`,
  },
  amcPillTextRenew: {
    color: colors.destructive,
  },
  amcHomePlan: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  amcHomeMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  cardSpacing: {
    marginTop: spacing.lg,
  },
  card: {
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  cardBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
  },
});
