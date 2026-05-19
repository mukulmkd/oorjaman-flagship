import { StyleSheet, View } from "react-native";
import { ModalCloseButton } from "@oorjaman/ui";
import { spacing } from "@oorjaman/config";
import { SupportChatHeaderButton } from "./help-header-button";

type Props = {
  onClose: () => void;
  closeAccessibilityLabel: string;
};

export function ModalHeaderSupportTrailing({ onClose, closeAccessibilityLabel }: Props) {
  return (
    <View style={styles.row}>
      <SupportChatHeaderButton />
      <ModalCloseButton onPress={onClose} accessibilityLabel={closeAccessibilityLabel} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
});
