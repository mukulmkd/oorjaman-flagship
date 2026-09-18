import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@oorjaman/config";
import { Button } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { ensureEnRouteLocationFix, getPartnerLocationStatus } from "../lib/location-permission";

type Props = {
  children: React.ReactNode;
};

function BlockerScreen({
  busy,
  permissionGranted,
  servicesEnabled,
  onEnable,
}: {
  busy: boolean;
  permissionGranted: boolean;
  servicesEnabled: boolean;
  onEnable: () => void;
}) {
  const insets = useSafeAreaInsets();

  const title = !permissionGranted
    ? "Allow location access"
    : !servicesEnabled
      ? "Turn on GPS"
      : "Location required";

  const body = !permissionGranted
    ? "OorjaMan Partner needs location permission while you use the app so customers can track trips and dispatch can assign nearby jobs."
    : !servicesEnabled
      ? "Your phone's Location/GPS is turned off. Enable it in quick settings or Settings → Location, then return here."
      : "Location must be on to use the partner app.";

  return (
    <View
      style={[
        styles.blockerRoot,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <View style={styles.sheet}>
        <Text style={styles.kicker}>Location required</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <Text style={styles.note}>This screen closes automatically once location is ready.</Text>
        <Button variant="primary" size="lg" loading={busy} onPress={onEnable}>
          {!permissionGranted ? "Allow location" : "Open Settings"}
        </Button>
        {!permissionGranted ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open device settings"
            disabled={busy}
            onPress={() => void Linking.openSettings()}
            style={({ pressed }) => [styles.settingsLink, pressed && styles.settingsLinkPressed]}
          >
            <Text style={styles.settingsLinkText}>Open Settings</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Hard-blocks the signed-in partner app until foreground permission AND system GPS are on.
 * Does not render children underneath — avoids using the app behind a broken modal layer.
 */
export function MandatoryLocationGate({ children }: Props) {
  const [checking, setChecking] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [servicesEnabled, setServicesEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const status = await getPartnerLocationStatus();
    setPermissionGranted(status.permissionGranted);
    setServicesEnabled(status.servicesEnabled);
    setChecking(false);
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const requestLocation = useCallback(async () => {
    setBusy(true);
    try {
      if (!permissionGranted) {
        // Triggers browser / OS permission prompt via platform adapter.
        await ensureEnRouteLocationFix();
      } else if (!servicesEnabled) {
        await Linking.openSettings();
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [permissionGranted, servicesEnabled, refresh]);

  const ready = permissionGranted && servicesEnabled;

  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!ready) {
    return (
      <BlockerScreen
        busy={busy}
        permissionGranted={permissionGranted}
        servicesEnabled={servicesEnabled}
        onEnable={() => void requestLocation()}
      />
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  blockerRoot: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  sheet: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  kicker: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.primary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.foreground,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
  },
  note: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  settingsLink: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  settingsLinkPressed: {
    opacity: 0.85,
  },
  settingsLinkText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.primary,
  },
});
