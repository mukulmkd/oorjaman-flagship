import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors, spacing } from "@oorjaman/config";

type BarVariant = "full" | "short" | "title" | "dense";

const barVariantStyles = StyleSheet.create({
  full: {
    width: "100%",
    height: 12,
    borderRadius: 8,
  },
  short: {
    width: "72%",
    height: 12,
    borderRadius: 8,
  },
  title: {
    width: "55%",
    height: 18,
    borderRadius: 10,
  },
  dense: {
    width: "100%",
    height: 10,
    borderRadius: 6,
  },
});

type SkeletonBarProps = {
  variant?: BarVariant;
};

/**
 * Single shimmering skeleton segment - compose for lists and cards.
 */
export function SkeletonBar({ variant = "full" }: SkeletonBarProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 280],
  });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.barTrack, barVariantStyles[variant]]}
    >
      <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerTranslate }] }]} />
    </View>
  );
}

type SkeletonStackProps = {
  rows?: number;
};

/** Vertical stack of skeleton lines with alternating widths */
export function SkeletonStack({ rows = 3 }: SkeletonStackProps) {
  const variants: BarVariant[] = ["title", "full", "short"];

  return (
    <View style={styles.stack}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.rowGap, i > 0 && styles.rowSpacing]}>
          <SkeletonBar variant={variants[i % variants.length]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  barTrack: {
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "38%",
    backgroundColor: colors.backgroundSecondary,
    opacity: 0.7,
  },
  stack: {
    width: "100%",
  },
  rowGap: {
    width: "100%",
  },
  rowSpacing: {
    marginTop: spacing.sm,
  },
});
