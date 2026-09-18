import { Platform, type ViewStyle } from "react-native";
import { colors, spacing } from "@oorjaman/config";

/** True when running Expo / RN Web (not native phone/tablet). */
export const USE_WEB_LAYOUT = Platform.OS === "web";

/** Desktop sidebar shell breakpoint (Universal Web). */
export const WEB_SHELL_MIN_WIDTH = 1024;

/** Logged-in lists / dashboards. */
export const WEB_CONTENT_MAX_WIDTH = 960;

/** Registration, book flow, settings-like forms. */
export const WEB_FORM_MAX_WIDTH = 560;

/** Login / OTP. */
export const WEB_AUTH_MAX_WIDTH = 440;

/** Stack modal sheets on wide browsers. */
export const WEB_MODAL_MAX_WIDTH = 720;

/** Horizontal padding outside constrained columns. */
export const WEB_PAGE_GUTTER = spacing.xl;

export type WebContentVariant = "page" | "form" | "auth";

export function webContentMaxWidth(
  variant: WebContentVariant = "page",
  override?: number,
): number {
  if (override != null) return override;
  switch (variant) {
    case "auth":
      return WEB_AUTH_MAX_WIDTH;
    case "form":
      return WEB_FORM_MAX_WIDTH;
    default:
      return WEB_CONTENT_MAX_WIDTH;
  }
}

/**
 * Column styles for constrained web content. Empty on native.
 * Gutter is opt-in so scaffolds that already pad do not double-space.
 */
export function webContentColumnStyle(
  variant: WebContentVariant = "page",
  options?: { maxWidth?: number; gutter?: number },
): ViewStyle | undefined {
  if (!USE_WEB_LAYOUT) return undefined;
  return {
    width: "100%",
    maxWidth: webContentMaxWidth(variant, options?.maxWidth),
    alignSelf: "center",
    ...(options?.gutter != null ? { paddingHorizontal: options.gutter } : null),
  };
}

/** Soft full-viewport canvas behind Expo web navigators. */
export function webPageCanvasStyle(): ViewStyle | undefined {
  if (!USE_WEB_LAYOUT) return undefined;
  return {
    flex: 1,
    width: "100%",
    backgroundColor: colors.background,
  };
}

/**
 * Stack modal `contentStyle` for web: centered card, not edge-to-edge phone sheet.
 * Merge with existing contentStyle when needed.
 */
export function webModalContentStyle(
  extra?: ViewStyle,
): ViewStyle | undefined {
  if (!USE_WEB_LAYOUT) return extra;
  return {
    flex: 1,
    width: "100%",
    maxWidth: WEB_MODAL_MAX_WIDTH,
    alignSelf: "center",
    marginVertical: spacing.xl,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.background,
    ...extra,
  };
}
