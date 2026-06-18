import { useEffect, useRef } from "react";
import type { NotificationResponse } from "expo-notifications";
import { getExpoNotifications, isNativeNotificationsSupported, useHelpSupport } from "@oorjaman/ui";

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

export function SupportNotificationResponse() {
  const { openHelp } = useHelpSupport();
  const handledColdStartRef = useRef(false);

  useEffect(() => {
    if (!isNativeNotificationsSupported()) return;
    const Notifications = getExpoNotifications();
    if (!Notifications) return;

    const openFromNotification = (response: NotificationResponse | null) => {
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
