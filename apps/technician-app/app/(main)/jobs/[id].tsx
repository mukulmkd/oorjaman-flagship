import { useMemo, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  bookingApi,
  formatInrFromCents,
  queryKeys,
  readBookingCustomerCancellationMeta,
  readBookingOpsMeta,
  readBookingServiceOtpMeta,
} from "@oorjaman/api";
import type { BookingStatus } from "@oorjaman/api";
import { readBookingRecipientMeta } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { jobStatusLabel, jobUiBucket } from "../../../lib/job-status";
import {
  Button,
  Card,
  EmptyStateCard,
  ErrorStateCard,
  FadeInView,
  Screen,
  SCREEN_EDGES_BENEATH_NATIVE_HEADER,
  modalScrollContentStyle,
  SkeletonStack,
  useModalStackHeader,
} from "@oorjaman/ui";
import { ModalHeaderSupportTrailing } from "../../../components/modal-header-support-trailing";
import { fontFamily, fontSize, fontWeight } from "../../../constants/fonts";
import { BookingSitePhotos } from "../../../components/booking-site-photos";
import { supabase } from "../../../lib/supabase";
import { formatDisplayDateTimeRange } from "@oorjaman/utils";

function formatRange(startIso: string, endIso: string): string {
  return formatDisplayDateTimeRange(startIso, endIso);
}

function stringifyAddress(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "string") return value || "-";
  if (typeof value === "object" && value !== null && "formatted" in value) {
    const f = (value as { formatted?: unknown }).formatted;
    if (typeof f === "string" && f.trim()) return f;
  }
  try {
    const lines: string[] = [];
    const o = value as Record<string, unknown>;
    for (const k of ["line1", "line2", "city", "state", "postal_code"]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) lines.push(v.trim());
    }
    if (lines.length) return lines.join("\n");
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function DetailChip({ status }: { status: BookingStatus }) {
  const bucket = jobUiBucket(status);
  const label = jobStatusLabel(status);
  const chipStyles =
    bucket === "upcoming"
      ? styles.chipUpcoming
      : bucket === "active"
        ? styles.chipActive
        : bucket === "done"
          ? styles.chipDone
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

function recipientLines(metadata: unknown): { headline: string; detail?: string } {
  const rec = readBookingRecipientMeta(metadata as never);
  if (!rec || rec.is_self) return { headline: "Customer" };
  const headline = rec.recipient_name?.trim() || "Someone else";
  const parts = [rec.relationship, rec.recipient_phone].filter(Boolean).join(" · ");
  return { headline, detail: parts || undefined };
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const bookingId = Array.isArray(id) ? id[0] : id;

  const query = useQuery({
    queryKey: bookingId ? queryKeys.bookings.detail(bookingId) : [],
    queryFn: () => bookingApi.getBookingById(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId),
  });

  const b = query.data;
  const rec = b ? recipientLines(b.metadata) : null;
  const opsMeta = b ? readBookingOpsMeta(b.metadata) : null;
  const serviceOtp = b ? readBookingServiceOtpMeta(b.metadata) : null;

  const statusNote = useMemo(() => {
    if (!b) return undefined;
    if (b.status === "accepted") return "You are assigned — head to site for the scheduled window.";
    if (b.status === "in_progress") return "Job marked in progress.";
    if (b.status === "completed") return "This visit is completed.";
    if (b.status === "cancelled") return "This job was cancelled.";
    return undefined;
  }, [b]);

  const modalHeader = useModalStackHeader({
    title: b?.reference_code ?? "Job details",
    subtitle: statusNote,
    onClose: () => router.back(),
    closeAccessibilityLabel: "Close job details",
    showClose: false,
    trailing: (
      <ModalHeaderSupportTrailing
        onClose={() => router.back()}
        closeAccessibilityLabel="Close job details"
      />
    ),
  });

  if (!supabase || !bookingId) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <Text style={styles.muted}>Missing job or Supabase configuration.</Text>
      </Screen>
    );
  }

  if (query.isPending) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <Card variant="muted" padded>
          <SkeletonStack rows={6} />
        </Card>
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <ErrorStateCard
          title="Couldn't load job"
          message={(query.error as Error).message}
          onRetry={() => void query.refetch()}
          retryLabel="Retry"
        />
      </Screen>
    );
  }

  if (!b) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <EmptyStateCard
          title="Job not found"
          description="This assignment may have been reassigned or removed. Pull back to refresh your job list."
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
      {modalHeader}
      <FadeInView style={styles.fadeFlex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.hero}>
          <DetailChip status={b.status} />
        </View>

        <DetailSection title="Schedule">
          <Text style={styles.body}>{formatRange(b.scheduled_start, b.scheduled_end)}</Text>
        </DetailSection>

        {serviceOtp?.startCode || serviceOtp?.happyCode ? (
          <DetailSection title="Customer codes">
            <Text style={styles.bodyMuted}>
              The customer sees these in their app. You will enter the Job Start Code when you begin the visit and the
              Happy Code when you complete it.
            </Text>
            {serviceOtp.startCode ? (
              <Text style={styles.meta}>Job Start Code is verified at visit start (not shown here).</Text>
            ) : null}
            {serviceOtp.happyCode ? (
              <Text style={styles.meta}>Happy Code is required to submit completion.</Text>
            ) : null}
          </DetailSection>
        ) : null}

        <DetailSection title="Site">
          <Text style={styles.body}>{stringifyAddress(b.service_site_address)}</Text>
          <Text style={styles.meta}>Service: {b.service_type.replace(/_/g, " ")}</Text>
          <BookingSitePhotos booking={b} />
        </DetailSection>
        <DetailSection title="Service for">
          <Text style={styles.body}>{rec?.headline ?? "Customer"}</Text>
          {rec?.detail ? (
            <Text style={styles.meta}>{rec.detail}</Text>
          ) : null}
        </DetailSection>

        {opsMeta && opsMeta.issue_count > 0 ? (
          <DetailSection title="Operations watch">
            <Text style={styles.body}>Operations team is monitoring this visit closely.</Text>
            {opsMeta.last_issue_note ? <Text style={styles.meta}>{opsMeta.last_issue_note}</Text> : null}
          </DetailSection>
        ) : null}

        {b.customer_notes ? (
          <DetailSection title="Customer notes">
            <Text style={styles.body}>{b.customer_notes}</Text>
          </DetailSection>
        ) : null}

        {b.status === "cancelled" && (b.cancellation_reason || readBookingCustomerCancellationMeta(b.metadata)) ? (
          <DetailSection title="Cancellation">
            {b.cancellation_reason ? <Text style={styles.body}>{b.cancellation_reason}</Text> : null}
            {(() => {
              const cc = readBookingCustomerCancellationMeta(b.metadata);
              if (
                cc &&
                !cc.withinGraceWindow &&
                cc.lateFeePaise > 0
              ) {
                return (
                  <Text style={styles.meta}>
                    Late cancellation reference fee: up to {formatInrFromCents(cc.lateFeePaise)} (per platform policy).
                  </Text>
                );
              }
              return null;
            })()}
          </DetailSection>
        ) : null}

        <DetailSection title="Reference">
          <Text style={styles.mono}>{b.id}</Text>
        </DetailSection>

        {b.status === "accepted" || b.status === "in_progress" ? (
          <View style={styles.executeFooter}>
            <Button size="lg" variant="primary" onPress={() => router.push(`/(main)/jobs/execute/${b.id}`)}>
              {b.status === "in_progress" ? "Continue visit" : "Start visit"}
            </Button>
          </View>
        ) : null}
        </ScrollView>
      </FadeInView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fadeFlex: {
    flex: 1,
  },
  scroll: {
    ...modalScrollContentStyle,
    gap: spacing.sm,
  },
  hero: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  statusNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
  },
  section: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 24,
    color: colors.foreground,
  },
  bodyMuted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
  },
  meta: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  mono: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.foreground,
  },
  chipUpcoming: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primaryBorder,
  },
  chipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  chipDone: {
    backgroundColor: colors.elevated,
    borderColor: colors.primary,
  },
  chipEnded: {
    backgroundColor: colors.muted,
    borderColor: colors.border,
  },
  executeFooter: {
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
});
