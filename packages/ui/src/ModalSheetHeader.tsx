import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontFamily, fontSize, spacing } from "@oorjaman/config";
import { ModalCloseButton } from "./ModalCloseButton";
import { modalKickerTitleStyle } from "./modal-layout";

type Props = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onBack?: () => void;
  closeAccessibilityLabel?: string;
  /** When false, omits the close control (e.g. mandatory gate sheets). */
  showClose?: boolean;
  trailing?: ReactNode;
  /** Max subtitle lines; omit for unlimited wrap (long plan names, etc.). */
  subtitleNumberOfLines?: number;
  /** Tighter spacing when rendered inside a stack modal header bar. */
  stackModal?: boolean;
};

/** Bottom-sheet header row: optional back, title block, close (support-chat style). */
export function ModalSheetHeader({
  title,
  subtitle,
  onClose,
  onBack,
  closeAccessibilityLabel,
  showClose = true,
  trailing,
  subtitleNumberOfLines,
  stackModal = false,
}: Props) {
  return (
    <View
      style={[
        styles.wrap,
        stackModal ? styles.wrapStackModal : null,
        subtitle ? styles.wrapWithSubtitle : null,
      ]}
    >
      <View style={styles.leading}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </Pressable>
        ) : null}
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={styles.subtitle}
              {...(subtitleNumberOfLines != null ? { numberOfLines: subtitleNumberOfLines } : {})}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {trailing ??
        (showClose ? (
          <ModalCloseButton onPress={onClose} accessibilityLabel={closeAccessibilityLabel} />
        ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    marginBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  wrapStackModal: {
    paddingTop: 0,
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
  },
  wrapWithSubtitle: {
    alignItems: "flex-start",
  },
  leading: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  titles: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 4,
  },
  backBtn: {
    marginRight: 2,
  },
  title: {
    ...modalKickerTitleStyle,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
    marginTop: 2,
    flexShrink: 1,
  },
});
