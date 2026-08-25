import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamily, fontSize, spacing } from "@oorjaman/config";

export type LoginAuthMethod = "phone" | "email";

export type LoginAuthMethodTabsProps = {
  method: LoginAuthMethod;
  onChange: (method: LoginAuthMethod) => void;
  disabled?: boolean;
};

/** Local/UAT: switch between phone OTP and email/password. */
export function LoginAuthMethodTabs({ method, onChange, disabled }: LoginAuthMethodTabsProps) {
  return (
    <View style={styles.row} accessibilityRole="tablist" accessibilityLabel="Sign-in method">
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: method === "email" }}
        disabled={disabled}
        onPress={() => onChange("email")}
        style={({ pressed }) => [
          styles.tab,
          method === "email" && styles.tabActive,
          pressed && !disabled && styles.tabPressed,
        ]}
      >
        <Text style={[styles.tabLabel, method === "email" && styles.tabLabelActive]}>Email</Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: method === "phone" }}
        disabled={disabled}
        onPress={() => onChange("phone")}
        style={({ pressed }) => [
          styles.tab,
          method === "phone" && styles.tabActive,
          pressed && !disabled && styles.tabPressed,
        ]}
      >
        <Text style={[styles.tabLabel, method === "phone" && styles.tabLabelActive]}>Mobile OTP</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.xs,
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.muted,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.card,
  },
  tabPressed: {
    opacity: 0.9,
  },
  tabLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  tabLabelActive: {
    color: colors.foreground,
  },
});
