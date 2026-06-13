import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  bookingApi,
  buildBookingRecipientMeta,
  buildCustomerBookingCreateInput,
  customerApi,
  paymentApi,
  customerLocationSignalsFromCustomer,
  formatCustomerAddressMultiline,
  formatInrFromCents,
  getCustomerSolarSizing,
  getBookingRoutingDefaults,
  normalizeCountryCode,
  quoteOneTimeServicePrice,
  queryKeys,
  rankVendorsByNearest,
  readBookingCustomerCompensationMeta,
  getCustomerOorjamanCreditsSummary,
  planOorjamanCreditsRedemption,
  redeemCustomerOorjamanCredits,
  resolveBookingVendor,
  splitVendorsByServiceArea,
  AMC_URGENT_CLEANING_SUBCATEGORY_SLUG,
  bookVisitRequiresAmcChoiceGate,
  isAmcAwaitingPartnerAssignment,
  countAmcVisitsConsumedAtAddress,
  subscriptionAddressIdForGate,
  getAmcContractBySubscriptionId,
  getActiveSubscriptionForAddress,
  customerBookingDisplayTitle,
  resolveAmcVisitBookingGate,
  subscriptionApi,
  vendorApi,
  vendorCoversCustomerSignals,
} from "@oorjaman/api";
import type { Json, VendorRow, VendorRoutingResolution, VisitPriceBreakdown } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import {
  BOOKING_TIMEZONE,
  buildMonthCalendarGridIST,
  getISTWallParts,
  istDayKeyFromDate,
  isEveningBookingCutoff,
  isSlotValidAt,
  listSelectableDayKeys,
  minSelectableDayKey,
  slotsForDay,
  type BookingSlotOption,
} from "@oorjaman/utils";
import {
  Button,
  Card,
  EmptyStateCard,
  ErrorStateCard,
  FadeInView,
  Input,
  modalScrollContentStyle,
  notifyCustomerBookingCreated,
  SkeletonBar,
  useModalStackHeader,
} from "@oorjaman/ui";
import { fontFamily, fontSize, fontWeight } from "../constants/fonts";
import {
  BookVisitAmcAwaitingPartnerGate,
  BookVisitAmcChoiceGate,
} from "../components/book-visit-amc-choice-gate";
import { PriceGstBreakdown } from "../components/price-gst-breakdown";
import { openSupportChat } from "../lib/support-chat-navigation";
import { ServiceAddressPickerSheet } from "../components/service-address-picker-sheet";
import {
  buildAddressBookPatch,
  mergeServiceGpsIntoCustomerPatch,
  readFallbackVendorIdFromCustomer,
  readPreferredVendorIdsForDefaultServiceLocation,
  readServiceAddressBook,
  serviceAddressFormatted,
  type ServiceAddressEntry,
  type ServiceAddressSaveExtras,
} from "../lib/service-address-book";
import { buildPostCheckoutPartnerAlert } from "../lib/booking-partner-messaging";
import {
  activeAmcBlocksOneTimeBooking,
  amcVisitBookingGateMessage,
  navigateToAmcPlan,
  navigateToAmcRenewal,
} from "../lib/book-visit-navigation";
import { supabase } from "../lib/supabase";

type BookingVendorPick = { mode: "preferred"; vendorId: string } | { mode: "any" };

function pickDefaultVendorFromPrefs(vendors: VendorRow[], preferredVendorIds: string[]): BookingVendorPick {
  for (const id of preferredVendorIds) {
    if (vendors.some((v) => v.id === id)) return { mode: "preferred", vendorId: id };
  }
  return { mode: "any" };
}

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

type Step = 0 | 1 | 2 | 3;

const BOOKING_SCHEDULE_HORIZON_DAYS = 90;

const BOOK_VENDOR_SKEL_KEYS = ["bv1", "bv2", "bv3", "bv4", "bv5"];

/** Simulated gateway: pick a plausible Indian payment channel for dummy checkout. */
function randomDummyIndianPaymentMethod(): string {
  const methods = [
    "UPI",
    "Net banking",
    "Credit or debit card",
    "Debit card",
    "Credit card",
    "Wallet",
  ] as const;
  return methods[Math.floor(Math.random() * methods.length)] ?? "UPI";
}

function ymKey(y: number, m: number): number {
  return y * 12 + m;
}

function formatSlotChipStart(startIso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: BOOKING_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(startIso));
}

function formatMonthNavTitle(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: BOOKING_TIMEZONE,
  }).format(new Date(`${year}-${String(month).padStart(2, "0")}-12T12:00:00+05:30`));
}

function safeNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function readObj(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function vendorPoint(v: VendorRow): { lat: number; lng: number } | null {
  const reg = readObj(v.registered_address);
  const meta = readObj(v.metadata);
  const metaLoc = meta ? readObj(meta.location) : null;
  const candidates: Array<{ lat: unknown; lng: unknown }> = [
    { lat: reg?.lat, lng: reg?.lng },
    { lat: reg?.latitude, lng: reg?.longitude },
    { lat: meta?.lat, lng: meta?.lng },
    { lat: meta?.latitude, lng: meta?.longitude },
    { lat: metaLoc?.lat, lng: metaLoc?.lng },
    { lat: metaLoc?.latitude, lng: metaLoc?.longitude },
  ];
  for (const c of candidates) {
    const lat = safeNum(c.lat);
    const lng = safeNum(c.lng);
    if (lat == null || lng == null) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    return { lat, lng };
  }
  return null;
}

function kmDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa = Math.sin(dLat / 2) ** 2;
  const sb = Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(sa + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sb), Math.sqrt(1 - sa));
  return r * c;
}

function BookVendorSkeletonRow() {
  return (
    <View style={styles.skelGap}>
      <Card variant="muted" padded>
        <SkeletonBar variant="dense" />
        <View style={styles.gapSm} />
        <SkeletonBar variant="short" />
      </Card>
    </View>
  );
}

function formatKwDisplay(kw: number): string {
  if (!Number.isFinite(kw)) return "0";
  const rounded = Math.round(kw * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
}

function PricingMoneyRow({ label, amountPaise }: { label: string; amountPaise: number }) {
  return (
    <View style={pricingStyles.moneyRow}>
      <Text style={pricingStyles.moneyLabel}>{label}</Text>
      <Text style={pricingStyles.moneyValue}>{formatInrFromCents(amountPaise)}</Text>
    </View>
  );
}

type VisitPricingCardProps = {
  breakdown: VisitPriceBreakdown;
  profileCity: string | null;
};

function CapacityVisitPricingCard({
  tierLabel,
  capacityKw,
  typicalPanels,
  cataloguePaise,
  geoAddonPaise,
  amountPaise,
  perPanelPaise,
}: {
  tierLabel: string;
  capacityKw: number;
  typicalPanels: number;
  cataloguePaise: number;
  geoAddonPaise: number;
  amountPaise: number;
  perPanelPaise: number;
}) {
  return (
    <View style={pricingStyles.block}>
      <Text style={pricingStyles.pricingTitle}>Visit price</Text>
      <Text style={pricingStyles.pricingCaption}>
        Fixed rate for your {capacityKw} kW system ({tierLabel}). Reference: {formatInrFromCents(perPanelPaise)} per panel.
      </Text>
      <Card variant="elevated" padded>
        <PricingMoneyRow label={`${capacityKw} kW package (~${typicalPanels} panels)`} amountPaise={cataloguePaise} />
        {geoAddonPaise > 0 ? (
          <PricingMoneyRow label="City-tier add-on" amountPaise={geoAddonPaise} />
        ) : null}
        <View style={pricingStyles.divider} />
        <View style={pricingStyles.totalRow}>
          <Text style={pricingStyles.totalLabel}>Estimated total</Text>
          <Text style={pricingStyles.totalValue}>{formatInrFromCents(amountPaise)}</Text>
        </View>
        <View style={pricingStyles.divider} />
        <PriceGstBreakdown totalPaise={amountPaise} />
      </Card>
    </View>
  );
}

function VisitPricingCard({ breakdown, profileCity }: VisitPricingCardProps) {
  const m = breakdown.multiplier;
  const mLabel = Number.isInteger(m) ? String(m) : m.toFixed(4).replace(/\.?0+$/, "");
  const cityLine = profileCity?.trim() || null;

  const areaHint = breakdown.matched_tier_label
    ? `${breakdown.matched_tier_label} - applies to visits in your area`
    : breakdown.matched_city
      ? `Rates for ${breakdown.matched_city.trim()}`
      : "Standard visit rates for your area";

  return (
    <View style={pricingStyles.block}>
      <Text style={pricingStyles.pricingTitle}>Price estimate</Text>
      <Text style={pricingStyles.pricingCaption}>
        Transparent breakdown before you confirm. Your assigned partner may review site details before the visit.
      </Text>
      <Card variant="elevated" padded>
        <PricingMoneyRow label="Base visit" amountPaise={breakdown.base_paise} />
        <PricingMoneyRow
          label={`Panels (${breakdown.panel_count} × rate)`}
          amountPaise={breakdown.panels_line_paise}
        />
        <PricingMoneyRow
          label={`System size (${formatKwDisplay(breakdown.capacity_kw)} kW × rate)`}
          amountPaise={breakdown.kw_line_paise}
        />
        <View style={pricingStyles.divider} />
        <PricingMoneyRow label="Subtotal from visit details" amountPaise={breakdown.subtotal_paise} />
        <View style={pricingStyles.locationRow}>
          <View style={pricingStyles.locationTextCol}>
            <Text style={pricingStyles.moneyLabel}>Area rate (multiplier)</Text>
            <Text style={pricingStyles.locationHint}>{areaHint}</Text>
          </View>
          <Text style={pricingStyles.multiplierBadge}>×{mLabel}</Text>
        </View>
        <View style={pricingStyles.divider} />
        <View style={pricingStyles.totalRow}>
          <Text style={pricingStyles.totalLabel}>Estimated total</Text>
          <Text style={pricingStyles.totalValue}>{formatInrFromCents(breakdown.final_paise)}</Text>
        </View>
      </Card>
      <Text style={pricingStyles.footnote}>
        This estimate uses the panel count, system size, and city saved on your profile
        {cityLine ? ` (${cityLine})` : ""}. Amounts are in Indian rupees (₹).
      </Text>
    </View>
  );
}

const pricingStyles = StyleSheet.create({
  block: {
    marginBottom: spacing.md,
  },
  pricingTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  pricingCaption: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  moneyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  moneyLabel: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.foreground,
  },
  moneyValue: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.foreground,
    textAlign: "right",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  locationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  locationTextCol: {
    flex: 1,
  },
  locationHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  multiplierBadge: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.primary,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  totalLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  totalValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.foreground,
  },
  footnote: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.mutedForeground,
  },
});

type RoutingPreviewOk = {
  ok: true;
  routing: VendorRoutingResolution;
  resolvedName: string;
  requestedName: string;
};
type RoutingPreviewBad = { ok: false };
type RoutingPreviewResult = RoutingPreviewOk | RoutingPreviewBad;

type CustomerCompensationCredit = {
  couponId: string;
  couponCode: string;
  amountPaise: number;
  expiresAt: string | null;
  sourceBookingId: string;
};

function readCompAppliedCouponId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const row = (metadata as Record<string, unknown>).compensation_applied;
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const id = (row as Record<string, unknown>).coupon_id;
  return typeof id === "string" ? id : null;
}

function describeRoutingForCustomer(p: RoutingPreviewOk): string {
  const { routing, resolvedName, requestedName } = p;
  if (!routing.usedFallback) {
    return `Your visit will be requested with ${resolvedName}, which covers your saved service location.`;
  }
  switch (routing.reason) {
    case "preferred_ineligible_customer_fallback":
      return `${requestedName} does not cover your saved service area for this visit. OorjaMan will assign ${resolvedName} - the backup partner you saved in Profile.`;
    case "preferred_ineligible_platform_default":
      return `${requestedName} does not cover your saved service area. OorjaMan will assign ${resolvedName} as your service partner.`;
    case "preferred_missing_customer_fallback":
      return `We could not match your choice to your saved area. OorjaMan will assign ${resolvedName} - the backup partner you saved in Profile.`;
    case "preferred_missing_platform_default":
      return `We could not match your choice to your saved area. OorjaMan will assign ${resolvedName} as your service partner.`;
    default:
      return `OorjaMan will assign ${resolvedName} for this visit.`;
  }
}

export default function BookVisitModal() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{
    vendorId?: string | string[];
    amcSlotId?: string | string[];
    paidVisit?: string | string[];
  }>();
  const vendorParam = params.vendorId;
  const vendorParamId = Array.isArray(vendorParam) ? vendorParam[0] : vendorParam;
  const amcSlotParam = params.amcSlotId;
  const amcSlotId = Array.isArray(amcSlotParam) ? amcSlotParam[0] : amcSlotParam;
  const paidVisitParam = params.paidVisit;
  const [paidVisitChosen, setPaidVisitChosen] = useState(false);
  const paidVisitConfirmed =
    paidVisitChosen ||
    (Array.isArray(paidVisitParam) ? paidVisitParam[0] : paidVisitParam) === "1";

  const [step, setStep] = useState<Step>(0);
  const [vendorPick, setVendorPick] = useState<BookingVendorPick>(() =>
    vendorParamId ? { mode: "preferred", vendorId: vendorParamId } : { mode: "any" },
  );
  const vendorId = vendorPick.mode === "preferred" ? vendorPick.vendorId : null;
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [slot, setSlot] = useState<BookingSlotOption | null>(null);
  const [slotEvalNow, setSlotEvalNow] = useState(() => new Date());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const p = getISTWallParts(new Date());
    return { y: p.year, m: p.month };
  });
  const [address, setAddress] = useState("");
  const [selectedServiceAddressId, setSelectedServiceAddressId] = useState<string | null>(null);
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const addressPrefilledRef = useRef(false);
  /** Set when a `pending_payment` booking row is created at checkout (before or after the payment row exists). */
  const checkoutDraftBookingIdRef = useRef<string | null>(null);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [paymentFailedBanner, setPaymentFailedBanner] = useState(false);
  const [paymentSessionError, setPaymentSessionError] = useState<string | null>(null);
  const [bookingFor, setBookingFor] = useState<"self" | "other">("self");
  const [bookingPlanMode, setBookingPlanMode] = useState<"one_time" | "amc">("one_time");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientAltPhone, setRecipientAltPhone] = useState("");
  const [recipientRelation, setRecipientRelation] = useState("");

  const vendorsQuery = useQuery({
    queryKey: queryKeys.vendors.approvedDirectory(),
    queryFn: () => vendorApi.listApprovedVendors(supabase!),
    enabled: Boolean(supabase),
  });

  const customerQuery = useQuery({
    queryKey: queryKeys.customers.mine(),
    queryFn: () => customerApi.getMyCustomer(supabase!),
    enabled: Boolean(supabase),
  });

  const serverVendorPrefs = useMemo(
    () => ({
      preferredVendorIds: readPreferredVendorIdsForDefaultServiceLocation(customerQuery.data ?? null),
      fallbackVendorId: readFallbackVendorIdFromCustomer(customerQuery.data ?? null),
    }),
    [customerQuery.data],
  );

  const subscriptionsQuery = useQuery({
    queryKey: queryKeys.subscriptions.list(),
    queryFn: () => subscriptionApi.listVisibleSubscriptions(supabase!),
    enabled: Boolean(supabase),
  });

  const amcSlotQuery = useQuery({
    queryKey: [...queryKeys.subscriptions.all(), "visit-slot", amcSlotId ?? "__none__"],
    queryFn: () => subscriptionApi.getAmcVisitSlotById(supabase!, amcSlotId!),
    enabled: Boolean(supabase && amcSlotId),
  });
  const myBookingsQuery = useQuery({
    queryKey: queryKeys.bookings.list({ scope: "customer-compensation" }),
    queryFn: () => bookingApi.listVisibleBookings(supabase!),
    enabled: Boolean(supabase),
  });
  const creditsQuery = useQuery({
    queryKey: queryKeys.finance.customerOorjamanCredits(),
    queryFn: () => getCustomerOorjamanCreditsSummary(supabase!),
    enabled: Boolean(supabase),
  });
  const addressBook = readServiceAddressBook(customerQuery.data ?? null);

  const gateAddressId =
    selectedServiceAddressId ?? addressBook.defaultId ?? addressBook.entries[0]?.id ?? null;

  const activeSubscription = useMemo(() => {
    const rows = subscriptionsQuery.data ?? [];
    if (amcSlotQuery.data) {
      return rows.find((s) => s.id === amcSlotQuery.data.subscription_id) ?? null;
    }
    if (!gateAddressId) return null;
    return getActiveSubscriptionForAddress(rows, gateAddressId);
  }, [subscriptionsQuery.data, amcSlotQuery.data, gateAddressId]);

  const amcVisitSlotsQuery = useQuery({
    queryKey: queryKeys.subscriptions.visitSlots(activeSubscription?.id ?? "__none__"),
    queryFn: () =>
      subscriptionApi.listAmcVisitSlotsForSubscription(supabase!, activeSubscription!.id),
    enabled: Boolean(supabase && activeSubscription?.id),
  });

  const amcContractQuery = useQuery({
    queryKey: queryKeys.finance.amcWalletBySubscription(activeSubscription?.id ?? "__none__"),
    queryFn: () => getAmcContractBySubscriptionId(supabase!, activeSubscription!.id),
    enabled: Boolean(supabase && activeSubscription?.id),
  });

  const amcGateBookingsQuery = useQuery({
    queryKey: [
      ...queryKeys.bookings.all(),
      "amc-gate",
      activeSubscription?.id ?? "__none__",
      gateAddressId ?? "__none__",
    ],
    queryFn: () =>
      bookingApi.listVisibleBookings(supabase!, {
        from: activeSubscription!.starts_at,
        to: activeSubscription!.ends_at,
      }),
    enabled: Boolean(supabase && activeSubscription?.id && gateAddressId),
  });

  const visitsConsumedAtAddress = useMemo(() => {
    if (!activeSubscription || !gateAddressId) return 0;
    return countAmcVisitsConsumedAtAddress(
      amcVisitSlotsQuery.data ?? [],
      activeSubscription,
      amcGateBookingsQuery.data ?? [],
      gateAddressId,
    );
  }, [activeSubscription, amcVisitSlotsQuery.data, amcGateBookingsQuery.data, gateAddressId]);

  const amcBookingGate = useMemo(
    () =>
      resolveAmcVisitBookingGate(activeSubscription, amcVisitSlotsQuery.data ?? [], {
        wallet: amcContractQuery.data ?? null,
        visitsConsumedAtAddress,
      }),
    [activeSubscription, amcVisitSlotsQuery.data, amcContractQuery.data, visitsConsumedAtAddress],
  );

  const amcBlocksOneTime = activeAmcBlocksOneTimeBooking(amcBookingGate);
  const amcGateDataReady =
    !subscriptionsQuery.isPending &&
    (!activeSubscription?.id ||
      (!amcVisitSlotsQuery.isPending &&
        !amcContractQuery.isPending &&
        !amcGateBookingsQuery.isFetching));
  const showsAmcAwaitingPartnerGate =
    !amcSlotId && amcGateDataReady && isAmcAwaitingPartnerAssignment(amcBookingGate);
  const showsAmcChoiceGate =
    !amcSlotId &&
    !paidVisitConfirmed &&
    amcGateDataReady &&
    bookVisitRequiresAmcChoiceGate(amcBookingGate);
  const mayBookOneTime =
    paidVisitConfirmed && bookVisitRequiresAmcChoiceGate(amcBookingGate);

  useEffect(() => {
    if (amcSlotId) setBookingPlanMode("amc");
    else if (amcBlocksOneTime) setBookingPlanMode("amc");
    else setBookingPlanMode("one_time");
  }, [amcSlotId, amcBlocksOneTime]);

  useEffect(() => {
    if (amcSlotId) return;
    if (amcBookingGate.kind !== "use_amc_slot") return;
    router.replace(`/book?amcSlotId=${encodeURIComponent(amcBookingGate.nextSlot.id)}`);
  }, [amcSlotId, amcBookingGate]);

  useEffect(() => {
    const sub = activeSubscription;
    if (!amcSlotId || !sub?.service_address_id) return;
    setSelectedServiceAddressId(sub.service_address_id);
  }, [amcSlotId, activeSubscription?.id, activeSubscription?.service_address_id]);

  const routingDefaultsQuery = useQuery({
    queryKey: queryKeys.platform.settings(),
    queryFn: () => getBookingRoutingDefaults(supabase!),
    enabled: Boolean(supabase),
  });

  const routingPreview = useMemo((): RoutingPreviewResult | null => {
    if (vendorPick.mode === "any") return null;
    if (!vendorId || !customerQuery.data || !vendorsQuery.data?.length) return null;
    if (customerQuery.isPending || routingDefaultsQuery.isPending) return null;
    try {
      const signals = customerLocationSignalsFromCustomer(customerQuery.data);
      const prefs = serverVendorPrefs;
      const defaults = routingDefaultsQuery.data ?? { defaultVendorId: null, customerLateCancelFeePaise: 0 };
      const routing = resolveBookingVendor({
        requestedVendorId: vendorId,
        customerFallbackVendorId: prefs.fallbackVendorId,
        platformDefaultVendorId: defaults.defaultVendorId,
        signals,
        approvedVendors: vendorsQuery.data,
      });
      const resolvedName =
        vendorsQuery.data.find((v) => v.id === routing.resolvedVendorId)?.business_name ?? "Partner";
      const requestedName =
        vendorsQuery.data.find((v) => v.id === routing.requestedVendorId)?.business_name ?? "Partner";
      return { ok: true, routing, resolvedName, requestedName };
    } catch {
      return { ok: false };
    }
  }, [
    vendorPick.mode,
    vendorId,
    customerQuery.data,
    customerQuery.isPending,
    vendorsQuery.data,
    serverVendorPrefs.fallbackVendorId,
    serverVendorPrefs.preferredVendorIds,
    routingDefaultsQuery.data,
    routingDefaultsQuery.isPending,
  ]);

  useEffect(() => {
    if (!vendorParamId || !vendorsQuery.data?.some((v) => v.id === vendorParamId)) return;
    setVendorPick({ mode: "preferred", vendorId: vendorParamId });
  }, [vendorParamId, vendorsQuery.data]);

  useEffect(() => {
    if (vendorParamId) return;
    const vendors = vendorsQuery.data;
    const prefs = serverVendorPrefs;
    if (!vendors?.length || customerQuery.isPending) return;
    setVendorPick((cur) => {
      if (cur.mode === "preferred" && vendors.some((v) => v.id === cur.vendorId)) return cur;
      return pickDefaultVendorFromPrefs(vendors, prefs.preferredVendorIds);
    });
  }, [vendorParamId, vendorsQuery.data, serverVendorPrefs.preferredVendorIds, customerQuery.isPending]);

  useEffect(() => {
    if (addressPrefilledRef.current) return;
    const c = customerQuery.data;
    const { entries, defaultId } = readServiceAddressBook(c ?? null);
    const preferred = defaultId ? entries.find((e) => e.id === defaultId) ?? null : entries[0] ?? null;
    const source = preferred?.address ?? c?.service_default_address ?? null;
    if (!source) return;
    setAddress(formatCustomerAddressMultiline(source));
    if (preferred?.id) setSelectedServiceAddressId(preferred.id);
    else if (defaultId) setSelectedServiceAddressId(defaultId);
    addressPrefilledRef.current = true;
  }, [customerQuery.data]);
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

  const { width: windowWidth } = useWindowDimensions();

  /** Refresh scheduling anchor when opening the combined schedule step (IST rules / lead time). */
  const [scheduleAnchor, setScheduleAnchor] = useState(() => new Date());
  useEffect(() => {
    if (step === 1) {
      setScheduleAnchor(new Date());
    }
  }, [step]);

  const prevStepRefSync = useRef<Step>(0);
  useEffect(() => {
    if (step === 1 && prevStepRefSync.current !== 1) {
      setSlotEvalNow(new Date());
      const k = minSelectableDayKey(new Date());
      const [yy, mo] = k.split("-").map(Number);
      setCalendarMonth({ y: yy, m: mo });
    }
    prevStepRefSync.current = step;
  }, [step]);

  useEffect(() => {
    setSlot(null);
  }, [dayKey]);

  const selectableDayKeys = useMemo(
    () => listSelectableDayKeys(scheduleAnchor, BOOKING_SCHEDULE_HORIZON_DAYS),
    [scheduleAnchor],
  );
  const selectableDayKeySet = useMemo(() => new Set(selectableDayKeys), [selectableDayKeys]);
  const maxSelectableDayKey = selectableDayKeys[selectableDayKeys.length - 1] ?? null;
  const istTodayDayKey = useMemo(() => istDayKeyFromDate(scheduleAnchor), [scheduleAnchor]);
  const minSelectableMonth = useMemo(() => {
    const k = minSelectableDayKey(scheduleAnchor);
    const [y, m] = k.split("-").map(Number);
    return { y, m };
  }, [scheduleAnchor]);
  const maxSelectableMonth = useMemo(() => {
    if (!maxSelectableDayKey) return minSelectableMonth;
    const [y, m] = maxSelectableDayKey.split("-").map(Number);
    return { y, m };
  }, [maxSelectableDayKey, minSelectableMonth]);

  useEffect(() => {
    if (selectableDayKeys.length === 0) {
      setDayKey(null);
      return;
    }
    setDayKey((prev) => (prev && selectableDayKeySet.has(prev) ? prev : selectableDayKeys[0]));
  }, [selectableDayKeys, selectableDayKeySet]);

  const baseSlotOptions = useMemo(() => {
    if (!dayKey) return [];
    return slotsForDay(dayKey, slotEvalNow);
  }, [dayKey, slotEvalNow]);

  const slotIdsQueryKey = useMemo(() => baseSlotOptions.map((s) => s.id).join(","), [baseSlotOptions]);

  const slotBookabilityQuery = useQuery({
    queryKey: queryKeys.vendors.slotBookabilityBatch(vendorId ?? "", dayKey ?? "", slotIdsQueryKey),
    queryFn: () =>
      vendorApi.vendorSlotBookabilityBatch(supabase!, {
        vendorId: vendorId!,
        dayKey: dayKey!,
        slotIds: baseSlotOptions.map((s) => s.id),
      }),
    enabled: Boolean(
      supabase && step === 1 && dayKey && vendorPick.mode === "preferred" && vendorId && baseSlotOptions.length > 0,
    ),
  });

  const filteredSlotOptions = useMemo(() => {
    if (vendorPick.mode !== "preferred" || !vendorId) return baseSlotOptions;
    if (!dayKey || baseSlotOptions.length === 0) return [];
    if (slotBookabilityQuery.isPending || slotBookabilityQuery.isFetching) return [];
    if (slotBookabilityQuery.isError) return baseSlotOptions;
    const m = slotBookabilityQuery.data ?? new Map();
    return baseSlotOptions.filter((s) => m.get(s.id));
  }, [
    vendorPick.mode,
    vendorId,
    dayKey,
    baseSlotOptions,
    slotBookabilityQuery.data,
    slotBookabilityQuery.isPending,
    slotBookabilityQuery.isFetching,
    slotBookabilityQuery.isError,
  ]);

  useEffect(() => {
    if (!slot) return;
    if (vendorPick.mode === "preferred" && vendorId && slotBookabilityQuery.isSuccess) {
      if (filteredSlotOptions.length === 0) {
        setSlot(null);
        return;
      }
      if (!filteredSlotOptions.some((s) => s.id === slot.id)) setSlot(null);
    } else if (vendorPick.mode === "any") {
      if (!baseSlotOptions.some((s) => s.id === slot.id)) setSlot(null);
    }
  }, [
    slot,
    vendorPick.mode,
    vendorId,
    filteredSlotOptions,
    baseSlotOptions,
    slotBookabilityQuery.isSuccess,
  ]);

  const calendarRows = useMemo(() => {
    const grid = buildMonthCalendarGridIST(calendarMonth.y, calendarMonth.m);
    const rows: (typeof grid)[] = [];
    for (let i = 0; i < grid.length; i += 7) {
      rows.push(grid.slice(i, i + 7));
    }
    return rows;
  }, [calendarMonth]);

  const goPrevCalendarMonth = useCallback(() => {
    setCalendarMonth((cm) => {
      if (ymKey(cm.y, cm.m) <= ymKey(minSelectableMonth.y, minSelectableMonth.m)) return cm;
      if (cm.m === 1) return { y: cm.y - 1, m: 12 };
      return { y: cm.y, m: cm.m - 1 };
    });
  }, [minSelectableMonth]);

  const goNextCalendarMonth = useCallback(() => {
    setCalendarMonth((cm) => {
      if (ymKey(cm.y, cm.m) >= ymKey(maxSelectableMonth.y, maxSelectableMonth.m)) return cm;
      if (cm.m === 12) return { y: cm.y + 1, m: 1 };
      return { y: cm.y, m: cm.m + 1 };
    });
  }, [maxSelectableMonth]);

  const canPrevCalendarMonth = ymKey(calendarMonth.y, calendarMonth.m) > ymKey(minSelectableMonth.y, minSelectableMonth.m);
  const canNextCalendarMonth = ymKey(calendarMonth.y, calendarMonth.m) < ymKey(maxSelectableMonth.y, maxSelectableMonth.m);

  const slotChipWidth = useMemo(() => {
    const pad = spacing.md * 2;
    const gaps = spacing.sm * 2;
    return Math.max(96, (windowWidth - pad - gaps) / 3);
  }, [windowWidth]);

  const selectedVendor = useMemo(
    () => vendorsQuery.data?.find((v) => v.id === vendorId) ?? null,
    [vendorsQuery.data, vendorId],
  );

  const locationSignals = useMemo(
    () => customerLocationSignalsFromCustomer(customerQuery.data ?? null),
    [customerQuery.data],
  );
  const preferredInAreaVendors = useMemo(() => {
    const rows = vendorsQuery.data ?? [];
    const inArea = splitVendorsByServiceArea(rows, locationSignals).inArea;
    return rankVendorsByNearest(inArea, locationSignals);
  }, [vendorsQuery.data, locationSignals]);
  const preferredVendorCards = useMemo((): VendorRow[] => {
    const approved = vendorsQuery.data ?? [];
    const ids = serverVendorPrefs.preferredVendorIds;
    const rows: VendorRow[] = [];
    for (const id of ids) {
      const v = approved.find((x) => x.id === id);
      if (v) rows.push(v);
    }
    return rows;
  }, [vendorsQuery.data, serverVendorPrefs.preferredVendorIds]);

  const vendorStatsIds = useMemo(() => {
    const s = new Set<string>();
    for (const v of preferredVendorCards) s.add(v.id);
    for (const v of preferredInAreaVendors) s.add(v.id);
    return [...s].sort();
  }, [preferredVendorCards, preferredInAreaVendors]);

  const preferredCoverageHint = useMemo(() => {
    const count = preferredInAreaVendors.length;
    if (count === 0) {
      if (locationSignals.pincode?.trim() || locationSignals.city || locationSignals.state) {
        return "No partners cover your selected location yet - call support or try a nearby PIN.";
      }
      return "Add your service address in Profile so we can match partners to your site.";
    }
    const noun = count === 1 ? "vendor" : "vendors";
    return `${count} ${noun} cover your selected location.`;
  }, [preferredInAreaVendors.length, locationSignals.pincode, locationSignals.city, locationSignals.state]);
  const vendorDistanceById = useMemo(() => {
    const m = new Map<string, number>();
    if (!Number.isFinite(locationSignals.lat) || !Number.isFinite(locationSignals.lng)) return m;
    const customer = { lat: Number(locationSignals.lat), lng: Number(locationSignals.lng) };
    for (const v of preferredInAreaVendors) {
      const point = vendorPoint(v);
      if (!point) continue;
      m.set(v.id, kmDistance(customer, point));
    }
    return m;
  }, [preferredInAreaVendors, locationSignals.lat, locationSignals.lng]);
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
  const solarSizing = useMemo(
    () => getCustomerSolarSizing(customerQuery.data ?? null),
    [customerQuery.data],
  );
  const panelCount = solarSizing.ready ? solarSizing.panelCount : 0;
  const capacityKw = solarSizing.ready ? solarSizing.capacityKw : 0;
  const cityKey = locationSignals.city?.trim().toLowerCase() ?? "";

  const pricingCountryCode = useMemo(() => {
    const addr = customerQuery.data?.service_default_address;
    if (addr && typeof addr === "object" && !Array.isArray(addr)) {
      const o = addr as Record<string, unknown>;
      const raw =
        (typeof o.country_code === "string" && o.country_code) ||
        (typeof o.country === "string" && o.country) ||
        null;
      if (raw?.trim()) return normalizeCountryCode(raw);
    }
    return normalizeCountryCode("IN");
  }, [customerQuery.data?.service_default_address]);

  const scheduleComplete = Boolean(dayKey && slot && (vendorPick.mode === "any" || Boolean(vendorId)));

  useEffect(() => {
    if (bookingPlanMode === "amc" && !activeSubscription && !amcSlotId) {
      setBookingPlanMode("one_time");
    }
    if (bookingPlanMode === "one_time" && amcBlocksOneTime) {
      setBookingPlanMode("amc");
    }
  }, [bookingPlanMode, activeSubscription, amcSlotId, amcBlocksOneTime]);

  useEffect(() => {
    if (bookingPlanMode === "amc" && step === 3) {
      setStep(2);
    }
  }, [bookingPlanMode, step]);

  const pricingQuery = useQuery({
    queryKey: queryKeys.pricing.visitEstimate({
      vendorId,
      dayKey,
      slotId: slot?.id ?? null,
      panelCount,
      capacityKw,
      cityKey,
      countryCode: pricingCountryCode,
    }),
    queryFn: async () => {
      const quote = await quoteOneTimeServicePrice(supabase!, {
        capacityKw,
        countryCode: pricingCountryCode,
        cityKey: cityKey.trim() || null,
      });
      return {
        quote,
        estimate: {
          final_paise: quote.amount_cents,
          subtotal_paise: quote.amount_cents,
          multiplier: 1,
          matched_city: locationSignals.city ?? null,
          matched_tier_code: quote.capacity_tier_code,
          matched_tier_label: quote.tier_label,
          pricing_country_code: pricingCountryCode,
        },
      };
    },
    enabled: Boolean(supabase && scheduleComplete && customerQuery.isSuccess && solarSizing.ready),
  });
  const availableCompensation = useMemo((): CustomerCompensationCredit | null => {
    const rows = myBookingsQuery.data ?? [];
    const usedCouponIds = new Set(rows.map((b) => readCompAppliedCouponId(b.metadata)).filter(Boolean) as string[]);
    const nowMs = Date.now();
    const candidates: CustomerCompensationCredit[] = [];
    for (const b of rows) {
      const comp = readBookingCustomerCompensationMeta(b.metadata);
      if (!comp.couponId || !comp.couponCode || comp.amountPaise <= 0) continue;
      if (usedCouponIds.has(comp.couponId)) continue;
      if (comp.expiresAt) {
        const exp = new Date(comp.expiresAt).getTime();
        if (Number.isFinite(exp) && exp < nowMs) continue;
      }
      candidates.push({
        couponId: comp.couponId,
        couponCode: comp.couponCode,
        amountPaise: comp.amountPaise,
        expiresAt: comp.expiresAt,
        sourceBookingId: b.id,
      });
    }
    candidates.sort((a, b) => b.amountPaise - a.amountPaise);
    return candidates[0] ?? null;
  }, [myBookingsQuery.data]);
  const grossEstimatePaise = pricingQuery.data?.estimate.final_paise ?? 0;
  const creditsRedemptionPlan = useMemo(() => {
    if (bookingPlanMode !== "one_time" || grossEstimatePaise <= 0) {
      return { discount_paise: 0, discount_credits: 0, allocations: [] };
    }
    return planOorjamanCreditsRedemption(
      creditsQuery.data?.active_grants ?? [],
      grossEstimatePaise,
    );
  }, [bookingPlanMode, grossEstimatePaise, creditsQuery.data?.active_grants]);
  const creditsDiscountPaise = creditsRedemptionPlan.discount_paise;
  const afterCreditsPaise = Math.max(0, grossEstimatePaise - creditsDiscountPaise);
  const compensationDiscountPaise =
    bookingPlanMode === "one_time" && availableCompensation
      ? Math.min(availableCompensation.amountPaise, afterCreditsPaise)
      : 0;
  const payableEstimatePaise = Math.max(0, afterCreditsPaise - compensationDiscountPaise);

  const abandonCheckoutIfNeeded = useCallback(async () => {
    if (!supabase || bookingPlanMode !== "one_time") return;
    try {
      if (pendingPaymentId) {
        await paymentApi.abandonPendingCheckout(supabase, pendingPaymentId);
      } else if (checkoutDraftBookingIdRef.current) {
        await bookingApi.customerAbandonUnpaidCheckoutBooking(supabase, checkoutDraftBookingIdRef.current);
      }
    } catch {
      /* still allow leaving the screen */
    }
    checkoutDraftBookingIdRef.current = null;
    setPendingPaymentId(null);
    await qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
    await qc.invalidateQueries({ queryKey: queryKeys.payments.all() });
  }, [supabase, bookingPlanMode, pendingPaymentId, qc]);

  const requestCloseBooking = useCallback(() => {
    const message =
      bookingPlanMode === "one_time" && step === 3
        ? "A visit request is created when you open the payment step (before you pay). Leaving cancels any unpaid checkout draft. Earlier wizard steps are not kept."
        : "Your selections on this screen are not saved after you leave.";
    Alert.alert("Leave booking?", message, [
      { text: "Stay", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () =>
          void (async () => {
            await abandonCheckoutIfNeeded();
            router.back();
          })(),
      },
    ]);
  }, [bookingPlanMode, step, abandonCheckoutIfNeeded]);

  const modalHeader = useModalStackHeader({
    title: "Book a visit",
    subtitle:
      step === 1
        ? "Choose service and schedule"
        : step === 2
          ? "Site and partner"
          : step === 3
            ? "Review and pay"
            : undefined,
    onClose: requestCloseBooking,
    closeAccessibilityLabel: "Close booking",
  });
  const keyboardHeaderOffset = insets.top + 52;

  useEffect(() => {
    if (step < 3) {
      setPendingPaymentId(null);
      setPaymentFailedBanner(false);
      setPaymentSessionError(null);
    }
  }, [step]);

  useEffect(() => {
    if (step !== 3 || bookingPlanMode !== "one_time" || !supabase || !customerQuery.data?.id || !pricingQuery.data) return;
    if (pendingPaymentId) return;
    if (paymentSessionError) return;
    let cancelled = false;
    let draftBookingId: string | null = null;
    void (async () => {
      try {
        const bookedAt = new Date();
        if ((vendorPick.mode === "preferred" && !vendorId) || !dayKey || !slot) {
          throw new Error("Complete scheduling before payment.");
        }
        if (!address.trim()) {
          throw new Error("Enter the service site address on the previous step.");
        }
        if (!isSlotValidAt(dayKey, slot, bookedAt)) {
          throw new Error("This slot is no longer available - go back and choose another time.");
        }
        const customer = await customerApi.ensureCustomerProfile(supabase);
        const fresh = await customerApi.getMyCustomer(supabase);
        const defaults = await getBookingRoutingDefaults(supabase);
        const customerFallbackVendorId = readFallbackVendorIdFromCustomer(fresh ?? customer);
        const approved = vendorsQuery.data ?? [];
        if (approved.length === 0) {
          throw new Error("Approved partners list not loaded - try again.");
        }
        const signals = customerLocationSignalsFromCustomer(fresh ?? customer);
        const filterPincode = signals.pincode?.replace(/\D/g, "").slice(0, 6) || null;
        const routing =
          vendorPick.mode === "any"
            ? null
            : resolveBookingVendor({
              requestedVendorId: vendorId!,
              customerFallbackVendorId,
              platformDefaultVendorId: defaults.defaultVendorId,
              signals,
              approvedVendors: approved,
            });
        const scheduleSlotMeta = {
          day_key: dayKey,
          slot_id: slot.id,
          label: slot.label,
        } as Json;
        const preferredAvailable =
          routing?.resolvedVendorId && vendorPick.mode === "preferred"
            ? await vendorApi.isVendorAvailableForSlot(supabase, {
              vendorId: routing.resolvedVendorId,
              dayKey,
              slotId: slot.id,
            })
            : true;
        const useDefaultMarketplace = vendorPick.mode === "any" || !preferredAvailable;
        const nowIso = new Date().toISOString();
        const estimatePaise = payableEstimatePaise;
        const serviceAddressId =
          selectedServiceAddressId ?? addressBook.defaultId ?? addressBook.entries[0]?.id ?? null;
        const payload = buildCustomerBookingCreateInput({
          customerId: customer.id,
          vendorId: useDefaultMarketplace ? null : (routing?.resolvedVendorId ?? null),
          scheduledStart: slot.scheduledStart,
          scheduledEnd: slot.scheduledEnd,
          customer: fresh ?? customer,
          siteAddressText: address.trim(),
          customerNotes: notes.trim() || null,
          serviceAddressId,
          estimatedPricePaise: estimatePaise,
          vendorRouting: {
            requested_vendor_id: routing?.requestedVendorId ?? null,
            resolved_vendor_id: useDefaultMarketplace ? null : (routing?.resolvedVendorId ?? null),
            used_fallback: useDefaultMarketplace ? true : (routing?.usedFallback ?? false),
            reason: useDefaultMarketplace ? "default_vendor_marketplace" : (routing?.reason ?? "default_vendor_marketplace"),
          },
          extraMetadata:
            pricingQuery.data != null
              ? {
                pricing_final_paise: pricingQuery.data.estimate.final_paise,
                pricing_subtotal_paise: pricingQuery.data.estimate.subtotal_paise,
                pricing_multiplier: pricingQuery.data.estimate.multiplier,
                pricing_matched_city: pricingQuery.data.estimate.matched_city,
                pricing_matched_tier_code: pricingQuery.data.estimate.matched_tier_code,
                pricing_matched_tier_label: pricingQuery.data.estimate.matched_tier_label,
                pricing_country_code: pricingQuery.data.estimate.pricing_country_code,
                booking_recipient: buildBookingRecipientMeta({
                  isSelf: bookingFor === "self",
                  recipientName: bookingFor === "other" ? recipientName : null,
                  recipientPhone: bookingFor === "other" ? recipientPhone : null,
                  recipientAltPhone: bookingFor === "other" ? recipientAltPhone : null,
                  relationship: bookingFor === "other" ? recipientRelation : null,
                  notifyRecipient: bookingFor === "other",
                }) as unknown as Json,
                schedule_slot: scheduleSlotMeta,
                ...(useDefaultMarketplace
                  ? {
                    marketplace: {
                      mode: "default_vendor",
                      floated: false,
                      awaiting_admin_float: true,
                      accept_window_hours: 1,
                      post_7pm_admin_queue: true,
                      auto_routed_from_preferred_unavailable: vendorPick.mode === "preferred" && !preferredAvailable,
                      broadcast_filter: "customer_pin",
                      filter_pincode: filterPincode,
                      filter_city: signals.city?.trim() || null,
                    } as Json,
                  }
                  : {}),
                ...(creditsDiscountPaise > 0
                  ? {
                      oorjaman_credits_planned: {
                        discount_paise: creditsDiscountPaise,
                        discount_credits: creditsRedemptionPlan.discount_credits,
                      } as Json,
                    }
                  : {}),
                ...(availableCompensation && compensationDiscountPaise > 0
                  ? {
                    compensation_applied: {
                      coupon_id: availableCompensation.couponId,
                      coupon_code: availableCompensation.couponCode,
                      source_booking_id: availableCompensation.sourceBookingId,
                      discount_paise: compensationDiscountPaise,
                    } as Json,
                  }
                  : {}),
                payment_dummy: true,
              }
              : { payment_dummy: true },
        });
        const booking = await bookingApi.createBookingAsCustomer(supabase, payload);
        draftBookingId = booking.id;
        checkoutDraftBookingIdRef.current = booking.id;
        if (cancelled) {
          await bookingApi.customerAbandonUnpaidCheckoutBooking(supabase, booking.id).catch(() => { });
          checkoutDraftBookingIdRef.current = null;
          return;
        }
        const pay = await paymentApi.createPendingPayment(supabase, {
          customerId: customer.id,
          bookingId: booking.id,
          amountPaise: estimatePaise,
        });
        if (cancelled) {
          await paymentApi.abandonPendingCheckout(supabase, pay.id).catch(() => { });
          checkoutDraftBookingIdRef.current = null;
          return;
        }
        if (!cancelled) {
          setPendingPaymentId(pay.id);
          setPaymentFailedBanner(false);
        }
      } catch (e) {
        if (draftBookingId && supabase) {
          void bookingApi.customerAbandonUnpaidCheckoutBooking(supabase, draftBookingId).catch(() => { });
        }
        checkoutDraftBookingIdRef.current = null;
        if (!cancelled) {
          setPaymentSessionError((e as Error).message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    step,
    pendingPaymentId,
    customerQuery.data?.id,
    pricingQuery.data,
    supabase,
    paymentSessionError,
    vendorId,
    vendorPick.mode,
    bookingPlanMode,
    dayKey,
    slot,
    address,
    notes,
    bookingFor,
    recipientName,
    recipientPhone,
    recipientAltPhone,
    recipientRelation,
    vendorsQuery.data,
    availableCompensation,
    compensationDiscountPaise,
    creditsDiscountPaise,
    creditsRedemptionPlan.discount_credits,
    payableEstimatePaise,
  ]);

  const failPaymentMut = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("Supabase is not configured.");
      if (!pendingPaymentId) throw new Error("No active payment session.");
      await paymentApi.markDummyPaymentFailed(supabase, pendingPaymentId);
    },
    onSuccess: () => {
      setPaymentFailedBanner(true);
      setPendingPaymentId(null);
    },
  });

  const paySuccessMut = useMutation({
    mutationFn: async () => {
      const bookedAt = new Date();
      if (!supabase) throw new Error("Supabase is not configured.");
      if (!pendingPaymentId) throw new Error("Payment session not ready - wait a moment or go back.");
      if ((vendorPick.mode === "preferred" && !vendorId) || !dayKey || !slot) {
        throw new Error("Complete each step before submitting.");
      }
      if (!address.trim()) throw new Error("Enter the site address.");
      if (!isSlotValidAt(dayKey, slot, bookedAt)) {
        throw new Error("This slot is no longer available - choose another time.");
      }
      const approved = vendorsQuery.data ?? [];
      const { booking, payment } = await paymentApi.completeDummyPaymentSuccess(supabase, pendingPaymentId, {
        paymentMethod: randomDummyIndianPaymentMethod(),
      });
      if (customerQuery.data?.id && creditsDiscountPaise > 0) {
        await redeemCustomerOorjamanCredits(supabase, {
          customer_id: customerQuery.data.id,
          booking_id: booking.id,
          payment_id: payment.id,
          payable_paise: grossEstimatePaise,
        });
      }
      const partnerAlert = buildPostCheckoutPartnerAlert(booking, approved);
      if (partnerAlert) {
        Alert.alert(partnerAlert.title, partnerAlert.message);
      }
      return booking;
    },
    onSuccess: (booking) => {
      void notifyCustomerBookingCreated(booking.id);
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.payments.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.finance.customerOorjamanCredits() });
      router.replace("/(main)/bookings");
    },
  });

  const confirmAmcVisitMut = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("Supabase is not configured.");
      if (!amcSlotId) throw new Error("Open this flow from your AMC plan to schedule a visit.");
      if (amcSlotQuery.data?.status !== "pending") {
        throw new Error("This AMC visit is already scheduled.");
      }
      if (!activeSubscription) throw new Error("No active AMC plan found.");
      if ((vendorPick.mode === "preferred" && !vendorId) || !dayKey || !slot) {
        throw new Error("Complete scheduling before confirmation.");
      }
      if (!address.trim()) throw new Error("Enter the site address.");
      if (!isSlotValidAt(dayKey, slot, new Date())) {
        throw new Error("This slot is no longer available - choose another time.");
      }
      const customer = await customerApi.ensureCustomerProfile(supabase);
      const fresh = await customerApi.getMyCustomer(supabase);
      const defaults = await getBookingRoutingDefaults(supabase);
      const customerFallbackVendorId = readFallbackVendorIdFromCustomer(fresh ?? customer);
      const approved = vendorsQuery.data ?? [];
      if (approved.length === 0) throw new Error("Approved partners list not loaded - try again.");
      const signals = customerLocationSignalsFromCustomer(fresh ?? customer);
      const filterPincode = signals.pincode?.replace(/\D/g, "").slice(0, 6) || null;
      const routing =
        vendorPick.mode === "any"
          ? null
          : resolveBookingVendor({
            requestedVendorId: vendorId!,
            customerFallbackVendorId,
            platformDefaultVendorId: defaults.defaultVendorId,
            signals,
            approvedVendors: approved,
          });
      const scheduleSlotMeta = { day_key: dayKey, slot_id: slot.id, label: slot.label } as Json;
      const preferredAvailable =
        routing?.resolvedVendorId && vendorPick.mode === "preferred"
          ? await vendorApi.isVendorAvailableForSlot(supabase, {
            vendorId: routing.resolvedVendorId,
            dayKey,
            slotId: slot.id,
          })
          : true;
      const useDefaultMarketplace = vendorPick.mode === "any" || !preferredAvailable;
      const recipientMeta = buildBookingRecipientMeta({
        isSelf: bookingFor === "self",
        recipientName: bookingFor === "other" ? recipientName : null,
        recipientPhone: bookingFor === "other" ? recipientPhone : null,
        recipientAltPhone: bookingFor === "other" ? recipientAltPhone : null,
        relationship: bookingFor === "other" ? recipientRelation : null,
        notifyRecipient: bookingFor === "other",
      }) as unknown as Json;

      const { booking } = await subscriptionApi.scheduleAmcVisitSlot(supabase, {
        slotId: amcSlotId,
        scheduledStart: slot.scheduledStart,
        scheduledEnd: slot.scheduledEnd,
        scheduleSlotMeta,
        siteAddressText: address.trim(),
        serviceAddressId:
          selectedServiceAddressId ?? addressBook.defaultId ?? addressBook.entries[0]?.id ?? null,
        customerNotes: notes.trim() || null,
        bookingRecipient: recipientMeta,
        vendorPick:
          vendorPick.mode === "any"
            ? { mode: "any" }
            : {
              mode: "preferred",
              requestedVendorId: routing!.requestedVendorId,
              resolvedVendorId: routing!.resolvedVendorId,
              usedFallback: routing!.usedFallback,
              reason: routing!.reason,
              preferredUnavailable: useDefaultMarketplace,
              marketplaceFilterPincode: filterPincode,
              marketplaceFilterCity: signals.city?.trim() || null,
            },
      });
      return booking;
    },
    onSuccess: (booking) => {
      void notifyCustomerBookingCreated(booking.id);
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all() });
      Alert.alert(
        "AMC visit scheduled",
        `${customerBookingDisplayTitle(booking)} is confirmed.`,
      );
      router.replace("/(main)/bookings");
    },
  });

  if (!supabase) {
    return (
      <View style={[styles.flex, { paddingBottom: insets.bottom }]}>
        {modalHeader}
        <View style={styles.root}>
          <Text style={styles.muted}>Configure Supabase to book visits.</Text>
        </View>
      </View>
    );
  }

  if (amcSlotId && amcSlotQuery.isError) {
    return (
      <View style={[styles.flex, { paddingBottom: insets.bottom }]}>
        {modalHeader}
        <View style={styles.root}>
          <ErrorStateCard
            title="Couldn't load AMC visit"
            message={(amcSlotQuery.error as Error).message}
            onRetry={() => void amcSlotQuery.refetch()}
            retryLabel="Retry"
          />
        </View>
      </View>
    );
  }

  if (customerQuery.isSuccess && !customerQuery.data?.onboarding_completed_at) {
    return <Redirect href="/customer-registration" />;
  }

  if (showsAmcAwaitingPartnerGate && isAmcAwaitingPartnerAssignment(amcBookingGate)) {
    const serviceAddressId = subscriptionAddressIdForGate(amcBookingGate.subscription);
    return (
      <View style={[styles.flex, { paddingBottom: insets.bottom }]}>
        {modalHeader}
        <View style={styles.root}>
          <BookVisitAmcAwaitingPartnerGate
            gate={amcBookingGate}
            onViewAmc={() => navigateToAmcPlan(serviceAddressId)}
            onContactSupport={() => {
              Alert.alert(
                "Contact support?",
                "We'll open support chat with your AMC details attached. You can close it anytime and continue here.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Open chat",
                    onPress: () =>
                      openSupportChat({
                        subscription_id: amcBookingGate.subscription.id,
                        service_address_id: serviceAddressId,
                        category_slug: "amc",
                        subcategory_slug: AMC_URGENT_CLEANING_SUBCATEGORY_SLUG,
                      }),
                  },
                ],
              );
            }}
            onBack={() => router.back()}
          />
        </View>
      </View>
    );
  }

  if (showsAmcChoiceGate) {
    const serviceAddressId =
      amcBookingGate.kind === "none"
        ? gateAddressId
        : subscriptionAddressIdForGate(amcBookingGate.subscription);
    return (
      <View style={[styles.flex, { paddingBottom: insets.bottom }]}>
        {modalHeader}
        <View style={styles.root}>
          <BookVisitAmcChoiceGate
            gate={amcBookingGate}
            onBookOneTime={() => setPaidVisitChosen(true)}
            onAmcPrimary={() => {
              if (amcBookingGate.kind === "allowance_exhausted") {
                navigateToAmcRenewal(serviceAddressId);
                return;
              }
              navigateToAmcPlan(serviceAddressId);
            }}
            onBack={() => router.back()}
          />
        </View>
      </View>
    );
  }

  if (!amcGateDataReady && !amcSlotId && !paidVisitConfirmed) {
    return (
      <View style={[styles.flex, { paddingBottom: insets.bottom }]}>
        {modalHeader}
        <View style={styles.root}>
          <Card variant="muted" padded>
            <Text style={styles.sectionBody}>Checking your AMC plan for this address…</Text>
          </Card>
        </View>
      </View>
    );
  }

  if (!mayBookOneTime && !amcSlotId) {
    return (
      <View style={[styles.flex, { paddingBottom: insets.bottom }]}>
        {modalHeader}
        <View style={styles.root}>
          <Card variant="muted" padded>
            <Text style={styles.sectionBody}>Opening your AMC visit booking…</Text>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: "padding", android: undefined })}
      keyboardVerticalOffset={Platform.OS === "ios" ? keyboardHeaderOffset : 0}
    >
      {modalHeader}
      <View style={styles.root}>
        <Text style={styles.stepHint}>
          Step {step + 1} of {bookingPlanMode === "amc" ? 3 : 4} ·{" "}
          {step === 0 ? "Partner" : step === 1 ? "Schedule" : step === 2 ? "Confirm" : "Payment"}
        </Text>

        {bookingPlanMode === "one_time" && amcBookingGate.kind === "allowance_exhausted" ? (
          <Card variant="muted" padded>
            <Text style={styles.sectionBody}>
              Your included AMC visits for this address are used. This booking is charged at the standard
              one-time rate.
            </Text>
          </Card>
        ) : null}

        {bookingPlanMode === "amc" && amcBookingGate.kind === "use_amc_slot" ? (
          <Card variant="muted" padded>
            <Text style={styles.sectionBody}>
              {amcVisitBookingGateMessage(amcBookingGate)}
            </Text>
          </Card>
        ) : null}

        {step === 0 ? (
          <>
            <Text style={styles.sectionTitle}>Partner for this visit</Text>
            <Text style={styles.sectionBody}>
              Pick a preferred partner for this visit, or request OorjaMan to assign a partner who serves your saved location.
            </Text>
            <Text style={styles.coverageHint}>{preferredCoverageHint}</Text>
            {amcSlotId && amcSlotQuery.data ? (
              <Card variant="muted" padded>
                <Text style={styles.sectionBody}>
                  Scheduling AMC visit {amcSlotQuery.data.sequence}
                  {activeSubscription?.plan_name ? ` · ${activeSubscription.plan_name}` : ""}
                </Text>
              </Card>
            ) : null}
            {vendorsQuery.isPending ? (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {BOOK_VENDOR_SKEL_KEYS.map((k) => (
                  <BookVendorSkeletonRow key={k} />
                ))}
              </ScrollView>
            ) : vendorsQuery.isError ? (
              <ErrorStateCard
                title="Couldn't load partners"
                message={(vendorsQuery.error as Error).message}
                onRetry={() => void vendorsQuery.refetch()}
              />
            ) : (
              <FadeInView style={styles.vendorList}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.vendorScrollContent}
                >
                  {preferredVendorCards.length === 0 ? (
                    <EmptyStateCard
                      title="No preferred partners yet"
                      description="After you complete a visit, you can save partners under Profile → Preferred partners, or ask OorjaMan to assign a partner below for this booking."
                    />
                  ) : (
                    preferredVendorCards.map((v) => {
                      const selected = vendorPick.mode === "preferred" && vendorPick.vendorId === v.id;
                      const inArea = vendorCoversCustomerSignals(v, locationSignals);
                      const stats = vendorStatsById.get(v.id);
                      return (
                        <Pressable
                          key={v.id}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          onPress={() => setVendorPick({ mode: "preferred", vendorId: v.id })}
                          style={[styles.vendorOptionCard, selected && styles.vendorOptionCardSelected]}
                        >
                          <View style={[styles.vendorRadio, selected && styles.vendorRadioOn]}>
                            {selected ? <View style={styles.vendorRadioDot} /> : null}
                          </View>
                          <View style={styles.vendorOptionBody}>
                            <View style={styles.vendorOptionTitleRow}>
                              <Text style={styles.vendorName}>{v.business_name}</Text>
                              <Text style={styles.preferredBadgeTiny}>PREFERRED</Text>
                            </View>
                            {!inArea ? (
                              <Text style={styles.warnMuted}>
                                May not cover your saved PIN - OorjaMan may assign another partner if needed.
                              </Text>
                            ) : null}
                            {v.trade_name ? <Text style={styles.vendorTradeSmall}>{v.trade_name}</Text> : null}
                            <Text style={styles.vendorMetaSmall}>{vendorStatsCaption(stats)}</Text>
                            {vendorDistanceById.has(v.id) ? (
                              <Text style={styles.mutedSmall}>
                                ~{vendorDistanceById.get(v.id)!.toFixed(1)} km from your saved site
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: vendorPick.mode === "any" }}
                    onPress={() => setVendorPick({ mode: "any" })}
                    style={[styles.vendorOptionCard, vendorPick.mode === "any" && styles.vendorOptionCardSelected]}
                  >
                    <View style={[styles.vendorRadio, vendorPick.mode === "any" && styles.vendorRadioOn]}>
                      {vendorPick.mode === "any" ? <View style={styles.vendorRadioDot} /> : null}
                    </View>
                    <View style={styles.vendorOptionBody}>
                      <Text style={styles.vendorName}>Assign a partner for me</Text>
                      <Text style={styles.mutedSmall}>
                        OorjaMan operations will match you with a service partner for your saved location.
                      </Text>
                    </View>
                  </Pressable>
                </ScrollView>
              </FadeInView>
            )}
            {vendorPick.mode === "any" ? (
              <View style={styles.slaNote}>
                <Card variant="muted" padded>
                  <Text style={styles.slaNoteText}>
                    OorjaMan operations will assign a service partner for your saved location. You will see the partner name in
                    My bookings once assigned.
                  </Text>
                </Card>
              </View>
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.scheduleScroll}
            contentContainerStyle={styles.scheduleScrollContent}
          >
            <Text style={styles.sectionTitle}>Pick date & time</Text>
            <Text style={styles.sectionBody}>
              Calendar is in India (IST). Past dates cannot be selected. After 7:00 PM IST, same-day booking closes and the
              first open slots start the next afternoon.
            </Text>
            {isEveningBookingCutoff(scheduleAnchor) ? (
              <View style={styles.ruleBanner}>
                <Card variant="muted" padded>
                  <Text style={styles.ruleBannerText}>
                    It&apos;s after 7 PM IST - same-day booking isn&apos;t offered; afternoon slots apply on your first
                    selectable day.
                  </Text>
                </Card>
              </View>
            ) : null}

            <View style={styles.calNavRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !canPrevCalendarMonth }}
                onPress={goPrevCalendarMonth}
                disabled={!canPrevCalendarMonth}
                style={[styles.calNavBtn, !canPrevCalendarMonth && styles.calNavBtnDisabled]}
              >
                <Text style={styles.calNavBtnText}>‹</Text>
              </Pressable>
              <Text style={styles.calMonthTitle}>{formatMonthNavTitle(calendarMonth.y, calendarMonth.m)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !canNextCalendarMonth }}
                onPress={goNextCalendarMonth}
                disabled={!canNextCalendarMonth}
                style={[styles.calNavBtn, !canNextCalendarMonth && styles.calNavBtnDisabled]}
              >
                <Text style={styles.calNavBtnText}>›</Text>
              </Pressable>
            </View>

            <View style={styles.calWeekdayRow}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
                <Text key={w} style={styles.calWeekdayLabel}>
                  {w}
                </Text>
              ))}
            </View>

            {calendarRows.map((row, ri) => (
              <View key={`cal-r-${ri}`} style={styles.calWeekRow}>
                {row.map((cell, ci) => {
                  if (!cell.dayKey) {
                    return <View key={`cal-e-${ri}-${ci}`} style={styles.calDayCell} />;
                  }
                  const dk = cell.dayKey;
                  const selectable = selectableDayKeySet.has(dk);
                  const selected = dayKey === dk;
                  const isToday = dk === istTodayDayKey;
                  return (
                    <Pressable
                      key={dk}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: !selectable }}
                      onPress={() => {
                        if (!selectable) return;
                        setDayKey(dk);
                      }}
                      style={[
                        styles.calDayCell,
                        selected && styles.calDayCellSelected,
                        isToday && !selected && styles.calDayCellToday,
                        !selectable && styles.calDayCellDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.calDayNum,
                          selected && styles.calDayNumSelected,
                          !selectable && styles.calDayNumDisabled,
                        ]}
                      >
                        {Number(dk.split("-")[2])}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            <Text style={styles.slotsSectionTitle}>Available slots</Text>
            <Text style={styles.slotsSectionHint}>
              {vendorPick.mode === "preferred" && vendorId
                ? "Times reflect this partner’s saved availability and capacity."
                : "Standard visit windows (2 hours) - a partner will be assigned from the pool."}
            </Text>

            {!dayKey ? (
              <Card variant="muted" padded>
                <Text style={styles.muted}>Select a date to see times.</Text>
              </Card>
            ) : vendorPick.mode === "preferred" && vendorId && (slotBookabilityQuery.isPending || slotBookabilityQuery.isFetching) ? (
              <View style={styles.slotsLoadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.muted}>Loading slots…</Text>
              </View>
            ) : filteredSlotOptions.length === 0 ? (
              <Card variant="muted" padded>
                <Text style={styles.muted}>
                  {vendorPick.mode === "preferred" && vendorId
                    ? "No open slots from this partner on this day - try another date."
                    : "No slots left on this date - pick another day."}
                </Text>
              </Card>
            ) : (
              <View style={styles.slotChipGrid}>
                {filteredSlotOptions.map((s) => {
                  const sel = slot?.id === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: sel }}
                      onPress={() => setSlot(s)}
                      style={[
                        styles.slotChip,
                        { width: slotChipWidth },
                        sel && styles.slotChipSelected,
                      ]}
                    >
                      <Text style={[styles.slotChipLabel, sel && styles.slotChipLabelSelected]}>
                        {formatSlotChipStart(s.scheduledStart)}
                      </Text>
                      <Text style={[styles.slotChipSub, sel && styles.slotChipSubSelected]} numberOfLines={1}>
                        2h · IST
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        ) : null}

        {step === 2 ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.confirmScroll}
          >
            <Text style={styles.sectionTitle}>Review & confirm</Text>
            <Text style={styles.sectionBody}>
              {bookingPlanMode === "amc"
                ? "Review who will receive your visit and your AMC details, then confirm."
                : "Review your visit details and price estimate, then continue to payment."}
            </Text>

            {routingPreview?.ok === false ? (
              <View style={styles.routingErrorWrap}>
                <Card variant="muted" padded>
                  <Text style={styles.routingErrorTitle}>No partner available for this address</Text>
                  <Text style={styles.routingErrorBody}>
                    Update your saved service address, choose another partner here, or set your default partners in
                    Profile - Preferred partners - then try again.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push("/preferred-partner")}
                    style={({ pressed }) => [styles.partnersLink, pressed && styles.partnersLinkPressed]}
                  >
                    <Text style={styles.partnersLinkText}>Open Preferred partners</Text>
                  </Pressable>
                </Card>
              </View>
            ) : null}

            {bookingPlanMode === "one_time" && scheduleComplete && !solarSizing.ready ? (
              <View style={styles.pricingErrorWrap}>
                <Card variant="elevated" padded>
                  <Text style={styles.routingHeading}>Solar site details required</Text>
                  <Text style={styles.slaNoteText}>
                    {solarSizing.reason === "missing_details"
                      ? "Add installed capacity and panel count under Solar & site in Profile, then save. One-time pricing uses the same details as AMC."
                      : `Your saved size is ${solarSizing.capacityKw} kW. We price 3, 4, 5, 6, 8, 9, and 10 kW systems - update Profile to a supported band.`}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push("/(main)/profile")}
                    style={({ pressed }) => [styles.partnersLink, pressed && styles.partnersLinkPressed]}
                  >
                    <Text style={styles.partnersLinkText}>Open Profile</Text>
                  </Pressable>
                </Card>
              </View>
            ) : bookingPlanMode === "one_time" && scheduleComplete ? (
              pricingQuery.isPending ? (
                <View style={styles.pricingLoading}>
                  <Card variant="muted" padded>
                    <SkeletonBar variant="dense" />
                    <View style={styles.gapSm} />
                    <SkeletonBar variant="full" />
                    <View style={styles.gapSm} />
                    <SkeletonBar variant="short" />
                  </Card>
                  <Text style={styles.pricingLoadingCaption}>Loading your price estimate…</Text>
                </View>
              ) : pricingQuery.isError ? (
                <View style={styles.pricingErrorWrap}>
                  <ErrorStateCard
                    title="Couldn't load pricing"
                    message={(pricingQuery.error as Error).message}
                    onRetry={() => void pricingQuery.refetch()}
                  />
                </View>
              ) : pricingQuery.data ? (
                <>
                  <CapacityVisitPricingCard
                    tierLabel={pricingQuery.data.quote.tier_label}
                    capacityKw={pricingQuery.data.quote.capacity_kw}
                    typicalPanels={pricingQuery.data.quote.typical_panel_count}
                    cataloguePaise={pricingQuery.data.quote.catalogue_visit_cents}
                    geoAddonPaise={pricingQuery.data.quote.geo_visit_addon_cents}
                    amountPaise={pricingQuery.data.quote.amount_cents}
                    perPanelPaise={pricingQuery.data.quote.per_panel_rate_cents}
                  />
                  {creditsDiscountPaise > 0 ? (
                    <View style={styles.slaNote}>
                      <Card variant="muted" padded>
                        <Text style={styles.slaNoteText}>
                          OorjaMan Credits applied: {creditsRedemptionPlan.discount_credits} credit
                          {creditsRedemptionPlan.discount_credits === 1 ? "" : "s"} (
                          {formatInrFromCents(creditsDiscountPaise)} off).
                        </Text>
                      </Card>
                    </View>
                  ) : null}
                  {availableCompensation && compensationDiscountPaise > 0 ? (
                    <View style={styles.slaNote}>
                      <Card variant="muted" padded>
                        <Text style={styles.slaNoteText}>
                          Promo applied ({availableCompensation.couponCode}):{" "}
                          {formatInrFromCents(compensationDiscountPaise)} off this booking.
                        </Text>
                      </Card>
                    </View>
                  ) : null}
                </>
              ) : null
            ) : null}

            {routingPreview?.ok ? (
              <View style={styles.routingBlock}>
                <Text style={styles.routingHeading}>Who will get your visit</Text>
                <Card variant="elevated" padded>
                  <Text style={styles.routingExplain}>{describeRoutingForCustomer(routingPreview)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push("/preferred-partner")}
                    style={({ pressed }) => [styles.partnersLink, pressed && styles.partnersLinkPressed]}
                  >
                    <Text style={styles.partnersLinkText}>Preferred partners in Profile</Text>
                  </Pressable>
                </Card>
              </View>
            ) : null}

            {bookingPlanMode === "one_time" ? (
              <View style={styles.slaNote}>
                <Card variant="muted" padded>
                  <Text style={styles.slaNoteText}>
                    After payment, OorjaMan assigns your service partner. Once assigned, they confirm your slot - check My
                    bookings for updates.
                  </Text>
                </Card>
              </View>
            ) : (
              <View style={styles.slaNote}>
                <Card variant="muted" padded>
                  <Text style={styles.slaNoteText}>
                    This visit uses your AMC entitlement. No checkout charge is needed for this booking.
                  </Text>
                </Card>
              </View>
            )}

            <View style={styles.summary}>
              <Text style={styles.summaryHeading}>Visit summary</Text>
              <Card variant="elevated" padded>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryEm}>Partner: </Text>
                  {vendorPick.mode === "any"
                    ? "OorjaMan will assign a partner for your area"
                    : routingPreview?.ok
                      ? routingPreview.resolvedName
                      : (selectedVendor?.business_name ?? "-")}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryEm}>When: </Text>
                  {slot?.label ?? "-"}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryEm}>Status: </Text>
                  {vendorPick.mode === "any" ? "Awaiting partner assignment" : "Pending partner confirmation"}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryEm}>Plan: </Text>
                  {bookingPlanMode === "amc" ? "AMC visit" : "One-time booking"}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryEm}>Service for: </Text>
                  {bookingFor === "self"
                    ? "Myself"
                    : `${recipientName.trim() || "Recipient"}${recipientRelation.trim() ? ` (${recipientRelation.trim()})` : ""}`}
                </Text>
              </Card>
            </View>
            <View style={styles.recipientBlock}>
              <Text style={styles.summaryHeading}>Who is this booking for?</Text>
              <View style={styles.recipientToggleRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setBookingFor("self")}
                  style={[styles.recipientToggle, bookingFor === "self" && styles.recipientToggleOn]}
                >
                  <Text style={[styles.recipientToggleText, bookingFor === "self" && styles.recipientToggleTextOn]}>
                    Myself
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setBookingFor("other")}
                  style={[styles.recipientToggle, bookingFor === "other" && styles.recipientToggleOn]}
                >
                  <Text style={[styles.recipientToggleText, bookingFor === "other" && styles.recipientToggleTextOn]}>
                    Someone else
                  </Text>
                </Pressable>
              </View>
              {bookingFor === "other" ? (
                <View>
                  <Input
                    label="Recipient name"
                    placeholder="Name of on-site contact"
                    value={recipientName}
                    onChangeText={setRecipientName}
                  />
                  <View style={styles.gapSm} />
                  <Input
                    label="Recipient phone"
                    placeholder="+91XXXXXXXXXX"
                    value={recipientPhone}
                    onChangeText={setRecipientPhone}
                  />
                  <View style={styles.gapSm} />
                  <Input
                    label="Alternate phone (optional)"
                    placeholder="+91XXXXXXXXXX"
                    value={recipientAltPhone}
                    onChangeText={setRecipientAltPhone}
                  />
                  <View style={styles.gapSm} />
                  <Input
                    label="Relationship (optional)"
                    placeholder="Parent, tenant, office staff..."
                    value={recipientRelation}
                    onChangeText={setRecipientRelation}
                  />
                </View>
              ) : null}
            </View>
            <Input
              label="Service site address"
              placeholder="Where should the crew attend?"
              value={address}
              onChangeText={setAddress}
              multiline
            />
            <View style={styles.gapSm} />
            <Button variant="outline" size="sm" onPress={() => setAddressPickerOpen(true)}>
              Choose saved address
            </Button>
            {addressBook.defaultId ? (
              <Text style={styles.addressHint}>
                Selected:{" "}
                {(() => {
                  const e = addressBook.entries.find((x) => x.id === addressBook.defaultId);
                  if (!e) return "";
                  const body = serviceAddressFormatted(e.address);
                  return e.label.trim() ? `${e.label} - ${body}` : body;
                })()}
              </Text>
            ) : null}
            <View style={styles.gapSm} />
            <Input label="Notes (optional)" placeholder="Gate codes, panels location…" value={notes} onChangeText={setNotes} />
            {confirmAmcVisitMut.isError ? (
              <Text style={styles.error}>{(confirmAmcVisitMut.error as Error).message}</Text>
            ) : null}
          </ScrollView>
        ) : null}

        {step === 3 && bookingPlanMode === "one_time" ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.confirmScroll}
          >
            <Text style={styles.sectionTitle}>Test payment</Text>
            <Text style={styles.sectionBody}>
              Dummy checkout - no real charge. Pick an outcome to finish your booking request.
            </Text>

            <View style={styles.slaNote}>
              <Card variant="muted" padded>
                <Text style={styles.slaNoteText}>
                  Once this completes, the assigned partner has about one hour to confirm your slot (see My bookings for
                  status).
                </Text>
              </Card>
            </View>

            {pricingQuery.data ? (
              <View style={styles.paymentAmountWrap}>
                <Card variant="elevated" padded>
                  <Text style={styles.paymentAmountLabel}>Amount due</Text>
                  <Text style={styles.paymentAmountValue}>
                    {formatInrFromCents(payableEstimatePaise)}
                  </Text>
                  <PriceGstBreakdown totalPaise={payableEstimatePaise} />
                  {creditsDiscountPaise > 0 ? (
                    <Text style={styles.paymentAmountLabel}>
                      Includes {creditsRedemptionPlan.discount_credits} OorjaMan Credit
                      {creditsRedemptionPlan.discount_credits === 1 ? "" : "s"} (
                      {formatInrFromCents(creditsDiscountPaise)})
                    </Text>
                  ) : null}
                  {compensationDiscountPaise > 0 ? (
                    <Text style={styles.paymentAmountLabel}>
                      Includes promo discount {formatInrFromCents(compensationDiscountPaise)}
                    </Text>
                  ) : null}
                </Card>
              </View>
            ) : null}

            {paymentSessionError ? (
              <View style={styles.pricingErrorWrap}>
                <ErrorStateCard
                  title="Couldn't start payment"
                  message={paymentSessionError}
                  onRetry={() => {
                    setPendingPaymentId(null);
                    setPaymentSessionError(null);
                  }}
                />
              </View>
            ) : null}

            {paymentFailedBanner ? (
              <View style={styles.failBanner}>
                <Card variant="muted" padded>
                  <Text style={styles.failBannerTitle}>Payment failed</Text>
                  <Text style={styles.failBannerBody}>
                    This was a simulated decline. A new payment session will load automatically - try Pay Now (Success) when
                    you&apos;re ready.
                  </Text>
                </Card>
              </View>
            ) : null}

            {!paymentSessionError ? (
              <>
                <Text style={styles.paymentSimLabel}>Simulate gateway</Text>
                <View style={styles.gapSm} />
                <Button
                  variant="primary"
                  size="md"
                  loading={paySuccessMut.isPending}
                  disabled={
                    !pendingPaymentId ||
                    paySuccessMut.isPending ||
                    failPaymentMut.isPending ||
                    !!paymentSessionError
                  }
                  onPress={() => void paySuccessMut.mutate()}
                >
                  Pay Now (Success)
                </Button>
                <View style={styles.gapSm} />
                <Button
                  variant="outline"
                  size="md"
                  loading={failPaymentMut.isPending}
                  disabled={
                    !pendingPaymentId ||
                    paySuccessMut.isPending ||
                    failPaymentMut.isPending ||
                    !!paymentSessionError
                  }
                  onPress={() => void failPaymentMut.mutate()}
                >
                  Fail payment
                </Button>
              </>
            ) : null}

            {paySuccessMut.isError ? (
              <Text style={styles.error}>{(paySuccessMut.error as Error).message}</Text>
            ) : null}
          </ScrollView>
        ) : null}

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm }]}>
          {step === 3 ? (
            <>
              <View style={styles.footerBtn}>
                <Button
                  variant="outline"
                  size="md"
                  style={styles.footerBtnStretch}
                  onPress={() =>
                    void (async () => {
                      await abandonCheckoutIfNeeded();
                      setStep(2);
                    })()
                  }
                >
                  Back
                </Button>
              </View>
              <View style={styles.footerBtn} />
            </>
          ) : (
            <>
              {step > 0 ? (
                <View style={styles.footerBtn}>
                  <Button variant="outline" size="md" style={styles.footerBtnStretch} onPress={() => setStep((s) => (s - 1) as Step)}>
                    Back
                  </Button>
                </View>
              ) : (
                <View style={styles.footerBtn}>
                  <Button variant="ghost" size="md" style={styles.footerBtnStretch} onPress={() => router.back()}>
                    Cancel
                  </Button>
                </View>
              )}
              {step < 3 ? (
                <View style={styles.footerBtn}>
                  <Button
                    variant="primary"
                    size="md"
                    style={styles.footerBtnStretch}
                    disabled={
                      (step === 0 && vendorPick.mode === "preferred" && !vendorId) ||
                      (step === 1 && (!dayKey || !slot)) ||
                      (step === 2 &&
                        ((bookingPlanMode === "one_time" &&
                          (pricingQuery.isPending ||
                            pricingQuery.isError ||
                            !pricingQuery.data)) ||
                          (bookingFor === "other" &&
                            (!recipientName.trim() || recipientPhone.trim().length < 8)) ||
                          customerQuery.isPending ||
                          routingDefaultsQuery.isPending ||
                          (vendorPick.mode === "preferred" && routingPreview?.ok === false) ||
                          confirmAmcVisitMut.isPending))
                    }
                    onPress={() => {
                      if (step === 2 && bookingPlanMode === "amc") {
                        void confirmAmcVisitMut.mutateAsync();
                        return;
                      }
                      setStep((s) => (s + 1) as Step);
                    }}
                  >
                    {step === 2
                      ? bookingPlanMode === "amc"
                        ? "Confirm AMC visit"
                        : "Continue to payment"
                      : "Continue"}
                  </Button>
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>
      <ServiceAddressPickerSheet
        visible={addressPickerOpen}
        entries={addressBook.entries}
        defaultId={addressBook.defaultId}
        onClose={() => setAddressPickerOpen(false)}
        onSave={async (entries, defaultId, extras) => {
          const selected = defaultId ? entries.find((e) => e.id === defaultId) ?? null : entries[0] ?? null;
          if (selected) {
            const body = serviceAddressFormatted(selected.address);
            setAddress(selected.label.trim() ? `${selected.label}\n${body}` : body);
            setSelectedServiceAddressId(selected.id);
          }
          await addressBookMut.mutateAsync({ entries, defaultId, extras });
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    flex: 1,
    ...modalScrollContentStyle,
    paddingBottom: spacing.md,
  },
  stepHint: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  sectionBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  coverageHint: {
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  ruleBanner: {
    marginBottom: spacing.md,
  },
  ruleBannerText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.foreground,
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
  error: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.destructive,
  },
  skelGap: {
    marginBottom: spacing.sm,
  },
  gapSm: {
    height: spacing.sm,
  },
  vendorList: {
    flex: 1,
  },
  vendorScrollContent: {
    paddingBottom: spacing.md,
  },
  vendorOptionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  vendorOptionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  vendorRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  vendorRadioOn: {
    borderColor: colors.primary,
  },
  vendorRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  vendorOptionBody: {
    flex: 1,
    minWidth: 0,
  },
  vendorOptionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  preferredBadgeTiny: {
    fontFamily: fontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.primary,
  },
  vendorTradeSmall: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  vendorMetaSmall: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  mutedSmall: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  warnMuted: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.destructive,
  },
  vendorName: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    color: colors.foreground,
  },
  dayScroll: {
    marginBottom: spacing.md,
    flexGrow: 0,
  },
  dayChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.muted,
    marginRight: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dayChipSelected: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  dayChipText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  dayChipTextSelected: {
    color: colors.foreground,
  },
  scheduleScroll: {
    flex: 1,
  },
  scheduleScrollContent: {
    paddingBottom: spacing.xl,
  },
  calNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  calNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  calNavBtnDisabled: {
    opacity: 0.35,
  },
  calNavBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xl,
    color: colors.foreground,
    marginTop: -2,
  },
  calMonthTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  calWeekdayRow: {
    flexDirection: "row",
    marginBottom: spacing.xs,
  },
  calWeekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  calWeekRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  calDayCell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    margin: 2,
    borderRadius: 10,
  },
  calDayCellSelected: {
    backgroundColor: colors.primary,
  },
  calDayCellToday: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  calDayCellDisabled: {
    opacity: 0.35,
  },
  calDayNum: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  calDayNumSelected: {
    color: colors.primaryForeground,
  },
  calDayNumDisabled: {
    color: colors.mutedForeground,
  },
  slotsSectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  slotsSectionHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  slotsLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  slotChipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "flex-start",
  },
  slotChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 12,
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 0,
  },
  slotChipSelected: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  slotChipLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
    textAlign: "center",
  },
  slotChipLabelSelected: {
    color: colors.foreground,
  },
  slotChipSub: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    textAlign: "center",
    marginTop: 2,
  },
  slotChipSubSelected: {
    color: colors.mutedForeground,
  },
  slotScroll: {
    maxHeight: 360,
  },
  slotPress: {
    marginBottom: spacing.sm,
    borderRadius: 14,
  },
  slotOutline: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  slotOutlineSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  slotLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  confirmScroll: {
    flex: 1,
  },
  routingErrorWrap: {
    marginBottom: spacing.md,
  },
  routingErrorTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.destructive,
    marginBottom: spacing.xs,
  },
  routingErrorBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  routingBlock: {
    marginBottom: spacing.md,
  },
  routingHeading: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  routingExplain: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  partnersLink: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  partnersLinkPressed: {
    opacity: 0.85,
  },
  partnersLinkText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.primary,
  },
  slaNote: {
    marginBottom: spacing.md,
  },
  slaNoteText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.foreground,
  },
  summary: {
    marginBottom: spacing.md,
  },
  recipientBlock: {
    marginBottom: spacing.md,
  },
  recipientToggleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  recipientToggle: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    alignItems: "center",
    backgroundColor: colors.background,
  },
  recipientToggleOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  recipientToggleText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  recipientToggleTextOn: {
    color: colors.primary,
  },
  summaryHeading: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  addressHint: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  pricingLoading: {
    marginBottom: spacing.md,
  },
  pricingLoadingCaption: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  pricingErrorWrap: {
    marginBottom: spacing.md,
  },
  paymentAmountWrap: {
    marginBottom: spacing.md,
  },
  paymentAmountLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  paymentAmountValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxl,
    color: colors.foreground,
  },
  paymentSimLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
    marginTop: spacing.sm,
  },
  failBanner: {
    marginBottom: spacing.md,
  },
  failBannerTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  failBannerBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  summaryLine: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  summaryEm: {
    fontFamily: fontFamily.semiBold,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: "auto",
    paddingTop: spacing.lg,
    alignItems: "stretch",
  },
  footerBtn: {
    flex: 1,
    minWidth: 0,
  },
  footerBtnStretch: {
    alignSelf: "stretch",
    width: "100%",
  },
});