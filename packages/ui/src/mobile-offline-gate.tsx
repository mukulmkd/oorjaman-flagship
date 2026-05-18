import { useCallback, useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Network from "expo-network";
import { OFFLINE_SCREEN_MESSAGE, OFFLINE_SCREEN_TITLE } from "@oorjaman/api";
import { colors, fontFamily, fontSize, spacing } from "@oorjaman/config";
import { Button } from "./Button";
import { Screen } from "./Screen";

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

/** Full-screen offline state for Expo customer / technician apps. */
export function MobileOfflineGate({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [checked, setChecked] = useState(false);

  const recheck = useCallback(() => {
    void readDeviceOnline().then((next) => {
      setOnline(next);
      setChecked(true);
    });
  }, []);

  useEffect(() => {
    recheck();
    const sub = Network.addNetworkStateListener((state) => {
      if (state.isConnected === false) {
        setOnline(false);
        setChecked(true);
        return;
      }
      if (state.isInternetReachable === false) {
        setOnline(false);
        setChecked(true);
        return;
      }
      setOnline(true);
      setChecked(true);
    });
    return () => sub.remove();
  }, [recheck]);

  if (!checked || online) {
    return children;
  }

  return (
    <Screen padded>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
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
