import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@oorjaman/config";
import { Card } from "./Card";
import { SkeletonBar, SkeletonStack } from "./SkeletonLoader";

type Props = {
  /** Tab bar pill count - match the visible tabs in your shell (e.g. customer 5, technician 4). */
  tabSlots?: number;
};

/**
 * Full-screen placeholder while bootstrapping tab navigation (session + profile queries).
 * Mimics header content + bottom tab strip for a calm, premium handoff from splash.
 */
export function TabShellSkeleton({ tabSlots = 5 }: Props) {
  const slots = Math.min(Math.max(tabSlots, 3), 8);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.body}>
        <SkeletonBar variant="title" />
        <View style={{ height: spacing.md }} />
        <Card variant="muted" padded>
          <SkeletonStack rows={6} />
        </Card>
      </View>
      <SafeAreaView edges={["bottom"]} style={styles.tabStrip}>
        <View style={styles.tabRow}>
          {Array.from({ length: slots }).map((_, i) => (
            <View key={i} style={styles.tabSlot}>
              <SkeletonBar variant="short" />
              <View style={styles.tabDot} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  tabStrip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  tabRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  tabSlot: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    maxWidth: 72,
  },
  tabDot: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    opacity: 0.65,
  },
});
