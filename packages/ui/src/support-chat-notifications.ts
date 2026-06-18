import { Platform } from "react-native";
import { getExpoNotifications } from "./expo-notifications-access";
import {
  parseSupportMessageEvent,
  supportAgentNameFromMessage,
  type SupportMessageRow,
} from "@oorjaman/api";
import {
  ensureSupportChatAndroidChannel,
  initMobileNotificationHandler,
  isSupportChatNotificationData,
  SUPPORT_CHAT_CHANNEL_ID,
  SUPPORT_CHAT_SOUND,
} from "./mobile-notification-handler";

const BRAND = "OorjaMan";

function snippetFromBody(body: string, max = 96): string {
  const trimmed = body.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function previewForMessage(message: SupportMessageRow): {
  title: string;
  body: string;
} {
  const event = parseSupportMessageEvent(message);
  const name = supportAgentNameFromMessage(message) ?? "our team";

  if (event === "agent_joined") {
    return {
      title: `${BRAND} support`,
      body: `${name} has joined your chat - we are here to help with your solar care question.`,
    };
  }
  if (event === "agent_transferred") {
    return {
      title: `${BRAND} support`,
      body: `Your chat was gently handed to ${name}. They have the full context and will continue with care.`,
    };
  }
  if (event === "agent_left_queue") {
    return {
      title: `${BRAND} support`,
      body: "We are connecting you with the next available specialist - thank you for your patience.",
    };
  }

  const snippet = snippetFromBody(message.body);
  return {
    title: `Message from ${BRAND}`,
    body:
      snippet ||
      "You have a new reply in support - tap to read when convenient.",
  };
}

/** Idempotent: notification handler + Android channel for audible support chat. */
export function initSupportChatNotificationHandler(): void {
  initMobileNotificationHandler();
  void ensureSupportChatAndroidChannel();
}

async function presentSupportNotification(
  message: SupportMessageRow,
  data: Record<string, unknown>,
): Promise<void> {
  if (Platform.OS === "web") return;
  const Notifications = getExpoNotifications();
  if (!Notifications) return;
  initSupportChatNotificationHandler();

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.status === "granted";
  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    granted = requested.status === "granted";
  }
  if (!granted) return;

  await ensureSupportChatAndroidChannel();

  const { title, body } = previewForMessage(message);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: SUPPORT_CHAT_SOUND,
      ...(Platform.OS === "android"
        ? {
            android: {
              channelId: SUPPORT_CHAT_CHANNEL_ID,
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
          }
        : {}),
    },
    trigger: null,
  });
}

export function supportMessageNotificationPreview(message: SupportMessageRow): {
  title: string;
  body: string;
} {
  return previewForMessage(message);
}

export async function notifyCustomerSupportMessage(
  message: SupportMessageRow,
): Promise<void> {
  await presentSupportNotification(message, {
    kind: "support_message_customer",
    conversationId: message.conversation_id,
    messageId: message.id,
  });
}

export async function notifyTechnicianSupportMessage(
  message: SupportMessageRow,
): Promise<void> {
  await presentSupportNotification(message, {
    kind: "support_message_technician",
    conversationId: message.conversation_id,
    messageId: message.id,
  });
}

/** Re-export for push tap handling consistency. */
export { isSupportChatNotificationData };
