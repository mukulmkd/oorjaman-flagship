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
import { router, useLocalSearchParams } from "expo-router";
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
  formatAmcIncludedVisitTitle,
  formatAmcSuggestedVisitWindow,
  partitionAmcVisitSlotsForDisplay,
  resolveAmcVisitScheduleNudge,
  summarizeAmcVisitAllowances,
  amcContractIsReadyForVisits,
  getAmcContractBySubscriptionId,
  isAmcVisitSlotBookedByCustomer,
  isCustomerScheduledAmcMetadata,
  paymentApi,
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
  const routeParams = useLocalSearchParams<{ addressId?: string | string[]; focus?: string | string[] }>();
  const addressIdParam = Array.isArray(routeParams.addressId)
    ? routeParams.addressId[0]
    : routeParams.addressId;
  const focusParam = Array.isArray(routeParams.focus) ? routeParams.focus[0] : routeParams.focus;
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [upgradeSheetOpen, setUpgradeSheetOpen] = useState(false);
  const [pastVisitsExpanded, setPastVisitsExpanded] = useState(false);

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
    if (addressIdParam && addressBook.entries.some((e) => e.id === addressIdParam)) {
      setSelectedAddressId(addressIdParam);
      return;
    }
    if (selectedAddressId && addressBook.entries.some((e) => e.id === selectedAddressId)) return;
    setSelectedAddressId(addressBook.defaultId ?? addressBook.entries[0]?.id ?? null);
  }, [addressBook.defaultId, addressBook.entries, addressIdParam, selectedAddressId]);

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

  const amcContractQuery = useQuery({
    queryKey: queryKeys.finance.amcWalletBySubscription(activeForSelected?.id ?? "__none__"),
    queryFn: () => getAmcContractBySubscriptionId(supabase!, activeForSelected!.id),
    enabled: Boolean(supabase && activeForSelected?.id),
  });

  const amcVisitSlots = visitSlotsQuery.data ?? [];
  const amcContract = amcContractQuery.data ?? null;

  const canScheduleAmcVisits = Boolean(
    activeForSelected?.status === "active" &&
      activeForSelected.assigned_vendor_id &&
      amcContractIsReadyForVisits(amcContract),
  );

  const includedVisitsTotal =
    activeForSelected?.visits_included ?? amcVisitSlots.length;

  const visitAllowanceSummary = useMemo(
    () =>
      summarizeAmcVisitAllowances(amcVisitSlots, {
        canSchedule: canScheduleAmcVisits,
      }),
    [amcVisitSlots, canScheduleAmcVisits],
  );

  const { active: activeVisitSlots, past: pastVisitSlots } = useMemo(
    () => partitionAmcVisitSlotsForDisplay(amcVisitSlots),
    [amcVisitSlots],
  );

  const visitScheduleNudge = useMemo(
    () =>
      resolveAmcVisitScheduleNudge(amcVisitSlots, {
        canSchedule: canScheduleAmcVisits,
        totalVisits: includedVisitsTotal,
      }),
    [amcVisitSlots, canScheduleAmcVisits, includedVisitsTotal],
  );

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
    return listAmcUpgradePlansForSubscription(
      amcPlansQuery.data ?? [],
      activeForSelected.plan_code,
      activeForSelected,
    );
  }, [activeForSelected, amcPlansQuery.data]);

  const canUpgradeActivePlan =
    Boolean(activeForSelected) && upgradePlansForActive.length > 0 && !amcTierOutOfSync;

  useEffect(() => {
    if (focusParam !== "upgrade" || subsQuery.isPending || amcPlansQuery.isPending) return;
    if (!activeForSelected) return;
    if (upgradePlansForActive.length === 0) {
      Alert.alert(
        "AMC renewal",
        "You're already on the highest AMC plan for your system size, or your current package can't be upgraded here. Contact support for additional visits, or wait until your contract renewal date.",
      );
      return;
    }
    setUpgradeSheetOpen(true);
  }, [
    focusParam,
    activeForSelected?.id,
    subsQuery.isPending,
    amcPlansQuery.isPending,
    upgradePlansForActive.length,
  ]);

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
      await qc.invalidateQueries({ queryKey: queryKeys.finance.all() });
      Alert.alert(
        "AMC created",
        "Complete payment for your AMC. After payment, OorjaMan will assign your dedicated partner - then you can schedule visits.",
      );
    },
    onError: (e: Error) => Alert.alert("Couldn't subscribe", e.message),
  });

  const payAmcMut = useMutation({
    mutationFn: async () => {
      if (!supabase || !customerQuery.data || !activeForSelected) {
        throw new Error("Subscribe first, then pay for your AMC.");
      }
      const amountPaise = Math.max(0, Math.round(activeForSelected.amount_cents));
      const pending = await paymentApi.createPendingAmcPayment(supabase, {
        customerId: customerQuery.data.id,
        subscriptionId: activeForSelected.id,
        amountPaise,
      });
      return paymentApi.completeAmcSubscriptionPayment(supabase, pending.id, { paymentMethod: "UPI" });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all() });
      await qc.invalidateQueries({ queryKey: queryKeys.finance.all() });
      Alert.alert(
        "Payment received",
        "Payment received. We will assign your dedicated partner shortly - you can schedule visits once they are assigned.",
      );
    },
    onError: (e: Error) => Alert.alert("Payment failed", e.message),
  });

  const upgradeMut = useMutation({
    mutationFn: async (planCode: string) => {
      if (!supabase || !selectedAddressId) throw new Error("No active AMC to upgrade.");

      await Promise.all([
        qc.refetchQueries({ queryKey: queryKeys.subscriptions.list() }),
        qc.refetchQueries({ queryKey: queryKeys.pricing.capacityCatalog("IN") }),
      ]);

      const freshSubs =
        qc.getQueryData<SubscriptionRow[]>(queryKeys.subscriptions.list()) ?? [];
      const freshCatalog =
        qc.getQueryData<PricingAmcPlanRow[]>(queryKeys.pricing.capacityCatalog("IN")) ?? [];
      const freshActive = getActiveSubscriptionForAddress(freshSubs, selectedAddressId);
      if (!freshActive) throw new Error("No active AMC to upgrade.");

      const allowedUpgrades = listAmcUpgradePlansForSubscription(
        freshCatalog,
        freshActive.plan_code,
        freshActive,
      );
      if (!allowedUpgrades.some((p) => p.plan_code === planCode)) {
        if (freshActive.plan_code === planCode) {
          throw new Error("You're already on this AMC plan. Pull to refresh your plan details.");
        }
        if (allowedUpgrades.length === 0) {
          throw new Error(
            "You're already on the highest AMC plan for your system size. Contact support for additional visits, or wait until your contract renewal date.",
          );
        }
        throw new Error(
          "That plan is no longer available as an upgrade. Pull to refresh and try again.",
        );
      }

      return subscriptionApi.upgradeAmcSubscriptionAsCustomer(supabase, {
        subscription_id: freshActive.id,
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
    (slot: SubscriptionVisitSlotRow, options?: { variant?: "active" | "past" }) => {
      const linked = slot.booking_id ? scheduledAmcBookingsById.get(slot.booking_id) : null;
      const isBooked =
        isAmcVisitSlotBookedByCustomer(slot) &&
        Boolean(linked) &&
        linked!.status !== "cancelled" &&
        isCustomerScheduledAmcMetadata(linked!.metadata);
      const isCompleted = slot.status === "completed";
      const visitTitle = formatAmcIncludedVisitTitle(slot.sequence, includedVisitsTotal);
      const titleLine =
        isBooked && linked?.reference_code
          ? `${visitTitle} · ${linked.reference_code}`
          : visitTitle;
      const suggestedWindow = formatAmcSuggestedVisitWindow(slot.ideal_scheduled_start, {
        sequence: slot.sequence,
        totalVisits: includedVisitsTotal,
      });
      const showJobStart =
        isBooked && linked != null && customerBookingVisitDateVisible(linked);
      const statusLabel =
        isBooked && linked ? bookingStatusLabel(linked.status, linked) : visitSlotStatusLabel(slot.status);
      const completedWhen =
        isCompleted && linked?.scheduled_start
          ? formatDisplayDate(linked.scheduled_start)
          : isCompleted
            ? formatDisplayDate(slot.ideal_scheduled_start)
            : null;

      let hintLine: string;
      if (isCompleted) {
        hintLine = completedWhen ? `Completed ${completedWhen}` : "Completed";
      } else if (isBooked) {
        hintLine = `${statusLabel} · Tap for details`;
      } else if (slot.status === "pending" && !canScheduleAmcVisits) {
        hintLine = `${suggestedWindow} · Waiting for your AMC partner`;
      } else if (slot.status === "pending") {
        hintLine = `${suggestedWindow} · Not scheduled yet`;
      } else {
        hintLine = `${statusLabel} · Schedule when you are ready`;
      }

      const cardVariant =
        options?.variant === "past" ? "muted" : isBooked || isCompleted ? "elevated" : "muted";

      const card = (
        <Card variant={cardVariant} padded>
          <Text
            style={[
              styles.rowRef,
              !isBooked && !isCompleted && options?.variant !== "past" && styles.rowRefMuted,
            ]}
          >
            {titleLine}
          </Text>
          {showJobStart ? (
            <>
              <Text style={styles.rowDateLabel}>Job start</Text>
              <Text style={styles.rowWhen}>{formatDisplayDateTime(linked!.scheduled_start)}</Text>
            </>
          ) : null}
          <Text
            style={[
              styles.rowHint,
              !isBooked && !isCompleted && styles.rowHintMuted,
              options?.variant === "past" && styles.rowHintMuted,
            ]}
          >
            {hintLine}
          </Text>
          {!isBooked && !isCompleted && slot.status === "pending" && canScheduleAmcVisits ? (
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

      if ((isBooked || isCompleted) && linked) {
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${titleLine}, ${hintLine}`}
            key={slot.id}
            onPress={() => router.push({ pathname: "/booking-detail", params: { id: linked.id } })}
            style={({ pressed }) => [styles.rowPress, pressed && styles.rowPressed]}
          >
            {card}
          </Pressable>
        );
      }

      return (
        <View key={slot.id} style={styles.rowPress} accessibilityState={{ disabled: !canScheduleAmcVisits }}>
          {card}
        </View>
      );
    },
    [scheduledAmcBookingsById, canScheduleAmcVisits, includedVisitsTotal],
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
            <Text style={styles.addressAmcBadge}>
              {active.status === "trialing" ? "AMC pending payment" : "AMC active"} · {active.plan_name}
            </Text>
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
                  {solarSizing.snappedKw} kW · {solarSizing.panelCount} panels
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
                  <Text style={styles.cardLabel}>
                    {activeForSelected.status === "trialing" ? "AMC awaiting payment" : "Active plan for this address"}
                  </Text>
                  <Text style={styles.planName}>{activeForSelected.plan_name}</Text>
                  <Text style={styles.metaLine}>
                    Renews through {formatDisplayDate(activeForSelected.ends_at)} ·{" "}
                    {activeForSelected.visits_included != null
                      ? `${visitAllowanceSummary.scheduledOrBooked} / ${activeForSelected.visits_included} visits scheduled`
                      : "Visit tracking"}
                  </Text>
                  {activeForSelected.status === "trialing" ? (
                    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                      <Text style={styles.metaLine}>
                        Pay {formatInrFromCents(activeForSelected.amount_cents)} to activate your AMC for this address.
                        Your dedicated partner is assigned after payment.
                      </Text>
                      <Button
                        loading={payAmcMut.isPending}
                        variant="primary"
                        size="sm"
                        onPress={() => payAmcMut.mutate()}
                      >
                        Pay for AMC
                      </Button>
                    </View>
                  ) : activeForSelected.status === "active" && !activeForSelected.assigned_vendor_id ? (
                    <Text style={[styles.metaLine, { marginTop: spacing.sm }]}>
                      Payment received. OorjaMan is assigning your dedicated AMC partner - scheduling opens once assigned.
                      For urgent cleaning before then, contact support and choose “Need urgent cleaning?” - billed separately at one-time rates.
                    </Text>
                  ) : activeForSelected.assigned_vendor_id && amcContractIsReadyForVisits(amcContract) ? (
                    <Text style={[styles.metaLine, { marginTop: spacing.sm }]}>
                      Dedicated partner assigned · schedule your included visits below.
                    </Text>
                  ) : null}
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
                      Signing up creates included visits for your contract. Schedule each when you want - separate
                      one-time cleanings stay on their original price.
                    </Text>
                  </>
                )}
              </View>
            ) : null}

            {activeForSelected ? (
              <View style={styles.pad}>
                <Text style={styles.sectionLabel}>Included visits</Text>
                <Text style={styles.inputHelp}>
                  {selectedEntry
                    ? `Prepaid cleanings for ${selectedEntry.label}. Pick a date for each when you are ready - they are not tied to one-time bookings below. Job start appears once your partner assigns a technician.`
                    : "Select an address to see included visits."}
                </Text>
                {amcVisitSlots.length > 0 ? (
                  <>
                    {!visitAllowanceSummary.allUsed ? (
                      <View style={styles.visitProgressRow}>
                        <View style={styles.visitProgressDots} accessibilityLabel={visitAllowanceSummary.headline}>
                          {Array.from({ length: visitAllowanceSummary.total }, (_, i) => (
                            <View
                              key={`dot-${i}`}
                              style={[
                                styles.visitProgressDot,
                                i < visitAllowanceSummary.progressFilled
                                  ? styles.visitProgressDotFilled
                                  : styles.visitProgressDotEmpty,
                              ]}
                            />
                          ))}
                        </View>
                        <Text style={styles.visitProgressHeadline}>{visitAllowanceSummary.headline}</Text>
                      </View>
                    ) : null}

                    {visitAllowanceSummary.allUsed ? (
                      <View style={styles.allUsedCard}>
                        <Card variant="elevated" padded>
                          <Text style={styles.allUsedTitle}>
                            All {visitAllowanceSummary.total} included visits used
                          </Text>
                          <Text style={styles.allUsedBody}>
                            Book a paid one-time cleaning anytime
                            {renewalDueForSelected
                              ? ", or renew your AMC below."
                              : activeForSelected.ends_at
                                ? `, or renew when your contract ends on ${formatDisplayDate(activeForSelected.ends_at)}.`
                                : "."}
                          </Text>
                          <View style={styles.allUsedActions}>
                            <Button
                              variant="primary"
                              size="sm"
                              onPress={() => router.push({ pathname: "/book" })}
                            >
                              Book one-time visit
                            </Button>
                          </View>
                        </Card>
                      </View>
                    ) : null}

                    {visitScheduleNudge ? (
                      <View style={styles.nudgeCard}>
                        <Card variant="elevated" padded>
                          <Text style={styles.nudgeTitle}>{visitScheduleNudge.message}</Text>
                          <Text style={styles.nudgeBody}>
                            {formatAmcSuggestedVisitWindow(visitScheduleNudge.slot.ideal_scheduled_start, {
                              sequence: visitScheduleNudge.slot.sequence,
                              totalVisits: includedVisitsTotal,
                            })}
                          </Text>
                          <View style={{ marginTop: spacing.sm }}>
                            <Button
                              variant="primary"
                              size="sm"
                              onPress={() =>
                                router.push({
                                  pathname: "/book",
                                  params: { amcSlotId: visitScheduleNudge.slot.id },
                                })
                              }
                            >
                              Schedule visit
                            </Button>
                          </View>
                        </Card>
                      </View>
                    ) : null}

                    {activeVisitSlots.length > 0 ? (
                      <View style={{ gap: spacing.sm }}>
                        {activeVisitSlots.map((s) => renderVisitSlotRow(s, { variant: "active" }))}
                      </View>
                    ) : null}

                    {pastVisitSlots.length > 0 ? (
                      <View style={{ marginTop: spacing.md }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded: pastVisitsExpanded }}
                          accessibilityLabel={`Past included visits, ${pastVisitSlots.length} visits`}
                          onPress={() => setPastVisitsExpanded((v) => !v)}
                          style={({ pressed }) => [
                            styles.pastVisitsHeader,
                            pressed && styles.rowPressed,
                          ]}
                        >
                          <Text style={styles.pastVisitsHeaderText}>
                            Past included visits ({pastVisitSlots.length})
                          </Text>
                          <Text style={styles.pastVisitsChevron}>{pastVisitsExpanded ? "▾" : "▸"}</Text>
                        </Pressable>
                        {pastVisitsExpanded ? (
                          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                            {pastVisitSlots.map((s) => renderVisitSlotRow(s, { variant: "past" }))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                ) : null}
                {visitSlotsQuery.isError ? (
                  <Text style={styles.metaLine}>{(visitSlotsQuery.error as Error).message}</Text>
                ) : null}
                {amcVisitSlots.length === 0 && !visitSlotsQuery.isPending ? (
                  <EmptyStateCard
                    title="No visit slots yet"
                    description="Pull to refresh. If you just subscribed, included visits should appear shortly."
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
  visitProgressRow: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  visitProgressDots: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  visitProgressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  visitProgressDotFilled: {
    backgroundColor: colors.primary,
  },
  visitProgressDotEmpty: {
    backgroundColor: colors.border,
  },
  visitProgressHeadline: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.foreground,
  },
  nudgeCard: {
    marginBottom: spacing.md,
    borderColor: colors.primary,
    borderWidth: StyleSheet.hairlineWidth,
  },
  nudgeTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  nudgeBody: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  allUsedCard: {
    marginBottom: spacing.md,
  },
  allUsedTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  allUsedBody: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  allUsedActions: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
  },
  pastVisitsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  pastVisitsHeaderText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  pastVisitsChevron: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
});
