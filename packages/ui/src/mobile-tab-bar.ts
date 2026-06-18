import { Platform, type ViewStyle } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";

/** Icon + label row inside React Navigation bottom tabs (excludes home-indicator inset). */
const TAB_BAR_BASE_HEIGHT = Platform.OS === "ios" ? 49 : 56;

/** Minimum bottom inset when Android reports 0 under edge-to-edge (gesture bar overlap). */
const ANDROID_MIN_TAB_INSET = 12;

export function mobileTabBarInsets(insets: EdgeInsets): { paddingBottom: number; height: number } {
  const paddingBottom = Math.max(
    insets.bottom,
    Platform.OS === "android" ? ANDROID_MIN_TAB_INSET : 6,
  );
  return {
    paddingBottom,
    height: TAB_BAR_BASE_HEIGHT + paddingBottom,
  };
}

export function mobileTabBarStyle(
  insets: EdgeInsets,
  extra?: Pick<ViewStyle, "borderTopColor" | "backgroundColor">,
): ViewStyle {
  const { paddingBottom, height } = mobileTabBarInsets(insets);
  return {
    borderTopColor: extra?.borderTopColor,
    backgroundColor: extra?.backgroundColor,
    paddingTop: 4,
    paddingBottom,
    height,
  };
}
