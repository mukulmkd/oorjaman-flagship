import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useHelpSupport } from "./help-support-context";

type SupportNotificationData = {
  kind?: string;
  conversationId?: string;
};

function readSupportConversationId(data: unknown): string | null {
  if (data == null || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as SupportNotificationData;
  if (row.kind !== "support_message") return null;
  const id = row.conversationId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/** Opens the support chat sheet when the user taps a support local or remote notification. */
export function SupportNotificationResponse() {
  const { openHelp } = useHelpSupport();
  const handledColdStartRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const openFromNotification = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const conversationId = readSupportConversationId(
        response.notification.request.content.data,
      );
      if (!conversationId) return;
      openHelp({ conversation_id: conversationId });
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(openFromNotification);

    if (!handledColdStartRef.current) {
      handledColdStartRef.current = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        openFromNotification(response);
      });
    }

    return () => subscription.remove();
  }, [openHelp]);

  return null;
}
