import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@oorjaman/config";

type Props = {
  onPress: () => void;
  accessibilityLabel?: string;
};

/** Standard modal dismiss control (matches support chat sheet). */
export function ModalCloseButton({ onPress, accessibilityLabel = "Close" }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={12}
      onPress={onPress}
    >
      <Ionicons name="close" size={26} color={colors.foreground} />
    </Pressable>
  );
}
