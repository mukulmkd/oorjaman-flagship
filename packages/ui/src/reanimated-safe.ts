import type { ComponentType } from "react";
import { Pressable } from "react-native";

type ReanimatedModule = typeof import("react-native-reanimated");
type AnimatedPressableComponent = ComponentType<Record<string, unknown>>;

let cachedModule: ReanimatedModule | null | undefined;
let cachedAnimatedPressable: AnimatedPressableComponent | null | undefined;
let loadFailed = false;

/**
 * Reanimated requires a dev client rebuilt with the native module linked.
 * Default off so Card/Button fall back to Pressable without touching JSI on load.
 * Set EXPO_PUBLIC_ENABLE_REANIMATED=true after `expo prebuild` + native rebuild.
 */
const REANIMATED_OPT_IN = process.env.EXPO_PUBLIC_ENABLE_REANIMATED === "true";

function loadReanimatedModule(): ReanimatedModule | null {
  if (!REANIMATED_OPT_IN || loadFailed) return null;
  if (cachedModule !== undefined) return cachedModule;

  try {
    const mod = require("react-native-reanimated") as ReanimatedModule;
    if (!mod?.default?.createAnimatedComponent) {
      cachedModule = null;
      return null;
    }
    cachedModule = mod;
    return mod;
  } catch {
    loadFailed = true;
    cachedModule = null;
    return null;
  }
}

export function getHasReanimated(): boolean {
  return Boolean(loadReanimatedModule()?.default);
}

export function getAnimatedPressable() {
  if (cachedAnimatedPressable !== undefined) return cachedAnimatedPressable;

  const mod = loadReanimatedModule();
  if (!mod?.default) {
    cachedAnimatedPressable = null;
    return null;
  }

  cachedAnimatedPressable = mod.default.createAnimatedComponent(Pressable) as AnimatedPressableComponent;
  return cachedAnimatedPressable;
}

export function getUseSharedValue() {
  return loadReanimatedModule()?.useSharedValue ?? null;
}

export function getUseAnimatedStyle() {
  return loadReanimatedModule()?.useAnimatedStyle ?? null;
}

export function getWithTiming() {
  return loadReanimatedModule()?.withTiming ?? null;
}
