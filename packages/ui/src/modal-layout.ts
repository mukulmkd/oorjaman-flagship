import { colors, fontFamily, fontSize, spacing } from "@oorjaman/config";
import type { TextStyle, ViewStyle } from "react-native";

/** Kicker label for modal / sheet headers (matches tab nav title). */
export const modalKickerTitleStyle: TextStyle = {
  fontFamily: fontFamily.medium,
  fontSize: fontSize.sm,
  color: colors.primary,
  textTransform: "uppercase",
  letterSpacing: 0.6,
};

/** Use on `ScrollView` / `FlatList` `contentContainerStyle` below `useModalStackHeader`. */
export const modalScrollContentStyle: ViewStyle = {
  paddingHorizontal: spacing.md,
  paddingBottom: spacing.xl,
  gap: spacing.md,
};

/** Body copy directly under a modal header when not using a scroll container. */
export const modalBodyInsetStyle: ViewStyle = {
  paddingHorizontal: spacing.md,
  paddingBottom: spacing.md,
};

/**
 * Extra spacing below the status-bar inset when a modal is not wrapped in `Screen` with `SCREEN_EDGES_MODAL`.
 * Prefer `SCREEN_EDGES_MODAL` on `Screen` instead of relying on this constant.
 */
export const MODAL_STACK_HEADER_TOP_PADDING = spacing.md;
