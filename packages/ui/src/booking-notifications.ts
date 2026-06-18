import { Platform } from "react-native";
import { getExpoNotifications } from "./expo-notifications-access";
import { initMobileNotificationHandler } from "./mobile-notification-handler";

const CHANNEL_ID = "booking-events";
const BRAND = "OorjaMan";

let androidChannelReady = false;

/**
 * Call once at app root. Installs shared handler (support chat plays sound; booking updates are silent).
 */
export function initBookingNotificationHandler(): void {
  initMobileNotificationHandler();
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android" || androidChannelReady) return;
  const Notifications = getExpoNotifications();
  if (!Notifications) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "OorjaMan visit updates",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
  });
  androidChannelReady = true;
}

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const Notifications = getExpoNotifications();
  if (!Notifications) return false;
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
  const Notifications = getExpoNotifications();
  if (!Notifications) return;
  const ok = await ensurePermission();
  if (!ok) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      ...(Platform.OS === "android"
        ? { android: { channelId: CHANNEL_ID } }
        : {}),
    },
    trigger: null,
  });
}

export async function notifyCustomerBookingCreated(
  bookingId: string,
): Promise<void> {
  await presentImmediate(
    `${BRAND} - visit confirmed`,
    "Thank you. Your payment went through and your solar care visit is booked. We will keep you posted as your partner and technician are assigned.",
    { kind: "booking_created", bookingId },
  );
}

export async function notifyCustomerBookingAccepted(
  bookingId: string,
): Promise<void> {
  await presentImmediate(
    "Your partner is on it",
    "Your OorjaMan partner accepted this visit. You can track progress anytime in the app.",
    { kind: "booking_accepted", bookingId },
  );
}

export async function notifyCustomerPartnerAcknowledged(
  bookingId: string,
): Promise<void> {
  await presentImmediate(
    "Partner confirmed",
    "Your partner accepted the visit. Our operations team will assign a technician shortly - we appreciate your patience.",
    { kind: "partner_acknowledged", bookingId },
  );
}

export async function notifyCustomerTechnicianAssigned(
  bookingId: string,
): Promise<void> {
  await presentImmediate(
    "Technician assigned",
    "Your technician is assigned. Open the booking to see their name and contact details.",
    { kind: "technician_assigned", bookingId },
  );
}

export async function notifyCustomerTechnicianEnRoute(
  bookingId: string,
): Promise<void> {
  await presentImmediate(
    "Technician on the way",
    "Your technician is heading to your site. Open the booking to track live location.",
    { kind: "technician_en_route", bookingId },
  );
}

export async function notifyCustomerJobCompleted(
  bookingId: string,
): Promise<void> {
  await presentImmediate(
    "Visit complete - thank you",
    "Your panel care visit is done. If anything felt less than perfect, please tell us in the app - your feedback helps us serve your home better.",
    { kind: "job_completed", bookingId },
  );
}

export async function notifyCustomerAmcPartnerAssigned(
  subscriptionId: string,
  vendorName?: string | null,
): Promise<void> {
  const partner = vendorName?.trim() || "Your dedicated partner";
  await presentImmediate(
    `${BRAND} - AMC partner assigned`,
    `${partner} is assigned to your AMC plan. Open the app to schedule your included visits.`,
    { kind: "amc_partner_assigned", subscriptionId },
  );
}

/** Vendor confirms acceptance from the partner inbox (same app binary as customer). */
export async function notifyVendorBookingAccepted(
  bookingId: string,
): Promise<void> {
  await presentImmediate(
    "Visit accepted",
    "You accepted this OorjaMan request and assigned your crew. The homeowner will be notified - thank you for showing up for them.",
    { kind: "booking_accepted_vendor", bookingId },
  );
}

/** Partner accepted without assigning crew - admin assigns technician. */
export async function notifyVendorBookingAcknowledged(
  bookingId: string,
): Promise<void> {
  await presentImmediate(
    "Accepted - crew assignment pending",
    "You accepted this visit. OorjaMan operations will assign a technician and confirm timing with the customer.",
    { kind: "booking_acknowledged_vendor", bookingId },
  );
}

export async function notifyTechnicianJobCompleted(
  bookingId: string,
): Promise<void> {
  await presentImmediate(
    "Report saved - well done",
    "The visit is marked complete on OorjaMan. Thank you for the care you brought to this home.",
    { kind: "job_completed_technician", bookingId },
  );
}
