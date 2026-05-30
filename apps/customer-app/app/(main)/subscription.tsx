import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  bookingApi,
  customerApi,
  customerBookingVisitDateVisible,
  formatAmcPlanSubtitle,
  formatInrFromCents,
  getActiveSubscriptionForAddress,
  getRenewalDueSubscriptionForAddress,
  getCustomerSolarSizing,
  readSubscriptionCapacityTierCode,
  listAmcPlansForTier,
  listAmcUpgradePlansForSubscription,
  listPricingAmcPlans,
  queryKeys,
  resolveGeoPricingTierAddons,
  readSubscriptionServiceAddressId,
  serviceAddressCityKeyFromJson,
  formatAmcVisitLabel,
  isAmcVisitSlotBookedByCustomer,
  isCustomerScheduledAmcMetadata,
  subscriptionApi,
} from "@oorjaman/api";
import { formatDisplayDate, formatDisplayDateTime } from "@oorjaman/utils";
import { bookingStatusLabel } from "../../lib/booking-status";
import type {
  BookingRow,
  PricingAmcPlanRow,
  SubscriptionRow,
  SubscriptionVisitSlotRow,
} from "@oorjaman/api";
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
import { AmcUpgradeSheet } from "../../components/amc-upgrade-sheet";
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

function visitSlotStatusLabel(status: SubscriptionVisitSlotRow["status"]): string {
  switch (status) {
    case "pending":
      return "Not scheduled";
    case "scheduled":
      return "Scheduled";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function readBookingServiceAddressId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const v = (metadata as Record<string, unknown>).service_address_id;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function bookingBelongsToAddress(booking: BookingRow, addressId: string, subId: string | null): boolean {
  const metaAddr = readBookingServiceAddressId(booking.metadata);
  if (metaAddr) return metaAddr === addressId;
  if (subId && booking.subscription_id === subId) return true;
  return false;
}

export default function SubscriptionAmcScreen() {
  const qc = useQueryClient();
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [upgradeSheetOpen, setUpgradeSheetOpen] = useState(false);

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

  const subsQuery = useQuery({
    queryKey: queryKeys.subscriptions.list(),
    queryFn: () => subscriptionApi.listVisibleSubscriptions(supabase!),
    enabled: Boolean(supabase),
  });

  const bookingsQuery = useQuery({
    queryKey: queryKeys.bookings.list(),
    queryFn: () => bookingApi.listVisibleBookings(supabase!),
    enabled: Boolean(supabase),
  });

  const subscriptions = subsQuery.data ?? [];

  const activeByAddressId = useMemo(() => {
    const m = new Map<string, SubscriptionRow>();
    for (const entry of addressBook.entries) {
      const sub = getActiveSubscriptionForAddress(subscriptions, entry.id);
      if (sub) m.set(entry.id, sub);
    }
    return m;
  }, [addressBook.entries, subscriptions]);

  const renewalDueByAddressId = useMemo(() => {
    const m = new Map<string, SubscriptionRow>();
    for (const entry of addressBook.entries) {
      const sub = getRenewalDueSubscriptionForAddress(subscriptions, entry.id);
      if (sub) m.set(entry.id, sub);
    }
    return m;
  }, [addressBook.entries, subscriptions]);

  const selectedEntry = useMemo(
    () => addressBook.entries.find((e) => e.id === selectedAddressId) ?? null,
    [addressBook.entries, selectedAddressId],
  );

  const activeForSelected = selectedAddressId
    ? (activeByAddressId.get(selectedAddressId) ?? null)
    : null;

  const renewalDueForSelected = selectedAddressId
    ? (renewalDueByAddressId.get(selectedAddressId) ?? null)
    : null;

  const visitSlotsQuery = useQuery({
    queryKey: queryKeys.subscriptions.visitSlots(activeForSelected?.id ?? "__none__"),
    queryFn: () =>
      subscriptionApi.listAmcVisitSlotsForSubscription(supabase!, activeForSelected!.id),
    enabled: Boolean(supabase && activeForSelected?.id),
  });

  const amcVisitSlots = visitSlotsQuery.data ?? [];

  const scheduledAmcBookingsById = useMemo(() => {
    const m = new Map<string, BookingRow>();
    for (const b of bookingsQuery.data ?? []) {
      if (b.id) m.set(b.id, b);
    }
    return m;
  }, [bookingsQuery.data]);

  /** Upcoming paid one-time visits at this address (shown for context only - not convertible to AMC). */
  const upcomingOneTimeSeparate = useMemo(() => {
    if (!selectedAddressId || !activeForSelected) return [];
    const today = startOfToday();
    const rows = bookingsQuery.data ?? [];
    return rows
      .filter(
        (b) =>
          b.subscription_id == null &&
          ["pending_payment", "confirmed", "accepted"].includes(b.status) &&
          new Date(b.scheduled_start) >= today &&
          bookingBelongsToAddress(b, selectedAddressId, null),
      )
      .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
      .slice(0, 24);
  }, [bookingsQuery.data, selectedAddressId, activeForSelected]);

  const solarSizing = useMemo(
    () => getCustomerSolarSizing(customerQuery.data ?? null),
    [customerQuery.data],
  );

  const amcTierOutOfSync = useMemo(() => {
    if (!activeForSelected || !solarSizing.ready) return false;
    const subTier = readSubscriptionCapacityTierCode(activeForSelected);
    return subTier != null && subTier !== solarSizing.tierCode;
  }, [activeForSelected, solarSizing]);

  const geoAddonSlug = useMemo(
    () => serviceAddressCityKeyFromJson(selectedEntry?.address ?? null) ?? "__none__",
    [selectedEntry?.address],
  );

  const geoAddonsQuery = useQuery({
    queryKey: queryKeys.pricing.geoTierAddonsForCity("IN", geoAddonSlug),
    queryFn: () =>
      resolveGeoPricingTierAddons(supabase!, {
        countryCode: "IN",
        cityKey: geoAddonSlug === "__none__" ? null : geoAddonSlug,
      }),
    enabled: Boolean(supabase && selectedEntry && solarSizing.ready),
  });

  const amcTierAddonPaise = Math.max(0, geoAddonsQuery.data?.amc_addon_cents ?? 0);

  const amcPlansQuery = useQuery({
    queryKey: queryKeys.pricing.capacityCatalog("IN"),
    queryFn: () => listPricingAmcPlans(supabase!),
    enabled: Boolean(supabase),
  });

  const amcPlansForCapacity = useMemo((): PricingAmcPlanRow[] => {
    if (!solarSizing.ready) return [];
    return listAmcPlansForTier(amcPlansQuery.data ?? [], solarSizing.tierCode);
  }, [amcPlansQuery.data, solarSizing]);

  const activeCatalogPlan = useMemo(() => {
    if (!activeForSelected) return null;
    return (amcPlansQuery.data ?? []).find((p) => p.plan_code === activeForSelected.plan_code) ?? null;
  }, [activeForSelected, amcPlansQuery.data]);

  /** Every published package for the active AMC kW band (not only higher upgrade options). */
  const tierPlansForActiveAmc = useMemo((): PricingAmcPlanRow[] => {
    if (!activeForSelected) return [];
    const tier =
      activeCatalogPlan?.capacity_tier_code ??
      readSubscriptionCapacityTierCode(activeForSelected) ??
      (solarSizing.ready ? solarSizing.tierCode : null);
    if (!tier) return [];
    return listAmcPlansForTier(amcPlansQuery.data ?? [], tier);
  }, [activeForSelected, activeCatalogPlan, solarSizing, amcPlansQuery.data]);

  const upgradePlansForActive = useMemo((): PricingAmcPlanRow[] => {
    if (!activeForSelected) return [];
    return listAmcUpgradePlansForSubscription(amcPlansQuery.data ?? [], activeForSelected.plan_code);
  }, [activeForSelected, amcPlansQuery.data]);

  const canUpgradeActivePlan =
    Boolean(activeForSelected) && upgradePlansForActive.length > 0 && !amcTierOutOfSync;

  useEffect(() => {
    if (!amcPlansForCapacity.length) {
      setSelectedPlanCode(null);
      return;
    }
    if (selectedPlanCode && amcPlansForCapacity.some((p) => p.plan_code === selectedPlanCode)) return;
    setSelectedPlanCode(amcPlansForCapacity[0]!.plan_code);
  }, [amcPlansForCapacity, selectedPlanCode]);

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

  const createMut = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("Supabase is not configured.");
      if (!selectedAddressId) throw new Error("Choose a saved service address.");

      if (!selectedPlanCode) throw new Error("Choose an AMC plan.");
      return subscriptionApi.createAmcSubscriptionAsCustomer(supabase, {
        plan_code: selectedPlanCode,
        service_address_id: selectedAddressId,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all() });
      await qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
      Alert.alert(
        "AMC active",
        "Your plan includes visit allowances across the contract. Schedule each visit when you are ready. One-time visits you already booked stay separate.",
      );
    },
    onError: (e: Error) => Alert.alert("Couldn't subscribe", e.message),
  });

  const upgradeMut = useMutation({
    mutationFn: async (planCode: string) => {
      if (!supabase || !activeForSelected) throw new Error("No active AMC to upgrade.");
      return subscriptionApi.upgradeAmcSubscriptionAsCustomer(supabase, {
        subscription_id: activeForSelected.id,
        plan_code: planCode,
      });
    },
    onSuccess: async (updated) => {
      setUpgradeSheetOpen(false);
      await qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all() });
      if (activeForSelected?.id) {
        await qc.invalidateQueries({
          queryKey: queryKeys.subscriptions.visitSlots(activeForSelected.id),
        });
      }
      Alert.alert(
        "Plan upgraded",
        `${updated.plan_name} is now active. Extra visit slots are available - schedule them when you are ready.`,
      );
    },
    onError: (e: Error) => Alert.alert("Couldn't upgrade", e.message),
  });

  const renderVisitSlotRow = useCallback(
    (slot: SubscriptionVisitSlotRow) => {
      const linked = slot.booking_id ? scheduledAmcBookingsById.get(slot.booking_id) : null;
      const isBooked =
        isAmcVisitSlotBookedByCustomer(slot) &&
        Boolean(linked) &&
        linked!.status !== "cancelled" &&
        isCustomerScheduledAmcMetadata(linked!.metadata);
      const visitTitle = formatAmcVisitLabel(slot.sequence);
      const titleLine =
        isBooked && linked?.reference_code
          ? `${visitTitle} · ${linked.reference_code}`
          : visitTitle;
      const showJobStart =
        isBooked && linked != null && customerBookingVisitDateVisible(linked);
      const statusLabel =
        isBooked && linked ? bookingStatusLabel(linked.status, linked) : visitSlotStatusLabel(slot.status);

      const card = (
        <Card variant={isBooked ? "elevated" : "muted"} padded>
          <Text style={[styles.rowRef, !isBooked && styles.rowRefMuted]}>{titleLine}</Text>
          {showJobStart ? (
            <>
              <Text style={styles.rowDateLabel}>Job start</Text>
              <Text style={styles.rowWhen}>{formatDisplayDateTime(linked!.scheduled_start)}</Text>
            </>
          ) : null}
          <Text style={[styles.rowHint, !isBooked && styles.rowHintMuted]}>
            {statusLabel}
            {isBooked ? " · Tap for details" : " · Schedule when you are ready"}
          </Text>
          {!isBooked && slot.status === "pending" ? (
            <View style={{ marginTop: spacing.sm }}>
              <Button
                variant="primary"
                size="sm"
                onPress={() =>
                  router.push({
                    pathname: "/book",
                    params: { amcSlotId: slot.id },
                  })
                }
              >
                Schedule visit
              </Button>
            </View>
          ) : null}
        </Card>
      );

      if (isBooked && linked) {
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${titleLine}, ${statusLabel}`}
            key={slot.id}
            onPress={() => router.push({ pathname: "/booking-detail", params: { id: linked.id } })}
            style={({ pressed }) => [styles.rowPress, pressed && styles.rowPressed]}
          >
            {card}
          </Pressable>
        );
      }

      return (
        <View key={slot.id} style={[styles.rowPress, styles.rowDisabled]} accessibilityState={{ disabled: true }}>
          {card}
        </View>
      );
    },
    [scheduledAmcBookingsById],
  );

  const renderAddressRow = (entry: ServiceAddressEntry) => {
    const selected = entry.id === selectedAddressId;
    const active = activeByAddressId.get(entry.id);
    const renewalDue = renewalDueByAddressId.get(entry.id);
    const body = serviceAddressFormatted(entry.address);
    return (
      <Pressable
        key={entry.id}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => setSelectedAddressId(entry.id)}
        style={({ pressed }) => [
          styles.addressRow,
          selected && styles.addressRowSelected,
          pressed && styles.addressRowPressed,
        ]}
      >
        <View style={styles.addressTextCol}>
          <Text style={styles.addressLabel}>{entry.label}</Text>
          {body ? (
            <Text style={styles.addressBody} numberOfLines={2}>
              {body}
            </Text>
          ) : null}
          {active ? (
            <Text style={styles.addressAmcBadge}>AMC active · {active.plan_name}</Text>
          ) : renewalDue ? (
            <Text style={styles.addressRenewBadge}>
              AMC ended {formatDisplayDate(renewalDue.ends_at)} · renew below
            </Text>
          ) : (
            <Text style={styles.addressNoAmc}>No AMC on this address</Text>
          )}
        </View>
        <Text style={styles.addressChevron}>{selected ? "●" : "○"}</Text>
      </Pressable>
    );
  };

  if (!supabase) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        <Text style={styles.muted}>Configure Supabase to manage AMC subscriptions.</Text>
      </Screen>
    );
  }

  const refreshing =
    subsQuery.isRefetching || bookingsQuery.isRefetching || visitSlotsQuery.isRefetching;
  const onRefresh = () => {
    void subsQuery.refetch();
    void bookingsQuery.refetch();
    void customerQuery.refetch();
    void visitSlotsQuery.refetch();
  };

  const pending =
    subsQuery.isPending ||
    bookingsQuery.isPending ||
    customerQuery.isPending ||
    (activeForSelected != null && visitSlotsQuery.isPending);

  return (
    <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.lede}>
            Each saved address can have its own AMC. Schedule included visits when you are ready.
            One-time paid visits stay separate and are never merged into your AMC.
          </Text>
        </View>

        {pending ? (
          <View style={styles.pad}>
            <Card variant="muted" padded>
              <SkeletonStack rows={6} />
            </Card>
          </View>
        ) : subsQuery.isError || bookingsQuery.isError || customerQuery.isError ? (
          <View style={styles.pad}>
            <ErrorStateCard
              title="Couldn't load AMC data"
              message={
                subsQuery.isError
                  ? (subsQuery.error as Error).message
                  : customerQuery.isError
                    ? (customerQuery.error as Error).message
                    : (bookingsQuery.error as Error).message
              }
              onRetry={onRefresh}
              retryLabel="Retry"
            />
          </View>
        ) : !solarSizing.ready ? (
          <View style={styles.pad}>
            <Card variant="elevated" padded>
              <Text style={styles.cardLabel}>Solar site details required</Text>
              <Text style={styles.metaLine}>
                {solarSizing.reason === "missing_details"
                  ? "Add installed capacity (kW) and panel count under Solar & site in Profile, then tap Save changes. AMC uses the same details as one-time booking."
                  : `Your saved size is ${solarSizing.capacityKw} kW. We service 3, 4, 5, 6, 8, and 10 kW systems only - pick one of these in Profile and save.`}
              </Text>
              <View style={{ marginTop: spacing.md }}>
                <Button variant="primary" size="md" onPress={() => router.push("/(main)/profile")}>
                  {solarSizing.reason === "missing_details" ? "Complete Profile" : "Update system size in Profile"}
                </Button>
              </View>
            </Card>
          </View>
        ) : addressBook.entries.length === 0 ? (
          <View style={styles.pad}>
            <EmptyStateCard
              title="Add a service address first"
              description="AMC is tied to each saved site. Add an address in Profile, then return here to subscribe."
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
              <Card variant="muted" padded>
                <Text style={styles.cardLabel}>Your system (from Profile)</Text>
                <Text style={styles.metaLine}>
                  {solarSizing.snappedKw} kW · {solarSizing.panelCount} panels - AMC plans below match this size.
                </Text>
              </Card>
            </View>
            <View style={styles.pad}>
              <Text style={styles.sectionLabel}>Your addresses</Text>
              <Text style={styles.inputHelp}>
                Select the site you want to manage. You can subscribe separately for each address.
              </Text>
              <View style={{ gap: spacing.sm }}>{addressBook.entries.map(renderAddressRow)}</View>
              <View style={{ marginTop: spacing.sm }}>
                <Button variant="outline" size="sm" onPress={() => setAddressPickerOpen(true)}>
                  Manage saved addresses
                </Button>
              </View>
            </View>

            {selectedEntry ? (
              <View style={styles.pad}>
                <Text style={styles.sectionLabel}>Your site</Text>
                <Card variant="elevated" padded>
                  <Text style={styles.planName}>{selectedEntry.label}</Text>
                  <Text style={styles.metaLine}>{serviceAddressFormatted(selectedEntry.address)}</Text>
                </Card>
              </View>
            ) : null}

            {activeForSelected ? (
              <View style={styles.pad}>
                {amcTierOutOfSync ? (
                  <View style={{ marginBottom: spacing.sm }}>
                    <Card variant="muted" padded>
                      <Text style={styles.cardLabel}>System size changed in Profile</Text>
                      <Text style={styles.metaLine}>
                        Your AMC is still priced for a different kW band. Open Profile, update your saved capacity, and
                        save - your plan amount and visit allowances will be re-evaluated. Scheduled visits are kept as
                        they are.
                      </Text>
                      <View style={{ marginTop: spacing.sm }}>
                        <Button variant="outline" size="sm" onPress={() => router.push("/(main)/profile")}>
                          Update in Profile
                        </Button>
                      </View>
                    </Card>
                  </View>
                ) : null}
                <Card variant="elevated" padded>
                  <Text style={styles.cardLabel}>Active plan for this address</Text>
                  <Text style={styles.planName}>{activeForSelected.plan_name}</Text>
                  <Text style={styles.metaLine}>
                    Renews through {formatDisplayDate(activeForSelected.ends_at)} ·{" "}
                    {activeForSelected.visits_included != null
                      ? `${amcVisitSlots.filter((s) => isAmcVisitSlotBookedByCustomer(s)).length} / ${activeForSelected.visits_included} visits scheduled`
                      : "Visit tracking"}
                  </Text>
                  {tierPlansForActiveAmc.length > 0 ? (
                    <View style={{ marginTop: spacing.md }}>
                      <Button variant="outline" size="sm" onPress={() => setUpgradeSheetOpen(true)}>
                        {canUpgradeActivePlan
                          ? `Compare plans (${tierPlansForActiveAmc.length} based on your system selection)`
                          : `View all plans (${tierPlansForActiveAmc.length} based on your system selection)`}
                      </Button>
                    </View>
                  ) : null}
                </Card>
              </View>
            ) : selectedAddressId ? (
              <View style={styles.pad}>
                {renewalDueForSelected ? (
                  <View style={{ marginBottom: spacing.md }}>
                    <View style={styles.renewalBanner}>
                      <Card variant="elevated" padded>
                        <Text style={styles.renewalKicker}>Renew your AMC</Text>
                        <Text style={styles.planName}>{renewalDueForSelected.plan_name}</Text>
                        <Text style={styles.metaLine}>
                          Your plan for {selectedEntry?.label ?? "this address"} ended on{" "}
                          {formatDisplayDate(renewalDueForSelected.ends_at)}. Choose one of the AMC plans below to renew
                          coverage and schedule visits for the new contract year.
                        </Text>
                      </Card>
                    </View>
                  </View>
                ) : null}
                <Text style={styles.sectionLabel}>
                  {renewalDueForSelected ? "Renew for this address" : "Subscribe for this address"}
                </Text>
                <Text style={styles.inputHelp}>
                  {renewalDueForSelected
                    ? `Pick a plan for ${selectedEntry?.label ?? "this site"}, then subscribe to start your new contract.`
                    : `After you subscribe, schedule each included visit when you are ready. This does not replace one-time bookings you already paid for at ${selectedEntry?.label ?? "this site"}.`}
                </Text>

                {amcPlansQuery.isPending ? (
                  <Card variant="muted" padded>
                    <Text style={styles.metaLine}>Loading AMC plans…</Text>
                  </Card>
                ) : amcPlansForCapacity.length === 0 ? (
                  <EmptyStateCard
                    title="No AMC plans for your size"
                    description={`No active plans are published for ${solarSizing.ready ? `${solarSizing.snappedKw} kW` : "your system size"} yet. Ask support or check back later.`}
                  />
                ) : (
                  <>
                    <Text style={styles.planCountHint}>
                      {amcPlansForCapacity.length} plan{amcPlansForCapacity.length === 1 ? "" : "s"} for{" "}
                      {solarSizing.snappedKw} kW
                    </Text>
                    {amcPlansForCapacity.map((p) => {
                      const selected = p.plan_code === selectedPlanCode;
                      return (
                        <Pressable
                          key={p.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => setSelectedPlanCode(p.plan_code)}
                          style={({ pressed }) => [
                            styles.planRow,
                            selected && styles.planRowSelected,
                            pressed && styles.planRowPressed,
                          ]}
                        >
                          <View style={styles.planTextCol}>
                            <Text style={styles.planTitle}>{p.plan_name}</Text>
                            <Text style={styles.planBody}>
                              {formatAmcPlanSubtitle(p)} ·{" "}
                              {geoAddonsQuery.isPending ? "…" : formatInrFromCents(p.amount_cents + amcTierAddonPaise)} + taxes
                            </Text>
                            {amcTierAddonPaise > 0 && !geoAddonsQuery.isPending ? (
                              <Text style={styles.planAddonHint}>
                                Includes {formatInrFromCents(amcTierAddonPaise)} city-tier add-on
                                {geoAddonsQuery.data?.matched_tier_label
                                  ? ` (${geoAddonsQuery.data.matched_tier_label})`
                                  : ""}
                                .
                              </Text>
                            ) : null}
                          </View>
                          <Text style={styles.planChevron}>{selected ? "●" : "○"}</Text>
                        </Pressable>
                      );
                    })}
                    <View style={{ marginTop: spacing.md }}>
                      <Button
                        loading={createMut.isPending}
                        size="lg"
                        variant="primary"
                        disabled={!selectedPlanCode}
                        onPress={() => createMut.mutate()}
                      >
                        {renewalDueForSelected ? "Renew AMC for this address" : "Subscribe for this address"}
                      </Button>
                    </View>
                    <Text style={styles.legalHint}>
                      Signing up creates visit allowances for your contract. Schedule each visit when you want - separate
                      one-time cleanings stay on their original price.
                    </Text>
                  </>
                )}
              </View>
            ) : null}

            {activeForSelected ? (
              <View style={styles.pad}>
                <Text style={styles.sectionLabel}>AMC visit allowances</Text>
                <Text style={styles.inputHelp}>
                  {selectedEntry
                    ? `Included visits for ${selectedEntry.label}. Schedule any visit when you are ready - your job start time appears once your partner accepts and assigns a technician.`
                    : "Select an address to see visit allowances."}
                </Text>
                <View style={{ gap: spacing.sm }}>{amcVisitSlots.map((s) => renderVisitSlotRow(s))}</View>
                {visitSlotsQuery.isError ? (
                  <Text style={styles.metaLine}>{(visitSlotsQuery.error as Error).message}</Text>
                ) : null}
                {amcVisitSlots.length === 0 && !visitSlotsQuery.isPending ? (
                  <EmptyStateCard
                    title="No visit slots yet"
                    description="Pull to refresh. If you just subscribed, visit allowances should appear shortly."
                  />
                ) : null}
              </View>
            ) : null}

            {activeForSelected ? (
              <View style={styles.pad}>
                <Text style={styles.sectionLabel}>Separate one-time visits</Text>
                <Text style={styles.inputHelp}>
                  If you already booked paid cleanings here, they stay on those bookings - we do not move them onto your
                  AMC or change what you owe for them.
                </Text>
                <View style={{ gap: spacing.sm }}>
                  {upcomingOneTimeSeparate.map((b) => (
                    <Pressable
                      key={`ot-${b.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`One-time booking ${b.reference_code}`}
                      onPress={() => router.push({ pathname: "/booking-detail", params: { id: b.id } })}
                      style={({ pressed }) => [styles.rowPress, pressed && styles.rowPressed]}
                    >
                      <Card variant="muted" padded>
                        <Text style={styles.rowRef}>{b.reference_code}</Text>
                        <Text style={styles.rowWhen}>{formatDisplayDateTime(b.scheduled_start)}</Text>
                        <Text style={styles.rowHint}>One-time visit · Paid booking · Tap for details</Text>
                      </Card>
                    </Pressable>
                  ))}
                </View>
                {upcomingOneTimeSeparate.length === 0 ? (
                  <EmptyStateCard
                    title="No upcoming one-time visits"
                    description="Future paid cleanings you book from Book appear here alongside your AMC schedule."
                  />
                ) : null}
              </View>
            ) : null}

            {subscriptions.some((s) => {
              const addrId = readSubscriptionServiceAddressId(s);
              return addrId && !addressBook.entries.some((e) => e.id === addrId);
            }) ? (
              <View style={styles.pad}>
                <Card variant="muted" padded>
                  <Text style={styles.cardLabel}>Other AMC records</Text>
                  <Text style={styles.metaLine}>
                    You have older plans linked to addresses no longer in your book. Contact support if you need help
                    moving them.
                  </Text>
                </Card>
              </View>
            ) : null}
          </FadeInView>
        )}
      </ScrollView>

      <AmcUpgradeSheet
        visible={upgradeSheetOpen}
        subscription={activeForSelected}
        tierPlans={tierPlansForActiveAmc}
        currentPlanCode={activeForSelected?.plan_code ?? null}
        upgradePlanCodes={upgradePlansForActive.map((p) => p.plan_code)}
        geoAddonCents={amcTierAddonPaise}
        geoTierLabel={geoAddonsQuery.data?.matched_tier_label ?? null}
        loading={upgradeMut.isPending}
        onClose={() => setUpgradeSheetOpen(false)}
        onConfirm={async (planCode) => {
          await upgradeMut.mutateAsync(planCode);
        }}
      />

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
  fadeStretch: {
    alignSelf: "stretch",
    width: "100%",
  },
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
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  pad: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  sectionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cardLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  planName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  metaLine: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  addressRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  addressRowPressed: {
    opacity: 0.94,
  },
  addressTextCol: {
    flex: 1,
    gap: spacing.xs,
  },
  addressLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  addressBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  addressAmcBadge: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  addressRenewBadge: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.destructive,
    marginTop: spacing.xs,
  },
  renewalBanner: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  renewalKicker: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  addressNoAmc: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  addressChevron: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.primary,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
    minHeight: 88,
  },
  planRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  planRowPressed: {
    opacity: 0.94,
  },
  planTextCol: {
    flex: 1,
    gap: spacing.xs,
  },
  planTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.foreground,
  },
  planBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  planAddonHint: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.primary,
    marginTop: 2,
  },
  planChevron: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.primary,
  },
  inputHelp: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  planCountHint: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  legalHint: {
    marginTop: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  rowPress: {
    borderRadius: 16,
  },
  rowPressed: {
    opacity: 0.93,
  },
  rowDisabled: {
    opacity: 0.88,
  },
  rowRef: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  rowRefMuted: {
    color: colors.mutedForeground,
  },
  rowDateLabel: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  rowWhen: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  rowHint: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  rowHintMuted: {
    color: colors.mutedForeground,
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
});
