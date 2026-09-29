import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { USE_NATIVE_DRIVER } from "./use-native-driver";

type Props = {
  color: string;
  /** Track length. A bar, not a circular arrow. */
  width?: number;
};

function fade(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Sliding bar. A circular progress mark on Android reads as a reload icon.
 */
export function LoadingSpinner({ color, width = 72 }: Props) {
  const travel = useRef(new Animated.Value(0)).current;
  const segment = Math.max(16, Math.round(width * 0.42));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(travel, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(travel, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [travel]);

  const translateX = travel.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width - segment],
  });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={{
        width,
        height: 3,
        borderRadius: 2,
        overflow: "hidden",
        backgroundColor: fade(color, 0.35),
      }}
    >
      <Animated.View
        style={{
          width: segment,
          height: 3,
          borderRadius: 2,
          backgroundColor: color,
          transform: [{ translateX }],
        }}
      />
    </View>
  );
}
