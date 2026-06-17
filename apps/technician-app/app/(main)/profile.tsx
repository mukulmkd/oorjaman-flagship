import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, markUserInitiatedSignOut, queryKeys, technicianApi } from "@oorjaman/api";
import { Button, Card, Screen, SCREEN_EDGES_BENEATH_NATIVE_HEADER, SkeletonBar } from "@oorjaman/ui";
import { colors, spacing } from "@oorjaman/config";
import { fontFamily, fontSize } from "../../constants/fonts";
import { preferredWorkCity, stringifyAddress } from "../../lib/booking-display";
import { supabase } from "../../lib/supabase";

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card variant="elevated" padded>
        {children}
      </Card>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function ProfileTab() {
  const qc = useQueryClient();
  const [identity, setIdentity] = useState<string | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [busy, setBusy] = useState(false);

  const techQuery = useQuery({
    queryKey: queryKeys.technicians.me(),
    queryFn: () => technicianApi.getMyTechnicianProfile(supabase!),
    enabled: Boolean(supabase),
  });

  const vendorQuery = useQuery({
    queryKey: queryKeys.vendors.detail(techQuery.data?.vendor_id ?? ""),
    queryFn: () => technicianApi.getTechnicianEmployerVendor(supabase!, techQuery.data!.vendor_id!),
    enabled: Boolean(supabase && techQuery.data?.vendor_id),
  });

  const statsQuery = useQuery({
    queryKey: queryKeys.technicians.publicStats(techQuery.data?.id ?? ""),
    queryFn: () =>
      technicianApi.listTechnicianPublicStats(supabase!, techQuery.data?.id ? [techQuery.data.id] : []),
    enabled: Boolean(supabase && techQuery.data?.id),
  });

  const availabilityMut = useMutation({
    mutationFn: (next: boolean) => technicianApi.updateMyTechnicianAvailability(supabase!, next),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.technicians.me() }),
  });

  const tech = techQuery.data;
  const stats = statsQuery.data?.[0];
  const employer =
    vendorQuery.data?.trade_name?.trim() || vendorQuery.data?.business_name?.trim() || "-";
  const workCity = preferredWorkCity(tech?.home_base_address, tech?.preferred_work_locations);

  useEffect(() => {
    if (!supabase) {
      setIdentity(null);
      setSessionResolved(true);
      return;
    }
    setSessionResolved(false);
    void supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setIdentity(u?.phone ?? u?.email ?? "Signed in");
      setSessionResolved(true);
    });
  }, []);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      if (supabase) {
        markUserInitiatedSignOut();
        await authApi.signOut(supabase);
      }
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  }, []);

  const verified =
    tech?.is_verified && tech.verification_status === "verified" && tech.vendor_review_status === "approved";

  return (
    <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lede}>OorjaMan field identity, employer, documents, and account.</Text>

        <ProfileSection title="Identity">
          {techQuery.isPending ? (
            <SkeletonBar variant="dense" />
          ) : (
            <>
              <Row label="Name (Aadhaar)" value={tech?.name_as_per_aadhaar?.trim() || "-"} />
              <Row label="OorjaMan ID" value={tech?.employee_code?.trim() || "-"} />
              <Row label="Phone" value={tech?.personal_phone?.trim() || identity || "-"} />
              <Row
                label="Status"
                value={
                  verified
                    ? "Active - verified"
                    : tech?.vendor_review_status === "pending"
                      ? "Awaiting employer review"
                      : tech?.verification_status ?? "-"
                }
              />
            </>
          )}
        </ProfileSection>

        <ProfileSection title="Employer">
          <Row label="Vendor" value={employer} />
          <Row label="Work city" value={workCity ?? "-"} />
          {tech?.service_radius_km != null ? (
            <Row label="Service radius" value={`${tech.service_radius_km} km`} />
          ) : null}
        </ProfileSection>

        <ProfileSection title="Work profile">
          <Row label="Skills" value={tech?.skills?.length ? tech.skills.join(", ") : "-"} />
          <Row
            label="Solar experience"
            value={tech?.flag_solar_cleaning_experience ? `Yes · ${tech.years_experience ?? "-"} yrs` : "No"}
          />
          <Row label="Home base" value={stringifyAddress(tech?.home_base_address)} />
          <View style={styles.availRow}>
            <Text style={styles.rowLabel}>Available for assignments</Text>
            <Switch
              value={tech?.is_available ?? true}
              disabled={availabilityMut.isPending || !tech}
              onValueChange={(v) => availabilityMut.mutate(v)}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </ProfileSection>

        <ProfileSection title="Safety & training">
          <Row label="Safety training" value={tech?.flag_safety_training ? "Completed" : "-"} />
          <Row label="Organisation" value={tech?.safety_training_org?.trim() || "-"} />
          <Row label="Height / rope cert" value={tech?.flag_height_work_cert ? "Yes" : "No"} />
        </ProfileSection>

        <ProfileSection title="Performance">
          <Row
            label="Rating"
            value={stats?.avg_rating != null ? `${stats.avg_rating.toFixed(1)} / 5` : "No ratings yet"}
          />
          <Row label="Completed visits" value={String(stats?.total_jobs ?? 0)} />
          <Row label="Customer reviews" value={String(stats?.rating_count ?? 0)} />
        </ProfileSection>

        <ProfileSection title="Documents">
          <Text style={styles.docHint}>View registration uploads (Aadhaar, PAN, safety cert, bank proof).</Text>
          <Button variant="outline" size="md" onPress={() => router.push("/profile-documents")}>
            Open documents
          </Button>
        </ProfileSection>

        <ProfileSection title="Account">
          <Row label="Signed in as" value={sessionResolved ? identity ?? "…" : "…"} />
          <Button
            variant="primary"
            size="lg"
            loading={busy}
            disabled={busy}
            onPress={() => void signOut()}
            style={styles.signOut}
          >
            Sign out
          </Button>
        </ProfileSection>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  lede: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  row: {
    marginBottom: spacing.md,
  },
  rowLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rowValue: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
    lineHeight: 22,
  },
  availRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  docHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  signOut: {
    marginTop: spacing.sm,
  },
});
