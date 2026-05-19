import { useLayoutEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingApi, queryKeys, technicianApi } from "@oorjaman/api";
import { Button, Card, Screen, SCREEN_EDGES_BENEATH_NATIVE_HEADER } from "@oorjaman/ui";
import { colors, spacing } from "@oorjaman/config";
import { fontFamily, fontSize, fontWeight } from "../../constants/fonts";
import { SupportChatHeaderButton } from "../../components/help-header-button";
import { JobListCard } from "../../components/job-list-card";
import { formatJobWhen, preferredWorkCity, stringifyAddress } from "../../lib/booking-display";
import { pickNextJob } from "../../lib/job-list-filters";
import { supabase } from "../../lib/supabase";

function displayName(tech: { name_as_per_aadhaar?: string | null } | null | undefined): string {
  const n = tech?.name_as_per_aadhaar?.trim();
  if (n) return n.split(/\s+/)[0] ?? n;
  return "Technician";
}

export default function HomeTab() {
  const navigation = useNavigation();
  const qc = useQueryClient();
  const [employerOpen, setEmployerOpen] = useState(false);

  const techQ = useQuery({
    queryKey: queryKeys.technicians.me(),
    queryFn: () => technicianApi.getMyTechnicianProfile(supabase!),
    enabled: Boolean(supabase),
  });
  const tech = techQ.data;

  const vendorQ = useQuery({
    queryKey: queryKeys.vendors.detail(tech?.vendor_id ?? ""),
    queryFn: () => technicianApi.getTechnicianEmployerVendor(supabase!, tech!.vendor_id!),
    enabled: Boolean(supabase && tech?.vendor_id),
  });

  const bookingsQ = useQuery({
    queryKey: queryKeys.bookings.list({ scope: "technician-assigned" }),
    queryFn: () => bookingApi.listVisibleBookings(supabase!),
    enabled: Boolean(supabase),
  });

  const statsQ = useQuery({
    queryKey: queryKeys.technicians.publicStats(tech?.id ?? ""),
    queryFn: () => technicianApi.listTechnicianPublicStats(supabase!, tech?.id ? [tech.id] : []),
    enabled: Boolean(supabase && tech?.id),
  });

  const nextJob = useMemo(() => pickNextJob(bookingsQ.data ?? []), [bookingsQ.data]);
  const stats = statsQ.data?.[0];
  const employerName =
    vendorQ.data?.trade_name?.trim() || vendorQ.data?.business_name?.trim() || "Your employer";
  const workCity = preferredWorkCity(tech?.home_base_address, tech?.preferred_work_locations);
  const headerLine = workCity ? `${employerName} · ${workCity}` : employerName;

  const availabilityMut = useMutation({
    mutationFn: (next: boolean) => technicianApi.updateMyTechnicianAvailability(supabase!, next),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.technicians.me() });
    },
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerShadowVisible: false,
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.foreground,
      headerRight: () => <SupportChatHeaderButton />,
      headerRightContainerStyle: { paddingRight: 8 },
      headerLeftContainerStyle: { paddingLeft: 4, maxWidth: "72%" },
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Employer ${headerLine}. Tap for details`}
          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
          style={styles.navEmployer}
          onPress={() => setEmployerOpen((o) => !o)}
        >
          <Ionicons name="business-outline" size={20} color={colors.primary} />
          <Text style={styles.navEmployerText} numberOfLines={1}>
            {headerLine}
          </Text>
          <Ionicons name={employerOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
        </Pressable>
      ),
    });
  }, [navigation, headerLine, employerOpen]);

  return (
    <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {employerOpen ? (
        <Card variant="muted" padded>
          <View style={styles.employerCard}>
          <Text style={styles.employerTitle}>{employerName}</Text>
          {workCity ? <Text style={styles.employerMeta}>Preferred work city: {workCity}</Text> : null}
          {tech?.employee_code?.trim() ? (
            <Text style={styles.employerMeta}>OorjaMan ID: {tech.employee_code.trim()}</Text>
          ) : null}
          {tech?.personal_phone?.trim() ? (
            <Text style={styles.employerMeta}>Sign-in phone: {tech.personal_phone.trim()}</Text>
          ) : null}
          </View>
        </Card>
      ) : null}

      <View style={styles.hero}>
        <Text style={styles.hello}>Hello,</Text>
        <Text style={styles.headline}>{displayName(tech)}</Text>
        {tech?.employee_code?.trim() ? (
          <View style={styles.idPill}>
            <Text style={styles.idPillText}>{tech.employee_code.trim()}</Text>
          </View>
        ) : null}
        <Text style={styles.sub}>
          Complete visits safely and on time. Open an assigned job and use the Job Start Code from the customer app.
        </Text>
      </View>

      {nextJob ? (
        <View style={styles.sectionGap}>
          <Text style={styles.sectionLabel}>Next visit</Text>
          <JobListCard
            item={nextJob}
            cta={nextJob.status === "in_progress" ? "Continue visit" : "Open job"}
            onPress={() => {
              if (nextJob.status === "in_progress") {
                router.push(`/(main)/jobs/execute/${nextJob.id}`);
              } else {
                router.push(`/(main)/jobs/${nextJob.id}`);
              }
            }}
          />
        </View>
      ) : (
        <View style={styles.sectionGap}>
          <Card variant="muted" padded>
            <Text style={styles.cardTitle}>No visits queued</Text>
            <Text style={styles.cardBody}>When dispatch assigns you a job, it will show up here and under the Jobs tab.</Text>
          </Card>
        </View>
      )}

      <Button variant="primary" size="lg" onPress={() => router.push("/(main)/jobs")}>
        View all jobs
      </Button>

      <View style={styles.availCard}>
        <Card variant="muted" padded>
        <View style={styles.availRow}>
          <View style={styles.availText}>
            <Text style={styles.cardTitle}>Available for assignments</Text>
            <Text style={styles.cardBody}>
              Turn off when you are on leave so dispatch does not assign new visits.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Available for new job assignments"
            value={tech?.is_available ?? true}
            disabled={availabilityMut.isPending || !tech}
            onValueChange={(v) => availabilityMut.mutate(v)}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
        </Card>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats?.total_jobs ?? 0}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {stats?.avg_rating != null ? stats.avg_rating.toFixed(1) : "—"}
          </Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats?.rating_count ?? 0}</Text>
          <Text style={styles.statLabel}>Reviews</Text>
        </View>
      </View>

      {nextJob ? (
        <View style={styles.tipCard}>
          <Card variant="outline" padded>
            <Text style={styles.cardTitle}>Quick tip</Text>
            <Text style={styles.cardBody}>
              {nextJob.reference_code} · {formatJobWhen(nextJob.scheduled_start)} · {stringifyAddress(nextJob.service_site_address)}
            </Text>
          </Card>
        </View>
      ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  navEmployer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
    minHeight: 40,
    flexShrink: 1,
  },
  navEmployerText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  employerCard: {
    marginBottom: spacing.md,
  },
  employerTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  employerMeta: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
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
  idPill: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: `${colors.primary}18`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.primary}40`,
  },
  idPillText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    letterSpacing: 0.4,
    color: colors.primary,
    textTransform: "uppercase",
  },
  sub: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 24,
    color: colors.mutedForeground,
  },
  sectionGap: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
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
  availCard: {
    marginTop: spacing.lg,
  },
  availRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  availText: {
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statBox: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
  },
  statValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.foreground,
  },
  statLabel: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
  tipCard: {
    marginTop: spacing.lg,
  },
});
