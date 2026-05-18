import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@oorjaman/config";
import { useHelpSupport } from "./help-support-provider";

/** Header action to open the support chat sheet. */
export function SupportChatHeaderButton() {
  const { openHelp } = useHelpSupport();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Chat with customer support"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={() => openHelp()}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
    >
      <Ionicons name="chatbubbles-outline" size={24} color={colors.primary} />
    </Pressable>
  );
}

/** @deprecated Use {@link SupportChatHeaderButton} */
export const HelpHeaderButton = SupportChatHeaderButton;

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  btnPressed: {
    opacity: 0.65,
  },
});
