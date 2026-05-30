import { StyleSheet, View } from "react-native";
import { ModalCloseButton } from "@oorjaman/ui";
import { spacing } from "@oorjaman/config";
import { SupportChatHeaderButton } from "./help-header-button";

type Props = {
  onClose: () => void;
  closeAccessibilityLabel: string;
  /** When false, only close - use on Jobs stack screens where the tab header already has chat. */
  showSupportChat?: boolean;
};

export function ModalHeaderSupportTrailing({
  onClose,
  closeAccessibilityLabel,
  showSupportChat = true,
}: Props) {
  return (
    <View style={styles.row}>
      {showSupportChat ? <SupportChatHeaderButton /> : null}
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
