import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "@oorjaman/config";
import { ModalSheetHeader } from "./ModalSheetHeader";
import { MODAL_STACK_HEADER_TOP_PADDING } from "./modal-layout";

export type ModalStackHeaderBarProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onBack?: () => void;
  closeAccessibilityLabel?: string;
  showClose?: boolean;
  trailing?: ReactNode;
  subtitleNumberOfLines?: number;
};

/** Full-screen stack modal header - same title / subtitle / close layout as support chat sheets. */
export function ModalStackHeaderBar({
  title,
  subtitle,
  onClose,
  onBack,
  closeAccessibilityLabel,
  showClose = true,
  trailing,
  subtitleNumberOfLines,
}: ModalStackHeaderBarProps) {
  return (
    <View style={styles.root}>
      <ModalSheetHeader
        title={title}
        subtitle={subtitle}
        onClose={onClose}
        onBack={onBack}
        closeAccessibilityLabel={closeAccessibilityLabel}
        showClose={showClose}
        trailing={trailing}
        subtitleNumberOfLines={subtitleNumberOfLines}
        stackModal
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexShrink: 0,
    backgroundColor: colors.background,
    paddingTop: MODAL_STACK_HEADER_TOP_PADDING,
  },
});
