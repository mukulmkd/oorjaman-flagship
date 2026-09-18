import {
  initBookingNotificationHandler,
  initSupportChatNotificationHandler,
} from "@oorjaman/ui";

/** Native: install foreground notification handlers. */
export function initAppNotificationHandlers(): void {
  initBookingNotificationHandler();
  initSupportChatNotificationHandler();
}
