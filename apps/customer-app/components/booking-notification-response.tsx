import { useEffect, useRef } from "react";
import type { NotificationResponse } from "expo-notifications";
import { router } from "expo-router";
import { getExpoNotifications, isNativeNotificationsSupported } from "@oorjaman/ui";

const BOOKING_PUSH_KINDS = new Set([
  "booking_confirmed",
  "booking_technician_assigned",
  "booking_technician_en_route",
  "booking_technician_changed",
  "booking_completed",
  "booking_cancelled",
  "booking_rescheduled",
  "booking_accepted",
  "technician_assigned",
  "technician_en_route",
  "job_completed",
  "booking_created",
]);

type BookingNotificationData = {
  kind?: string;
  bookingId?: string;
};

function readBookingId(data: unknown): string | null {
  if (data == null || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as BookingNotificationData;
  if (typeof row.kind !== "string" || !BOOKING_PUSH_KINDS.has(row.kind)) return null;
  const id = row.bookingId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/** Opens booking detail when the user taps a visit lifecycle local or remote notification. */
export function BookingNotificationResponse() {
  const handledColdStartRef = useRef(false);

  useEffect(() => {
    if (!isNativeNotificationsSupported()) return;
    const Notifications = getExpoNotifications();
    if (!Notifications) return;

    const openFromNotification = (response: NotificationResponse | null) => {
      if (!response) return;
      const bookingId = readBookingId(response.notification.request.content.data);
      if (!bookingId) return;
      router.push(`/booking-detail?id=${encodeURIComponent(bookingId)}` as "/booking-detail");
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
