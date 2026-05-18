export type TechnicianInviteChannel = "email" | "sms" | "whatsapp";

export type TechnicianInviteNotificationPayload = {
  inviteId: string;
  vendorId: string;
  phoneE164: string;
  email?: string | null;
  inviteUrl: string;
  channels: TechnicianInviteChannel[];
};

export type TechnicianInviteNotificationRecord = TechnicianInviteNotificationPayload & {
  emittedAt: string;
  message: string;
};

/**
 * Placeholder delivery hook for vendor-triggered technician onboarding invite notifications.
 * Replace this with real provider integrations (Email / SMS / WhatsApp) in production.
 */
export function emitTechnicianInviteNotificationPlaceholder(
  payload: TechnicianInviteNotificationPayload,
): TechnicianInviteNotificationRecord {
  const record: TechnicianInviteNotificationRecord = {
    ...payload,
    emittedAt: new Date().toISOString(),
    message: "Technician onboarding invite dispatched.",
  };
  if (typeof console !== "undefined" && typeof console.info === "function") {
    console.info("[oorjaman:notification:technician-invite]", record);
  }
  return record;
}
