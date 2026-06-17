import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@oorjaman/config";
import { fontFamily, fontSize } from "../constants/fonts";
import { STORAGE_KEY_LOCATION_PROMPT_DONE } from "../constants/storage";
import { ensureForegroundLocationAccess, isExpoGoHost } from "../lib/location-access";

export default function PermissionsScreen() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const continueToLogin = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY_LOCATION_PROMPT_DONE, "true");
    router.replace("/login");
  }, []);

  const enableLocation = useCallback(async () => {
    setBusy(true);
    try {
      await ensureForegroundLocationAccess();
    } finally {
      setBusy(false);
      await continueToLogin();
    }
  }, [continueToLogin]);

  const skip = useCallback(() => {
    void continueToLogin();
  }, [continueToLogin]);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + spacing.xl,
          paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md,
        },
      ]}
    >
      <Text style={styles.kicker}>Almost there</Text>
      <Text style={styles.title}>Enable location</Text>
      <Text style={styles.body}>
        We use your location to tag site photos with GPS, match you with nearby cleaning partners, and show
        realistic visit ETAs. You can change this anytime in device settings.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Privacy</Text>
        <Text style={styles.cardBody}>
          Precise coordinates are only used while you book or track a visit - never sold to advertisers.
        </Text>
      </View>

      {isExpoGoHost() ? (
        <View style={styles.expoNote}>
          <Text style={styles.expoNoteText}>
            You are using Expo Go for development. After you tap Allow location, iOS may show an extra
            “Experience needs permissions” step - that is Expo Go only. Installed OorjaMan builds show your
            app name and our custom message instead.
          </Text>
        </View>
      ) : null}

      <View style={styles.spacer} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Allow location access"
        disabled={busy}
        onPress={() => void enableLocation()}
        style={({ pressed }) => [
          styles.primary,
          pressed && !busy && styles.primaryPressed,
          busy && styles.primaryDisabled,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={styles.primaryLabel}>Allow location</Text>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip location for now"
        disabled={busy}
        onPress={skip}
        style={({ pressed }) => [styles.secondary, pressed && !busy && styles.secondaryPressed]}
      >
        <Text style={styles.secondaryLabel}>Not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  kicker: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.primary,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxl,
    letterSpacing: -0.4,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.lg,
    lineHeight: 26,
    color: colors.mutedForeground,
  },
  card: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  cardTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  cardBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
  },
  expoNote: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  expoNoteText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.xl,
  },
  primary: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  primaryPressed: {
    opacity: 0.92,
  },
  primaryDisabled: {
    opacity: 0.65,
  },
  primaryLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    color: colors.primaryForeground,
  },
  secondary: {
    marginTop: spacing.sm,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryPressed: {
    opacity: 0.85,
  },
  secondaryLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
});
