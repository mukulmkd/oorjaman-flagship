import { useEffect, useRef } from "react";
import type { NotificationResponse } from "expo-notifications";
import { router } from "expo-router";
import { getExpoNotifications, isNativeNotificationsSupported } from "@oorjaman/ui";

const JOB_PUSH_KINDS = new Set([
  "booking_technician_assigned",
  "booking_technician_unassigned",
  "booking_cancelled",
  "booking_rescheduled",
]);

type JobNotificationData = {
  kind?: string;
  bookingId?: string;
};

function readBookingId(data: unknown): string | null {
  if (data == null || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as JobNotificationData;
  if (typeof row.kind !== "string" || !JOB_PUSH_KINDS.has(row.kind)) return null;
  const id = row.bookingId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/** Opens job detail when the technician taps a job lifecycle remote notification. */
export function JobNotificationResponse() {
  const handledColdStartRef = useRef(false);

  useEffect(() => {
    if (!isNativeNotificationsSupported()) return;
    const Notifications = getExpoNotifications();
    if (!Notifications) return;

    const openFromNotification = (response: NotificationResponse | null) => {
      if (!response) return;
      const bookingId = readBookingId(response.notification.request.content.data);
      if (!bookingId) return;
      router.push(`/(main)/jobs/${bookingId}`);
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
