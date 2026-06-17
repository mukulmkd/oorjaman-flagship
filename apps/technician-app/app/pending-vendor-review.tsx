import { useCallback, useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  authApi,
  queryKeys,
  resolveTechnicianAppPostAuthPath,
  technicianApi,
} from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { Button, Screen, SCREEN_EDGES_FULL_SCREEN } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { supabase } from "../lib/supabase";
import { navigateFromTechnicianPostAuthPath, navigateToTechnicianMainAfterApproval } from "../lib/technician-approval-toast";

export default function PendingVendorReviewScreen() {
  const techQuery = useQuery({
    queryKey: queryKeys.technicians.me(),
    queryFn: () => technicianApi.getMyTechnicianProfile(supabase!),
    enabled: Boolean(supabase),
  });

  const tech = techQuery.data;

  useEffect(() => {
    if (!supabase || techQuery.isPending) return;
    void (async () => {
      try {
        const path = await resolveTechnicianAppPostAuthPath(supabase);
        if (path !== "/pending-vendor-review") {
          navigateFromTechnicianPostAuthPath(path);
        }
      } catch {
        /* stay on screen */
      }
    })();
  }, [techQuery.isPending, tech?.verification_status, tech?.vendor_review_status, tech?.is_verified]);

  const onRefresh = useCallback(async () => {
    if (!supabase) return;
    const r = await techQuery.refetch();
    const row = r.data;
    if (technicianApi.technicianIsFullyOnboarded(row)) {
      navigateToTechnicianMainAfterApproval();
      return;
    }
    if (!technicianApi.technicianShowsPendingReviewScreen(row)) {
      const path = await resolveTechnicianAppPostAuthPath(supabase);
      navigateFromTechnicianPostAuthPath(path);
    }
  }, [techQuery]);

  const onSignOut = useCallback(async () => {
    if (!supabase) return;
    await authApi.signOut(supabase);
    router.replace("/login");
  }, []);

  if (!supabase) {
    return (
      <Screen padded edges={SCREEN_EDGES_FULL_SCREEN}>
        <Text style={styles.body}>Configure Supabase to continue.</Text>
      </Screen>
    );
  }

  if (techQuery.isPending) {
    return (
      <Screen padded edges={SCREEN_EDGES_FULL_SCREEN}>
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen padded edges={SCREEN_EDGES_FULL_SCREEN}>
      <View style={styles.wrap}>
        <Text style={styles.kicker}>Application status</Text>
        <Text style={styles.title}>Under employer review</Text>
        <Text style={styles.body}>
          Your profile has been submitted. Your employer will review your application in their partner
          portal. Once they approve you, your OorjaMan partner ID will be issued and you can open
          assigned jobs.
        </Text>
        <Text style={styles.hint}>
          Check back here after your employer completes their review, or tap refresh to update your status.
        </Text>
        <View style={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            loading={techQuery.isFetching}
            disabled={techQuery.isFetching}
            onPress={() => void onRefresh()}
          >
            Refresh status
          </Button>
          <Button variant="outline" size="lg" disabled={techQuery.isFetching} onPress={() => void onSignOut()}>
            Sign out
          </Button>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  kicker: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxl,
    color: colors.foreground,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 24,
    color: colors.mutedForeground,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  loading: {
    marginTop: spacing.lg,
  },
});
