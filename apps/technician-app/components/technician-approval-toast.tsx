import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@oorjaman/config";
import { fontFamily, fontSize } from "../constants/fonts";

const AUTO_DISMISS_MS = 4500;

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function TechnicianApprovalToast({ visible, onDismiss }: Props) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + spacing.sm }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="You're approved. Assigned jobs will appear under Jobs. Dismiss."
        onPress={onDismiss}
        style={({ pressed }) => [styles.toast, pressed && styles.toastPressed]}
      >
        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        <View style={styles.copy}>
          <Text style={styles.title}>You're approved</Text>
          <Text style={styles.body}>Assigned jobs will appear under the Jobs tab.</Text>
        </View>
        <Ionicons name="close" size={18} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 100,
    elevation: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primaryBorder,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  toastPressed: {
    opacity: 0.92,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
});
