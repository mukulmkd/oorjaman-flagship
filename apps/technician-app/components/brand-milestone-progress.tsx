import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { brandTextColors } from "../lib/brand-assets";

const TRACK_WIDTH = 280;
const DOT_SIZE = 10;
const TRACK_GREY = "#e4e4e4";

type Props = {
  progress?: Animated.Value;
  autoPlay?: boolean;
  durationMs?: number;
  /** Branding kit splash uses 4 nodes; loaders may use 3. */
  steps?: number;
  /** 0–1 cap on fill (splash kit shows ~2 of 4 nodes lit). */
  maxProgress?: number;
};

/**
 * Branding-kit progress: line + milestone dots (splash = 4 nodes).
 */
export function BrandMilestoneProgress({
  progress: externalProgress,
  autoPlay = true,
  durationMs = 2400,
  steps = 4,
  maxProgress = 1,
}: Props) {
  const internalProgress = useRef(new Animated.Value(0)).current;
  const progress = externalProgress ?? internalProgress;
  const dotCount = Math.min(Math.max(steps, 2), 6);

  useEffect(() => {
    if (!autoPlay || externalProgress) return;
    const anim = Animated.timing(internalProgress, {
      toValue: maxProgress,
      duration: durationMs,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [autoPlay, durationMs, externalProgress, internalProgress, maxProgress]);

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRACK_WIDTH],
  });

  const dotPositions = Array.from({ length: dotCount }, (_, i) =>
    dotCount === 1 ? 0 : (TRACK_WIDTH * i) / (dotCount - 1),
  );

  return (
    <View style={styles.root}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: fillWidth }]} />
        {dotPositions.map((left, index) => (
          <MilestoneDot key={`${left}-${index}`} left={left} index={index} steps={dotCount} progress={progress} />
        ))}
      </View>
    </View>
  );
}

function MilestoneDot({
  left,
  index,
  steps,
  progress,
}: {
  left: number;
  index: number;
  steps: number;
  progress: Animated.Value;
}) {
  const threshold = index / (steps - 1);
  const active = progress.interpolate({
    inputRange: [threshold - 0.001, threshold],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const borderColor = active.interpolate({
    inputRange: [0, 1],
    outputRange: [TRACK_GREY, brandTextColors.oorja],
  });
  const backgroundColor = active.interpolate({
    inputRange: [0, 1],
    outputRange: ["#ffffff", brandTextColors.oorja],
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          left: left - DOT_SIZE / 2,
          borderColor,
          backgroundColor,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    width: TRACK_WIDTH,
    height: DOT_SIZE + 8,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    width: TRACK_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: TRACK_GREY,
    overflow: "visible",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
    backgroundColor: brandTextColors.oorja,
  },
  dot: {
    position: "absolute",
    top: -(DOT_SIZE - 4) / 2,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
  },
});
