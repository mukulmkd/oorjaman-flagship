import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { colors } from "@oorjaman/config";
import { HelpSupportModalBody } from "../components/help-support-modal";
import { useHelpSupport } from "../components/help-support-context";
import { parseSupportChatRouteParams } from "../lib/support-chat-navigation";

export default function SupportChatModalScreen() {
  const params = useLocalSearchParams<{
    subscription_id?: string | string[];
    service_address_id?: string | string[];
    category_slug?: string | string[];
    subcategory_slug?: string | string[];
    conversation_id?: string | string[];
    focus_active_thread?: string | string[];
  }>();
  const { setFocusedThreadId, refreshUnreadCount } = useHelpSupport();

  const context = useMemo(() => parseSupportChatRouteParams(params), [params]);

  return (
    <View style={styles.root}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics ?? undefined}>
        <HelpSupportModalBody
          visible
          presentation="screen"
          context={context}
          onClose={() => router.back()}
          setFocusedThreadId={setFocusedThreadId}
          refreshUnreadCount={refreshUnreadCount}
        />
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
