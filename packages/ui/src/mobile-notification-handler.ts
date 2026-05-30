import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

/** Bundled in customer/technician app via expo-notifications plugin `sounds`. */
export const SUPPORT_CHAT_SOUND = "chat_message.wav";
export const SUPPORT_CHAT_CHANNEL_ID = "support-chat";

let handlerInstalled = false;
let supportChannelReady = false;

export function isSupportChatNotificationData(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const kind = (data as Record<string, unknown>).kind;
  return (
    kind === "support_message" ||
    kind === "support_message_customer" ||
    kind === "support_message_technician"
  );
}

/**
 * Foreground presentation + sound policy for local and remote notifications.
 * Call once at app root (customer + technician).
 */
export function initMobileNotificationHandler(): void {
  if (Platform.OS === "web" || handlerInstalled) return;
  handlerInstalled = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const playChatSound = isSupportChatNotificationData(notification.request.content.data);
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: playChatSound,
        shouldSetBadge: false,
      };
    },
  });
}

/** Android channel for support chat (local + Expo push `channelId: support-chat`). */
export async function ensureSupportChatAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android" || supportChannelReady) return;

  await Notifications.setNotificationChannelAsync(SUPPORT_CHAT_CHANNEL_ID, {
    name: "Support chat",
    description: "Messages from OorjaMan support",
    importance: Notifications.AndroidImportance.HIGH,
    sound: SUPPORT_CHAT_SOUND,
    enableVibrate: true,
    vibrationPattern: [0, 100, 80, 100],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  supportChannelReady = true;
}
