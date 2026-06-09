import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

type AmcNotificationData = {
  kind?: string;
  subscriptionId?: string;
  serviceAddressId?: string;
};

function readAmcNotificationTarget(data: unknown): { subscriptionId: string; serviceAddressId: string | null } | null {
  if (data == null || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as AmcNotificationData;
  if (row.kind !== "amc_partner_assigned") return null;
  const subscriptionId = row.subscriptionId;
  if (typeof subscriptionId !== "string" || !subscriptionId.trim()) return null;
  const serviceAddressId =
    typeof row.serviceAddressId === "string" && row.serviceAddressId.trim()
      ? row.serviceAddressId.trim()
      : null;
  return { subscriptionId: subscriptionId.trim(), serviceAddressId };
}

/** Opens the AMC tab when the user taps an AMC partner-assigned notification. */
export function AmcNotificationResponse() {
  const handledColdStartRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const openFromNotification = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const target = readAmcNotificationTarget(response.notification.request.content.data);
      if (!target) return;
      if (target.serviceAddressId) {
        router.push(
          `/(main)/subscription?addressId=${encodeURIComponent(target.serviceAddressId)}` as "/(main)/subscription",
        );
        return;
      }
      router.push("/(main)/subscription");
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(openFromNotification);

    if (!handledColdStartRef.current) {
      handledColdStartRef.current = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        openFromNotification(response);
      });
    }

    return () => subscription.remove();
  }, []);

  return null;
}
