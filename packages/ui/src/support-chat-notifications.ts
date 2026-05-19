import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import {
  parseSupportMessageEvent,
  supportAgentNameFromMessage,
  type SupportMessageRow,
} from "@oorjaman/api";

const CHANNEL_ID = "support-messages";
const BRAND = "OorjaMan";

let handlerInstalled = false;
let androidChannelReady = false;

function snippetFromBody(body: string, max = 96): string {
  const trimmed = body.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function previewForMessage(message: SupportMessageRow): { title: string; body: string } {
  const event = parseSupportMessageEvent(message);
  const name = supportAgentNameFromMessage(message) ?? "our team";

  if (event === "agent_joined") {
    return {
      title: `${BRAND} support`,
      body: `${name} has joined your chat — we are here to help with your solar care question.`,
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
      body: "We are connecting you with the next available specialist — thank you for your patience.",
    };
  }

  const snippet = snippetFromBody(message.body);
  return {
    title: `Message from ${BRAND}`,
    body: snippet || "You have a new reply in support — tap to read when convenient.",
  };
}

function initHandler(): void {
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
    name: "OorjaMan support",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  androidChannelReady = true;
}

async function presentSupportNotification(
  message: SupportMessageRow,
  data: Record<string, unknown>,
): Promise<void> {
  if (Platform.OS === "web") return;
  initHandler();
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.status === "granted";
  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.status === "granted";
  }
  if (!granted) return;
  await ensureAndroidChannel();

  const { title, body } = previewForMessage(message);
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

export function supportMessageNotificationPreview(message: SupportMessageRow): {
  title: string;
  body: string;
} {
  return previewForMessage(message);
}

export async function notifyCustomerSupportMessage(message: SupportMessageRow): Promise<void> {
  await presentSupportNotification(message, {
    kind: "support_message_customer",
    conversationId: message.conversation_id,
    messageId: message.id,
  });
}

export async function notifyTechnicianSupportMessage(message: SupportMessageRow): Promise<void> {
  await presentSupportNotification(message, {
    kind: "support_message_technician",
    conversationId: message.conversation_id,
    messageId: message.id,
  });
}
