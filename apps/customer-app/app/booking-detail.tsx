import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  bookingApi,
  isBookingGpsTrackable,
  customerBookingDisplayTitle,
  customerBookingRefModalSubtitle,
  customerBookingVisitDateVisible,
  formatInrFromCents,
  INDIAN_GST_RATE_PERCENT,
  splitGstFromInclusiveTotal,
  isAmcSubscriptionBooking,
  getBookingRoutingDefaults,
  HAPPY_CODE_REGENERATE_COOLDOWN_MS,
  customerCancellationDeadline,
  customerCancellationPenaltyEligible,
  customerApi,
  isWithinCustomerCancellationWindow,
  isWithinVendorResponseWindow,
  paymentApi,
  queryKeys,
  readBookingCustomerCancellationMeta,
  readBookingOpsMeta,
  readBookingRecipientMeta,
  readBookingVendorReassignmentMeta,
  technicianApi,
  userApi,
  vendorResponseDeadline,
} from "@oorjaman/api";
import type { BookingStatus, BookingRow, CustomerRow } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { bookingStatusLabel, bookingUiBucket } from "../lib/booking-status";
import {
  Button,
  Card,
  EmptyStateCard,
  ErrorStateCard,
  FadeInView,
  ModalSheetHeader,
  modalBodyInsetStyle,
  modalScrollContentStyle,
  Screen,
  SCREEN_EDGES_BENEATH_NATIVE_HEADER,
  SkeletonStack,
  useModalStackHeader,
} from "@oorjaman/ui";
import { fontFamily, fontSize, fontWeight } from "../constants/fonts";
import { bookingSupportMailto } from "../lib/support";
import {
  customerConfirmedBookingStatusHelp,
  isBookingAwaitingOorjamanPartnerAssignment,
} from "../lib/booking-partner-messaging";
import { AssignedTechnicianCard } from "../components/assigned-technician-card";
import { supabase } from "../lib/supabase";
import {
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayDateTimeRange,
} from "@oorjaman/utils";

function formatRange(startIso: string, endIso: string): string {
  return formatDisplayDateTimeRange(startIso, endIso);
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency}`;
  }
}

function formatPaymentDisplayTimestamp(iso: string): string {
  return formatDisplayDateTime(iso);
}

function normalizePaymentChannelLabel(raw: string | null | undefined): string {
  if (!raw?.trim()) return "Digital payment";
  const t = raw.trim();
  const lower = t.toLowerCase();
  if (lower === "upi") return "UPI";
  if (lower === "netbanking" || lower === "net banking") return "Net banking";
  if (lower === "wallet") return "Wallet";
  if (lower === "credit card") return "Credit card";
  if (lower === "debit card") return "Debit card";
  if (lower === "credit or debit card") return "Credit or debit card";
  return t;
}

function buildServiceTaxInvoiceText(b: BookingRow): string {
  const amountCents =
    b.final_price_cents != null ? b.final_price_cents : b.estimated_price_cents;
  const money = formatMoney(amountCents, b.currency);
  const gst = splitGstFromInclusiveTotal(amountCents);
  const visitEnd = b.actual_end ?? b.scheduled_end;
  const visitWhen = formatDisplayDate(visitEnd);
  const bookingLabel = customerBookingDisplayTitle(b);
  return [
    "Oorjaman - Service receipt (tax invoice summary)",
    `Booking: ${bookingLabel}`,
    `Service date: ${visitWhen}`,
    `Service value: ${formatInrFromCents(gst.taxable_value_cents)}`,
    `GST (${INDIAN_GST_RATE_PERCENT}%): ${formatInrFromCents(gst.gst_cents)}`,
    `Total (incl. GST): ${money}`,
    "",
    "Retain this for your records. For a GST-compliant invoice with IRN, email support if your organisation needs it.",
  ].join("\n");
}

function stringifyAddress(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "string") return value || "-";
  if (typeof value === "object" && value !== null && "formatted" in value) {
    const f = (value as { formatted?: unknown }).formatted;
    if (typeof f === "string" && f.trim()) return f;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatInstallDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(iso));
  } catch {
    return null;
  }
}

function roofMaterialLabel(m: CustomerRow["solar_roof_material"]): string | null {
  if (!m) return null;
  const labels: Record<NonNullable<CustomerRow["solar_roof_material"]>, string> = {
    tin_metal: "Tin / metal",
    rcc: "RCC",
    mixed: "Mixed structure",
    other: "Other",
  };
  return labels[m] ?? m;
}

function hasInstallationProfile(c: CustomerRow): boolean {
  if (
    c.solar_capacity_kw != null ||
    c.solar_panel_count != null ||
    c.installation_category != null ||
    (typeof c.solar_roof_type === "string" && c.solar_roof_type.trim() !== "") ||
    c.solar_roof_material != null ||
    c.last_cleaning_at != null ||
    (typeof c.safety_roof_access === "string" && c.safety_roof_access.trim() !== "") ||
    (typeof c.safety_water_availability === "string" && c.safety_water_availability.trim() !== "") ||
    (typeof c.safety_hazards === "string" && c.safety_hazards.trim() !== "")
  ) {
    return true;
  }
  const m = c.metadata;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    const enr = (m as Record<string, unknown>).installation_enrichment;
    if (enr && typeof enr === "object" && !Array.isArray(enr)) {
      const e = enr as Record<string, unknown>;
      if (typeof e.panel_brand === "string" && e.panel_brand.trim()) return true;
      if (typeof e.inverter_brand === "string" && e.inverter_brand.trim()) return true;
      if (typeof e.epc_vendor_name === "string" && e.epc_vendor_name.trim()) return true;
    }
  }
  return false;
}

function DetailChip({ row }: { row: BookingRow }) {
  if (!row?.status) return null;
  const bucket = bookingUiBucket(row.status);
  const label = bookingStatusLabel(row.status, row);
  const chipStyles =
    bucket === "pending"
      ? styles.chipPending
      : bucket === "accepted"
        ? styles.chipAccepted
        : bucket === "completed"
          ? styles.chipCompleted
          : styles.chipEnded;

  return (
    <View style={[styles.chip, chipStyles]}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Card variant="elevated" padded>
        <Text style={styles.sectionTitle}>{title}</Text>
        {children}
      </Card>
    </View>
  );
}

function serviceForDetails(metadata: unknown): { name: string; extra?: string } {
  const rec = readBookingRecipientMeta(metadata as never);
  if (!rec || rec.is_self) return { name: "Myself" };
  const name = rec.recipient_name?.trim() || "Someone else";
  const parts = [rec.relationship, rec.recipient_phone].filter(Boolean).join(" · ");
  return { name, extra: parts || undefined };
}

function bookingShowsTechnicianProfile(row: BookingRow | null | undefined): boolean {
  return Boolean(row?.technician_id && row.status !== "cancelled" && row.status !== "pending_payment");
}

const CUSTOMER_CANCELLABLE: BookingStatus[] = ["pending_payment", "confirmed", "accepted"];

export default function BookingDetailScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const bookingId = Array.isArray(id) ? id[0] : id;

  const userQuery = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => userApi.getMyUserRecord(supabase!),
    enabled: Boolean(supabase),
  });

  const query = useQuery({
    queryKey: bookingId ? queryKeys.bookings.detail(bookingId) : [],
    queryFn: () => bookingApi.getBookingById(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId),
  });

  const navTitle = query.data ? customerBookingDisplayTitle(query.data) : "Booking";
  const modalHeader = useModalStackHeader({
    title: navTitle,
    subtitle: query.data ? customerBookingRefModalSubtitle(query.data) : undefined,
    onClose: () => router.back(),
    closeAccessibilityLabel: "Close booking details",
  });

  const paymentsQuery = useQuery({
    queryKey: bookingId ? queryKeys.payments.forBooking(bookingId) : [],
    queryFn: () => paymentApi.listPaymentsForBooking(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId && query.data),
  });

  const b = query.data;
  const successPayment = useMemo(() => {
    const rows = paymentsQuery.data ?? [];
    return rows.find((p) => p.status === "success") ?? null;
  }, [paymentsQuery.data]);
  const serviceOtp = b ? bookingApi.readBookingServiceOtpMeta(b.metadata) : null;
  const serviceFor = b ? serviceForDetails(b.metadata) : null;
  const opsMeta = b ? readBookingOpsMeta(b.metadata) : null;
  const vendorReassignMeta = b ? readBookingVendorReassignmentMeta(b.metadata) : null;

  const customerQuery = useQuery({
    queryKey: queryKeys.customers.mine(),
    queryFn: () => customerApi.getMyCustomer(supabase!),
    enabled: Boolean(supabase && bookingId && query.data),
  });
  const reportQuery = useQuery({
    queryKey: bookingId ? queryKeys.jobReports.byBooking(bookingId) : [],
    queryFn: () => technicianApi.getJobReportByBookingId(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId && b?.status === "completed"),
  });
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingNote, setRatingNote] = useState("");
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  useEffect(() => {
    if (!reportQuery.data) return;
    setRatingValue(Math.max(0, Math.round(Number(reportQuery.data.customer_rating ?? 0))));
    setRatingNote(reportQuery.data.customer_feedback ?? "");
  }, [reportQuery.data?.id, reportQuery.data?.customer_rating, reportQuery.data?.customer_feedback]);
  const saveRatingMut = useMutation({
    mutationFn: async () => {
      if (!bookingId || ratingValue < 1 || ratingValue > 5) throw new Error("Select a rating from 1 to 5.");
      return technicianApi.customerUpdateJobReportFeedback(supabase!, bookingId, {
        customer_rating: ratingValue,
        customer_feedback: ratingNote.trim() || null,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.jobReports.byBooking(bookingId!) });
      Alert.alert("Thanks!", "Your rating was submitted.");
    },
    onError: (e: unknown) => {
      Alert.alert("Could not submit rating", e instanceof Error ? e.message : "Please try again.");
    },
  });
  const regenHappyCodeMut = useMutation({
    mutationFn: async () => {
      if (!bookingId) throw new Error("Booking missing.");
      return bookingApi.customerRegenerateBookingHappyCode(supabase!, bookingId);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId!) });
      Alert.alert("Happy Code updated", "Share the new Happy Code with the technician at completion.");
    },
    onError: (e: unknown) => {
      Alert.alert("Could not regenerate", e instanceof Error ? e.message : "Please try again.");
    },
  });

  const installationRows = useMemo(() => {
    if (!b) return null;
    const c = customerQuery.data;
    if (!c || c.id !== b.customer_id || !hasInstallationProfile(c)) return null;
    const rows: { key: string; label: string; value: string }[] = [];
    if (c.installation_category) {
      rows.push({
        key: "cat",
        label: "Installation type",
        value: c.installation_category === "residential" ? "Residential" : "Commercial",
      });
    }
    if (c.solar_capacity_kw != null) {
      rows.push({ key: "cap", label: "System size", value: `${c.solar_capacity_kw} kW` });
    }
    if (c.solar_panel_count != null) {
      rows.push({ key: "panels", label: "Panel count", value: String(c.solar_panel_count) });
    }
    const mat = roofMaterialLabel(c.solar_roof_material);
    if (mat) rows.push({ key: "mat", label: "Roof structure", value: mat });
    if (c.solar_roof_type?.trim()) {
      rows.push({ key: "roof", label: "Roof / site notes", value: c.solar_roof_type.trim() });
    }
    const cleaned = formatInstallDate(c.last_cleaning_at);
    if (cleaned) rows.push({ key: "clean", label: "Last cleaning", value: cleaned });
    if (c.safety_roof_access?.trim()) {
      rows.push({ key: "acc", label: "Roof access", value: c.safety_roof_access.trim() });
    }
    if (c.safety_water_availability?.trim()) {
      rows.push({ key: "water", label: "Water near panels", value: c.safety_water_availability.trim() });
    }
    if (c.safety_hazards?.trim()) {
      rows.push({ key: "haz", label: "Hazards / electrical", value: c.safety_hazards.trim() });
    }
    const meta = c.metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      const enr = (meta as Record<string, unknown>).installation_enrichment;
      if (enr && typeof enr === "object" && !Array.isArray(enr)) {
        const e = enr as Record<string, unknown>;
        if (typeof e.panel_brand === "string" && e.panel_brand.trim()) {
          rows.push({ key: "pbrand", label: "Panel brand", value: e.panel_brand.trim() });
        }
        if (typeof e.inverter_brand === "string" && e.inverter_brand.trim()) {
          rows.push({ key: "ibrand", label: "Inverter brand", value: e.inverter_brand.trim() });
        }
        if (typeof e.epc_vendor_name === "string" && e.epc_vendor_name.trim()) {
          rows.push({ key: "epc", label: "Original installer / EPC", value: e.epc_vendor_name.trim() });
        }
      }
    }
    return rows.length > 0 ? rows : null;
  }, [b, customerQuery.data]);

  const cancelMut = useMutation({
    mutationFn: async (vars: { reason: string; acceptLateCancellationFee: boolean }) => {
      if (!supabase || !bookingId) throw new Error("Missing session or booking.");
      return bookingApi.customerCancelBooking(supabase, bookingId, {
        reason: vars.reason.trim(),
        acceptLateCancellationFee: vars.acceptLateCancellationFee ? true : undefined,
      });
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
      if (bookingId) {
        await qc.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) });
      }
      const cc = readBookingCustomerCancellationMeta(data.metadata);
      const feeSentence =
        cc && !cc.withinGraceWindow && cc.lateFeePaise > 0
          ? ` A late cancellation of up to ${formatInrFromCents(cc.lateFeePaise)} was recorded - final charges or refunds follow OorjaMan policy.`
          : "";
      Alert.alert("Booking cancelled", `We’ve recorded your cancellation.${feeSentence}`);
      setCancelModalOpen(false);
      setCancelReason("");
    },
    onError: (e: unknown) => {
      Alert.alert("Could not cancel", e instanceof Error ? e.message : "Try again or contact support.");
    },
  });

  const routingDefaultsQuery = useQuery({
    queryKey: queryKeys.platform.settings(),
    queryFn: () => getBookingRoutingDefaults(supabase!),
    enabled: Boolean(supabase && b && CUSTOMER_CANCELLABLE.includes(b.status)),
  });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const statusHelp = useMemo(() => {
    if (!b) return "";
    const bucket = bookingUiBucket(b.status);
    if (b.status === "confirmed") {
      const confirmedHelp = customerConfirmedBookingStatusHelp(b);
      if (confirmedHelp) return confirmedHelp;
    }
    if (bucket === "pending") {
      if (b.status === "pending_payment") {
        return "Complete payment to confirm your visit request.";
      }
      return "We’ve notified your service partner - they’ll confirm when ready.";
    }
    if (bucket === "accepted") {
      if (b.status === "in_progress") return "Your technician is on site and working on your visit.";
      if (b.technician_en_route_at) return "Your technician is on the way. Open the map below to track their trip.";
      if (b.technician_id) return "Your technician is assigned. You will see their details here when they head to your site.";
      return "Your slot is locked in - watch here for technician assignment and arrival.";
    }
    if (bucket === "completed") return "Visit finished - thanks for choosing OorjaMan.";
    if (b.status === "cancelled") return "This booking was cancelled.";
    return "";
  }, [b]);

  const showTrack = Boolean(b && isBookingGpsTrackable(b));
  const showTechnicianProfile = bookingShowsTechnicianProfile(b);

  const vendorSla = useMemo(() => {
    if (!b || b.status !== "confirmed") return null;
    if (isBookingAwaitingOorjamanPartnerAssignment(b)) return null;
    const deadline = vendorResponseDeadline(b);
    const within = isWithinVendorResponseWindow(b);
    try {
      const end = new Intl.DateTimeFormat("en-IN", {
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }).format(deadline);
      const remainingMs = Math.max(0, deadline.getTime() - Date.now());
      const remMin = Math.ceil(remainingMs / 60_000);
      return { end, within, remainingMs, remMin };
    } catch {
      return null;
    }
  }, [b, tick]);

  const showVisitCode =
    Boolean(serviceOtp?.startCode) &&
    Boolean(b?.status && ["accepted", "in_progress", "completed"].includes(b.status));
  const showHappyCode =
    Boolean(serviceOtp?.happyCode) &&
    Boolean(b?.status && ["in_progress", "completed"].includes(b.status));

  const cancelSla = useMemo(() => {
    if (!b || !CUSTOMER_CANCELLABLE.includes(b.status)) return null;
    const penaltyEligible = customerCancellationPenaltyEligible(b);
    if (!penaltyEligible) {
      return { within: true, end: null as string | null, remMin: 0, penaltyEligible: false };
    }
    const deadline = customerCancellationDeadline(b);
    const within = isWithinCustomerCancellationWindow(b);
    const remainingMs = Math.max(0, deadline.getTime() - Date.now());
    const remMin = Math.ceil(remainingMs / 60_000);
    try {
      const end = new Intl.DateTimeFormat("en-IN", {
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }).format(deadline);
      return { within, end, remMin, penaltyEligible: true };
    } catch {
      return { within, end: null as string | null, remMin, penaltyEligible: true };
    }
  }, [b, tick]);

  const hasSubmittedRating = (reportQuery.data?.customer_rating ?? 0) >= 1;

  const openSupport = () => {
    const url = bookingSupportMailto({
      referenceCode: b?.reference_code ?? undefined,
      topic: "Help with my Oorjaman booking",
    });
    void Linking.openURL(url).catch(() =>
      Alert.alert("Email app", "No mail app available - reach us at the address shown on our website."),
    );
  };

  if (!supabase || !bookingId) {
    return (
      <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <View style={modalBodyInsetStyle}>
          <Text style={styles.muted}>Missing booking or Supabase configuration.</Text>
        </View>
      </Screen>
    );
  }

  if (userQuery.isPending) {
    return (
      <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <View style={modalBodyInsetStyle}>
          <Card variant="muted" padded>
            <SkeletonStack rows={6} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (query.isPending) {
    return (
      <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <View style={modalBodyInsetStyle}>
          <Card variant="muted" padded>
            <SkeletonStack rows={6} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <View style={modalBodyInsetStyle}>
          <ErrorStateCard
            title="Couldn't load booking"
            message={(query.error as Error).message}
            onRetry={() => void query.refetch()}
            retryLabel="Retry"
          />
        </View>
      </Screen>
    );
  }

  if (!b) {
    return (
      <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <View style={modalBodyInsetStyle}>
          <EmptyStateCard
            title="Booking not found"
            description="This visit may have been removed or you don't have access. Go back to your list and try again."
          />
        </View>
      </Screen>
    );
  }

  const lateFeePaise = routingDefaultsQuery.data?.customerLateCancelFeePaise ?? 0;

  const completedInvoiceShare =
    b.status === "completed" ? (
      <View style={styles.invoiceBlock}>
        <Button
          variant="outline"
          size="md"
          accessibilityLabel="Download or share tax invoice"
          onPress={() => {
            void Share.share({
              title: `Tax invoice - ${customerBookingDisplayTitle(b)}`,
              message: buildServiceTaxInvoiceText(b),
            }).catch(() =>
              Alert.alert("Could not open share", "Try again, or copy the booking reference for your records."),
            );
          }}
        >
          Download / share tax invoice
        </Button>
        <Text style={[styles.meta, styles.invoiceHint]}>
          Opens your phone’s share sheet so you can save to Files, send by email, or message - same flow as other
          service apps.
        </Text>
      </View>
    ) : null;

  return (
    <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
      {modalHeader}
      <FadeInView style={styles.fadeFlex}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.pageIntro}>
            <View style={styles.statusRow}>
              <DetailChip row={b} />
            </View>
            {statusHelp ? <Text style={styles.lede}>{statusHelp}</Text> : null}
          </View>

          {vendorSla ? (
            <View style={styles.section}>
              <Card variant="elevated" padded>
                <Text style={styles.sectionTitle}>Partner confirmation</Text>
                {vendorSla.within ? (
                  <>
                    <Text style={styles.body}>
                      Your assigned partner will confirm your visit shortly - about{" "}
                      <Text style={styles.em}>{vendorSla.remMin}</Text> minute
                      {vendorSla.remMin === 1 ? "" : "s"} remaining in the confirmation window.
                    </Text>
                    <Text style={styles.meta}>Expected by {vendorSla.end} IST</Text>
                  </>
                ) : (
                  <Text style={styles.body}>
                    The confirmation window from your request has passed. OorjaMan or your partner will update this
                    booking shortly.
                  </Text>
                )}
              </Card>
            </View>
          ) : null}

          {showVisitCode && serviceOtp?.startCode ? (
            <View style={styles.section}>
              <Card variant="elevated" padded>
                <Text style={styles.sectionTitle}>Job Start Code</Text>
                <Text style={styles.visitCode}>{serviceOtp.startCode}</Text>
                <Text style={styles.bodyMuted}>
                  Share this code when the technician arrives. They must verify this before starting service.
                </Text>
                {showHappyCode && serviceOtp.happyCode ? (
                  <View style={styles.happyCodeBlock}>
                    <Text style={styles.sectionTitle}>Happy Code</Text>
                    <Text style={styles.visitCode}>{serviceOtp.happyCode}</Text>
                    <Text style={styles.bodyMutedHappy}>
                      Share this at completion. It confirms service closure and unlocks final submission.
                    </Text>
                    {b.status === "in_progress" ? (
                      <View style={styles.regenRow}>
                        <Button
                          variant="outline"
                          size="sm"
                          loading={regenHappyCodeMut.isPending}
                          onPress={() => void regenHappyCodeMut.mutateAsync()}
                        >
                          Regenerate Happy Code
                        </Button>
                        <Text style={styles.cooldownMeta}>
                          Cooldown: {Math.round(HAPPY_CODE_REGENERATE_COOLDOWN_MS / 60_000)} minutes between
                          regenerations.
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.codeActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Copy visit code"
                    onPress={() => {
                      void Clipboard.setStringAsync(serviceOtp.startCode!).then(() =>
                        Alert.alert("Copied", "Job Start Code copied to clipboard."),
                      );
                    }}
                    style={({ pressed }) => [styles.codeBtn, pressed && styles.codeBtnPressed]}
                  >
                    <Text style={styles.codeBtnText}>Copy code</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Share visit code"
                    onPress={() => {
                      void Share.share({
                        message: `Oorjaman Job Start Code: ${serviceOtp.startCode}${serviceOtp.happyCode ? ` | Happy Code: ${serviceOtp.happyCode}` : ""}`,
                      }).catch(() => undefined);
                    }}
                    style={({ pressed }) => [styles.codeBtn, styles.codeBtnOutline, pressed && styles.codeBtnPressed]}
                  >
                    <Text style={styles.codeBtnTextOutline}>Share</Text>
                  </Pressable>
                </View>
              </Card>
            </View>
          ) : null}

          {showTechnicianProfile ? (
            <View style={styles.section}>
              <AssignedTechnicianCard
                bookingId={b.id}
                enRouteAt={b.technician_en_route_at}
                status={b.status}
              />
            </View>
          ) : null}

          {showTrack ? (
            <View style={styles.section}>
              <Card variant="elevated" padded>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open track technician map"
                  onPress={() => router.push({ pathname: "/booking-track", params: { id: b.id } })}
                  style={({ pressed }) => [styles.trackBtn, pressed && styles.trackBtnPressed]}
                >
                  <Text style={styles.trackBtnTitle}>Track technician</Text>
                  <Text style={styles.trackBtnHint}>
                    {b.technician_en_route_at
                      ? "Live map refreshes every few seconds while they are en route"
                      : "Map opens when your technician marks themselves en route"}
                  </Text>
                </Pressable>
              </Card>
            </View>
          ) : null}

          <DetailSection title="Schedule">
            {customerBookingVisitDateVisible(b) ? (
              <>
                <Text style={styles.body}>{formatRange(b.scheduled_start, b.scheduled_end)}</Text>
                {isAmcSubscriptionBooking(b) ? (
                  <Text style={styles.meta}>Job start time for this AMC visit.</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.body}>
                Your job start time will appear here once your partner accepts the visit and assigns a technician.
              </Text>
            )}
          </DetailSection>

          <DetailSection title="Payment">
            {paymentsQuery.isPending ? (
              <Text style={styles.meta}>Loading payment…</Text>
            ) : paymentsQuery.isError ? (
              <Text style={styles.meta}>Could not load payment details.</Text>
            ) : successPayment ? (
              <>
                <Text style={styles.paymentAmount}>{formatMoney(successPayment.amount, b.currency)}</Text>
                <Text style={styles.paymentPaidLine}>
                  Paid via {normalizePaymentChannelLabel(successPayment.payment_method)} on{" "}
                  {formatPaymentDisplayTimestamp(successPayment.paid_at ?? successPayment.created_at)}
                </Text>
                <Text style={styles.paymentDisclaimer}>
                  Your partner will confirm the site details you provided and the final scope on arrival. If the final
                  amount differs from this advance, any balance (or credit) will be settled after they confirm.
                </Text>
                {completedInvoiceShare}
              </>
            ) : b.status === "pending_payment" ? (
              <>
                <Text style={styles.paymentAmount}>{formatMoney(b.estimated_price_cents, b.currency)}</Text>
                <Text style={styles.meta}>Advance payment is still pending to confirm this visit.</Text>
              </>
            ) : b.subscription_id != null && b.estimated_price_cents === 0 ? (
              <Text style={styles.body}>
                No separate advance for this visit - it is covered under your AMC plan. Any add-ons on site, if
                applicable, will be confirmed by your partner.
              </Text>
            ) : b.estimated_price_cents > 0 ? (
              <>
                <Text style={styles.paymentAmount}>{formatMoney(b.estimated_price_cents, b.currency)}</Text>
                <Text style={styles.meta}>
                  We could not load the advance receipt for this booking (for example, older data before payment
                  metadata was stored). Your partner still confirms the final amount on site.
                </Text>
                <Text style={styles.paymentDisclaimer}>
                  Your partner will confirm the site details you provided and the final scope on arrival. If the final
                  amount differs from this advance, any balance (or credit) will be settled after they confirm.
                </Text>
                {completedInvoiceShare}
              </>
            ) : (
              <Text style={styles.meta}>
                Payment details will appear here once an advance has been recorded for this booking.
              </Text>
            )}
          </DetailSection>

          <DetailSection title="Service">
            <Text style={styles.label}>Address</Text>
            <Text style={styles.body}>{stringifyAddress(b.service_site_address)}</Text>
            <Text style={[styles.label, styles.labelSpaced]}>Type</Text>
            <Text style={styles.body}>{b.service_type.replace(/_/g, " ")}</Text>
            <Text style={[styles.label, styles.labelSpaced]}>Service for</Text>
            <Text style={styles.body}>{serviceFor?.name ?? "Myself"}</Text>
            {serviceFor?.extra ? <Text style={styles.meta}>{serviceFor.extra}</Text> : null}
            {opsMeta && opsMeta.issue_count > 0 ? (
              <>
                <Text style={[styles.label, styles.labelSpaced]}>Operations</Text>
                <Text style={styles.body}>Ops team is actively monitoring this booking.</Text>
                {opsMeta.last_issue_note ? <Text style={styles.meta}>{opsMeta.last_issue_note}</Text> : null}
              </>
            ) : null}
          </DetailSection>

          {installationRows ? (
            <DetailSection title="Installation profile">
              <Text style={styles.profileHint}>
                Saved from your registration - tell the crew on site if anything has changed.
              </Text>
              <View style={styles.profileRows}>
                {installationRows.map((r) => (
                  <View key={r.key}>
                    <Text style={styles.label}>{r.label}</Text>
                    <Text style={styles.body}>{r.value}</Text>
                  </View>
                ))}
              </View>
            </DetailSection>
          ) : null}

          {b.customer_notes ? (
            <DetailSection title="Your notes">
              <Text style={styles.body}>{b.customer_notes}</Text>
            </DetailSection>
          ) : null}

          {b.status === "cancelled" && (b.cancellation_reason || b.cancelled_at) ? (
            <DetailSection title="Cancellation">
              {b.cancellation_reason ? <Text style={styles.body}>{b.cancellation_reason}</Text> : null}
              {(() => {
                const cc = readBookingCustomerCancellationMeta(b.metadata);
                if (
                  cc &&
                  !cc.withinGraceWindow &&
                  cc.lateFeePaise > 0 &&
                  cc.acknowledgedLateFee
                ) {
                  return (
                    <Text style={[styles.meta, styles.metaSpaced]}>
                      Late cancellation: up to {formatInrFromCents(cc.lateFeePaise)} assessed (settlements per policy).
                    </Text>
                  );
                }
                return null;
              })()}
              {b.cancelled_at ? (
                <Text style={[styles.meta, b.cancellation_reason && styles.metaSpaced]}>
                  Cancelled{" "}
                  {new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Kolkata",
                  }).format(new Date(b.cancelled_at))}
                </Text>
              ) : null}
            </DetailSection>
          ) : null}
          {b.status === "completed" ? (
            <DetailSection title={hasSubmittedRating ? "Your rating" : "Rate this visit (optional)"}>
              <Text style={styles.body}>
                {hasSubmittedRating
                  ? "Thanks for your feedback. You can update your rating anytime from this booking."
                  : "How was your visit? Rating is optional - you can skip now and come back whenever you like."}
              </Text>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={`r-${n}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate ${n} out of 5`}
                    onPress={() => setRatingValue(n)}
                    style={[styles.ratingChip, ratingValue === n && styles.ratingChipOn]}
                  >
                    <Text style={[styles.ratingChipText, ratingValue === n && styles.ratingChipTextOn]}>
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.meta}>1 = poor, 5 = excellent</Text>
              <View style={styles.gapSm} />
              <Text style={styles.label}>Comments (optional)</Text>
              <View style={styles.gapSm} />
              <TextInput
                value={ratingNote}
                onChangeText={setRatingNote}
                placeholder="Optional feedback"
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={styles.noteInput}
              />
              <View style={styles.gapSm} />
              <Button
                size="md"
                loading={saveRatingMut.isPending}
                disabled={saveRatingMut.isPending || ratingValue < 1}
                onPress={() => void saveRatingMut.mutateAsync()}
              >
                {hasSubmittedRating ? "Update rating" : "Submit rating"}
              </Button>
            </DetailSection>
          ) : null}

          {b.status && CUSTOMER_CANCELLABLE.includes(b.status) ? (
            <View style={styles.section}>
              <Card variant="elevated" padded>
                <Text style={styles.sectionTitle}>Change of plans</Text>
                <Text style={[styles.body, styles.helpSpaced]}>
                  To pick another date or time, reschedule directly in the app. Mention{" "}
                  <Text style={styles.em}>{customerBookingDisplayTitle(b)}</Text>.
                </Text>
                {cancelSla ? (
                  <Text style={[styles.meta, styles.helpSpaced]}>
                    {!cancelSla.penaltyEligible
                      ? "You can cancel without a late fee until your visit is confirmed and a technician is assigned."
                      : cancelSla.within
                        ? `Fee-free cancellation after technician assignment: ${cancelSla.remMin} minute${cancelSla.remMin === 1 ? "" : "s"} left${cancelSla.end ? ` (until ${cancelSla.end} IST)` : ""}. After that you can still cancel and OorjaMan may levy a fee.`
                        : routingDefaultsQuery.isLoading
                          ? "Late cancellation fees load from platform settings."
                          : lateFeePaise > 0
                            ? `The 1-hour fee-free window after technician assignment has passed. Late cancellation fee (up to ${formatInrFromCents(lateFeePaise)}): you will confirm before we record the cancellation.`
                            : `The fee-free window after technician assignment has passed. You can still cancel below - OorjaMan may assess a fee.`}
                  </Text>
                ) : null}
                <Button
                  variant="outline"
                  size="md"
                  onPress={() => router.push({ pathname: "/booking-reschedule", params: { id: b.id } })}
                >
                  Reschedule
                </Button>
                <View style={styles.gapSm} />
                <Button
                  variant="destructive"
                  size="md"
                  loading={cancelMut.isPending}
                  disabled={cancelMut.isPending}
                  onPress={() => {
                    setCancelReason("");
                    setCancelModalOpen(true);
                  }}
                >
                  Cancel booking
                </Button>
              </Card>
            </View>
          ) : b.status !== "cancelled" && b.status !== "completed" ? (
            <View style={styles.section}>
              <Card variant="elevated" padded>
                <Text style={styles.sectionTitle}>Need help?</Text>
                <Text style={[styles.body, styles.helpSpaced]}>
                  For changes while a visit is underway, contact support - mention{" "}
                  <Text style={styles.em}>{customerBookingDisplayTitle(b)}</Text>.
                </Text>
                <Button variant="outline" size="md" onPress={openSupport}>
                  Email support
                </Button>
              </Card>
            </View>
          ) : (
            <View style={styles.section}>
              <Card variant="elevated" padded>
                <Text style={styles.sectionTitle}>Support</Text>
                <Text style={[styles.body, styles.helpSpaced]}>Questions about this visit? We’re one email away.</Text>
                <Button variant="outline" size="md" onPress={openSupport}>
                  Email support
                </Button>
              </Card>
            </View>
          )}
        </ScrollView>
      </FadeInView>

      <Modal visible={cancelModalOpen} transparent animationType="fade" onRequestClose={() => setCancelModalOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.cancelModalRoot}
        >
          <Pressable
            style={styles.cancelModalBackdrop}
            disabled={cancelMut.isPending}
            onPress={() => setCancelModalOpen(false)}
          />
          <View style={styles.cancelModalCard} pointerEvents="box-none">
            <ModalSheetHeader
              title="Cancel this booking?"
              subtitle="Tell us why you are cancelling. This is shared with your partner and OorjaMan operations."
              onClose={() => setCancelModalOpen(false)}
              closeAccessibilityLabel="Close cancel dialog"
            />
            <Text style={styles.label}>Reason (required)</Text>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="e.g. schedule conflict, technician delay, booked by mistake…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[styles.noteInput, styles.cancelReasonInput]}
              editable={!cancelMut.isPending}
            />
            {cancelSla && cancelSla.penaltyEligible && !cancelSla.within && lateFeePaise > 0 ? (
              <Text style={[styles.meta, styles.cancelModalFee]}>
                Late cancellation fee (reference): up to {formatInrFromCents(lateFeePaise)}. This applies because a
                technician was already assigned. Final settlement may net this against any refund.
              </Text>
            ) : cancelSla && cancelSla.penaltyEligible && !cancelSla.within ? (
              <Text style={[styles.meta, styles.cancelModalFee]}>
                The fee-free hour after technician assignment has passed. OorjaMan may still assess a cancellation fee -
                you will confirm on the next step if applicable.
              </Text>
            ) : null}

            <View style={styles.cancelModalActions}>
              <Button variant="outline" size="md" disabled={cancelMut.isPending} onPress={() => setCancelModalOpen(false)}>
                Keep booking
              </Button>
              <View style={styles.gapSm} />
              {cancelSla?.within || !cancelSla?.penaltyEligible ? (
                <Button
                  variant="destructive"
                  size="md"
                  loading={cancelMut.isPending}
                  disabled={cancelMut.isPending || cancelReason.trim().length < 6}
                  onPress={() =>
                    void cancelMut.mutateAsync({ reason: cancelReason.trim(), acceptLateCancellationFee: false })
                  }
                >
                  Confirm cancellation
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="md"
                  loading={cancelMut.isPending}
                  disabled={cancelMut.isPending || cancelReason.trim().length < 6}
                  onPress={() =>
                    void cancelMut.mutateAsync({
                      reason: cancelReason.trim(),
                      acceptLateCancellationFee: true,
                    })
                  }
                >
                  Cancel anyway
                </Button>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fadeFlex: {
    flex: 1,
  },
  scroll: {
    ...modalScrollContentStyle,
  },
  pageIntro: {
    marginBottom: spacing.md,
  },
  statusRow: {
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
  section: {
    marginBottom: spacing.sm,
  },
  gapSm: {
    height: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  helpSpaced: {
    marginBottom: spacing.md,
  },
  trackBtn: {
    paddingVertical: spacing.xs,
  },
  trackBtnPressed: {
    opacity: 0.85,
  },
  trackBtnTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.primary,
  },
  trackBtnHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginTop: spacing["3xs"],
  },
  ratingRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  ratingChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  ratingChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  ratingChipText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  ratingChipTextOn: {
    color: colors.primary,
  },
  noteInput: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.foreground,
    lineHeight: 18,
    minHeight: 72,
    textAlignVertical: "top",
  },
  cancelReasonInput: {
    marginBottom: spacing.md,
  },
  cancelModalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  cancelModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  cancelModalCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cancelModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  cancelModalTitle: {
    flex: 1,
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    color: colors.foreground,
  },
  cancelModalHint: {
    marginBottom: spacing.sm,
  },
  cancelModalFee: {
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  cancelModalActions: {
    marginTop: spacing.xs,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
  labelSpaced: {
    marginTop: spacing.sm,
  },
  profileHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  profileRows: {
    gap: spacing.sm,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.foreground,
  },
  paymentAmount: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    lineHeight: 26,
    color: colors.foreground,
  },
  paymentPaidLine: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.foreground,
  },
  paymentDisclaimer: {
    marginTop: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  invoiceBlock: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  invoiceHint: {
    marginTop: spacing.xs,
  },
  meta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  metaSpaced: {
    marginTop: spacing.sm,
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
  chip: {
    alignSelf: "flex-start",
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
    opacity: 0.9,
  },
  footerMeta: {
    marginTop: spacing.lg,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
  visitCode: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxl,
    letterSpacing: 2,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  happyCodeBlock: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bodyMutedHappy: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  regenRow: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  cooldownMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  bodyMuted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  em: {
    fontFamily: fontFamily.semiBold,
    color: colors.foreground,
  },
  codeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  codeBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  codeBtnOutline: {
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  codeBtnPressed: {
    opacity: 0.88,
  },
  codeBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.background,
  },
  codeBtnTextOutline: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.primary,
  },
});
