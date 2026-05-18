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
 * Fixed top inset for stack-presented modals (`presentation: "modal"`).
 * Do not use `safeArea.top` here — iOS modals often report the full status-bar inset and
 * the sheet chrome already clears it, which doubles the gap above the kicker title.
 */
export const MODAL_STACK_HEADER_TOP_PADDING = spacing.md;
