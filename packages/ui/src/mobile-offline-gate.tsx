import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Network from "expo-network";
import { OFFLINE_SCREEN_MESSAGE, OFFLINE_SCREEN_TITLE } from "@oorjaman/api";
import { colors, fontFamily, fontSize, spacing } from "@oorjaman/config";
import { Button } from "./Button";

/**
 * Grace period before declaring the app offline. `expo-network` (Expo SDK 56)
 * reports a transient `isInternetReachable === false` when Android/iOS resume
 * from sleep; without this debounce the app would flash the offline screen on
 * every screen-wake. Coming back online is applied immediately.
 */
const OFFLINE_CONFIRM_DELAY_MS = 3500;

async function readDeviceOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.isConnected === false) return false;
    if (state.isInternetReachable === false) return false;
    return true;
  } catch {
    return true;
  }
}

/**
 * Full-screen offline state for the Expo customer / technician apps.
 *
 * IMPORTANT: the offline UI is rendered as an OVERLAY on top of `children` and
 * `children` are NEVER unmounted. Previously this component swapped `children`
 * for the offline screen, which tore down the whole navigation tree — including
 * `MobileAuthSessionGuard` — on any connectivity blip. On screen-wake that
 * churned the Supabase session/auto-refresh lifecycle and surfaced as
 * "You're offline" followed by a forced re-login. Keeping the tree mounted
 * preserves the session; the debounce avoids flashing on transient wake blips.
 */
export function MobileOfflineGate({ children }: { children: ReactNode }) {
  const [offline, setOffline] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearConfirmTimer = useCallback(() => {
    if (confirmTimer.current) {
      clearTimeout(confirmTimer.current);
      confirmTimer.current = null;
    }
  }, []);

  const goOnline = useCallback(() => {
    clearConfirmTimer();
    setOffline(false);
  }, [clearConfirmTimer]);

  // Only declare offline if the device is STILL offline after the grace period.
  const confirmOffline = useCallback(() => {
    if (confirmTimer.current) return;
    confirmTimer.current = setTimeout(() => {
      confirmTimer.current = null;
      void readDeviceOnline().then((online) => setOffline(!online));
    }, OFFLINE_CONFIRM_DELAY_MS);
  }, []);

  const recheck = useCallback(() => {
    clearConfirmTimer();
    void readDeviceOnline().then((online) => setOffline(!online));
  }, [clearConfirmTimer]);

  useEffect(() => {
    void readDeviceOnline().then((online) => {
      if (!online) confirmOffline();
    });
    const sub = Network.addNetworkStateListener((state) => {
      if (state.isConnected === false || state.isInternetReachable === false) {
        confirmOffline();
      } else {
        goOnline();
      }
    });
    return () => {
      sub.remove();
      clearConfirmTimer();
    };
  }, [confirmOffline, goOnline, clearConfirmTimer]);

  return (
    <View style={styles.root}>
      {children}
      {offline ? (
        <View style={styles.overlay}>
          <View style={styles.wrap}>
            <View style={styles.iconRow} accessibilityElementsHidden>
              <View style={[styles.bar, styles.barLow]} />
              <View style={[styles.bar, styles.barMid]} />
              <View style={[styles.bar, styles.barHigh]} />
            </View>
            <Text style={styles.title}>{OFFLINE_SCREEN_TITLE}</Text>
            <Text style={styles.message}>{OFFLINE_SCREEN_MESSAGE}</Text>
            <Button variant="primary" size="lg" onPress={recheck}>
              Try again
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    zIndex: 1000,
    elevation: 1000,
  },
  wrap: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: 40,
    marginBottom: spacing.sm,
  },
  bar: {
    width: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  barLow: { height: 14, opacity: 0.25 },
  barMid: { height: 24, opacity: 0.55 },
  barHigh: { height: 18, opacity: 0.35 },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.foreground,
    textAlign: "center",
  },
  message: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 22,
    color: colors.mutedForeground,
    textAlign: "center",
    marginBottom: spacing.md,
  },
});
