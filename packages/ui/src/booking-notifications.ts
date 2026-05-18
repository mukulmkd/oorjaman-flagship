import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const CHANNEL_ID = "booking-events";

let handlerInstalled = false;
let androidChannelReady = false;

/**
 * Call once at app root. Required so local notifications show while the app is in the foreground.
 */
export function initBookingNotificationHandler(): void {
  if (Platform.OS === "web" || handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android" || androidChannelReady) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Booking updates",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
  });
  androidChannelReady = true;
}

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  initBookingNotificationHandler();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === "granted") {
    await ensureAndroidChannel();
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  if (requested.status !== "granted") return false;
  await ensureAndroidChannel();
  return true;
}

async function presentImmediate(
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (Platform.OS === "web") return;
  const ok = await ensurePermission();
  if (!ok) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      ...(Platform.OS === "android" ? { android: { channelId: CHANNEL_ID } } : {}),
    },
    trigger: null,
  });
}

export async function notifyCustomerBookingCreated(bookingId: string): Promise<void> {
  await presentImmediate(
    "Booking created",
    "Your visit is confirmed and payment succeeded.",
    { kind: "booking_created", bookingId },
  );
}

export async function notifyCustomerBookingAccepted(bookingId: string): Promise<void> {
  await presentImmediate(
    "Booking accepted",
    "Your partner accepted this visit.",
    { kind: "booking_accepted", bookingId },
  );
}

export async function notifyCustomerPartnerAcknowledged(bookingId: string): Promise<void> {
  await presentImmediate(
    "Partner accepted",
    "Your partner accepted this visit. We will assign a technician shortly.",
    { kind: "partner_acknowledged", bookingId },
  );
}

export async function notifyCustomerTechnicianAssigned(bookingId: string): Promise<void> {
  await presentImmediate(
    "Technician assigned",
    "A technician is assigned to your booking.",
    { kind: "technician_assigned", bookingId },
  );
}

export async function notifyCustomerJobCompleted(bookingId: string): Promise<void> {
  await presentImmediate(
    "Visit completed",
    "Your cleaning visit is marked complete.",
    { kind: "job_completed", bookingId },
  );
}

/** Vendor confirms acceptance from the partner inbox (same app binary as customer). */
export async function notifyVendorBookingAccepted(bookingId: string): Promise<void> {
  await presentImmediate(
    "Booking accepted",
    "You accepted the request and assigned a technician.",
    { kind: "booking_accepted_vendor", bookingId },
  );
}

/** Partner accepted without assigning crew - admin assigns technician. */
export async function notifyVendorBookingAcknowledged(bookingId: string): Promise<void> {
  await presentImmediate(
    "Booking accepted",
    "You accepted this request. OorjaMan operations will assign a technician.",
    { kind: "booking_acknowledged_vendor", bookingId },
  );
}

export async function notifyTechnicianJobCompleted(bookingId: string): Promise<void> {
  await presentImmediate(
    "Job completed",
    "Report saved - booking marked complete.",
    { kind: "job_completed_technician", bookingId },
  );
}
