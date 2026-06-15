import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, spacing } from "@oorjaman/config";

/** Tabs / nested stacks above a bottom tab bar - avoids double-padding with the tab bar safe area. */
export const SCREEN_EDGES_ABOVE_TAB_BAR = ["top", "left", "right"] as const satisfies readonly Edge[];

/** Tab screens that already use a native stack/tab header - skip top inset to avoid a gap under the header. */
export const SCREEN_EDGES_BENEATH_NATIVE_HEADER = ["left", "right"] as const satisfies readonly Edge[];

/** Full-screen stack modals with a custom in-screen header (`headerShown: false`). */
export const SCREEN_EDGES_MODAL = ["top", "bottom", "left", "right"] as const satisfies readonly Edge[];

/** Login, onboarding, and other flows without a bottom tab bar. */
export const SCREEN_EDGES_FULL_SCREEN = ["top", "bottom", "left", "right"] as const satisfies readonly Edge[];

type Props = {
  children: ReactNode;
  padded?: boolean;
  /**
   * Safe-area edges applied by the shell. Defaults to top/left/right only so tab scenes hug the tab bar.
   * Use `SCREEN_EDGES_FULL_SCREEN` when there is no bottom tab navigator.
   */
  edges?: readonly Edge[];
};

export function Screen({ children, padded = true, edges }: Props) {
  const insetEdges = edges ?? SCREEN_EDGES_ABOVE_TAB_BAR;

  return (
    <SafeAreaView style={styles.safe} edges={insetEdges}>
      <View style={[styles.inner, padded && styles.padded]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
