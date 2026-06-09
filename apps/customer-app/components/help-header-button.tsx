import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSegments } from "expo-router";
import { colors } from "@oorjaman/config";
import { isRootModalRoute, openSupportChat } from "../lib/support-chat-navigation";
import { useHelpSupport } from "./help-support-context";

/** Header action to open the support chat sheet. */
export function SupportChatHeaderButton() {
  const segments = useSegments();
  const { openHelp, unreadCount } = useHelpSupport();
  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);
  const onModalStack = isRootModalRoute(segments);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0
          ? `Chat with customer support, ${unreadCount} unread`
          : "Chat with customer support"
      }
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={() => {
        const ctx = unreadCount > 0 ? { focus_active_thread: true as const } : undefined;
        if (onModalStack) {
          openSupportChat(ctx);
          return;
        }
        openHelp(ctx);
      }}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
    >
      <Ionicons name="chatbubbles-outline" size={24} color={colors.primary} />
      {unreadCount > 0 ? (
        <View
          style={styles.badge}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.badgeText} pointerEvents="none">
            {badgeLabel}
          </Text>
        </View>
      ) : null}
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
  badge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.destructive,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: {
    color: colors.destructiveForeground,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
});
