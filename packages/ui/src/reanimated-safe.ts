import { Pressable } from "react-native";

type ReanimatedModule = typeof import("react-native-reanimated");

let reanimatedModule: ReanimatedModule | null = null;

try {
  reanimatedModule = require("react-native-reanimated") as ReanimatedModule;
} catch {
  reanimatedModule = null;
}

const animatedDefault = reanimatedModule?.default;

export const hasReanimated = Boolean(reanimatedModule && animatedDefault);

export const AnimatedPressable = hasReanimated
  ? animatedDefault!.createAnimatedComponent(Pressable)
  : null;

export const useSharedValueSafe = reanimatedModule?.useSharedValue ?? null;
export const useAnimatedStyleSafe = reanimatedModule?.useAnimatedStyle ?? null;
export const withTimingSafe = reanimatedModule?.withTiming ?? null;
