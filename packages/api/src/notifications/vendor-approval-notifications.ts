/**
 * Placeholder hooks for vendor approval/rejection alerts.
 * Swap {@link emitVendorApprovalNotificationPlaceholder} for email, push, or in-app feeds later.
 */

export type VendorApprovalNotificationDecision = "approved" | "rejected";

export type VendorApprovalNotificationPlaceholderPayload = {
  vendorId: string;
  vendorUserId: string;
  decision: VendorApprovalNotificationDecision;
};

const NOTIFICATION_COPY: Record<VendorApprovalNotificationDecision, string> = {
  approved: "Your vendor account has been approved",
  rejected: "Your application was rejected",
};

export type VendorApprovalNotificationPlaceholderRecord = VendorApprovalNotificationPlaceholderPayload & {
  message: string;
  emittedAt: string;
};

/**
 * Placeholder “notification”: records intent for a real channel later.
 * Logs a single structured line (browser console or server logs).
 */
export function emitVendorApprovalNotificationPlaceholder(
  payload: VendorApprovalNotificationPlaceholderPayload,
): VendorApprovalNotificationPlaceholderRecord {
  const record: VendorApprovalNotificationPlaceholderRecord = {
    ...payload,
    message: NOTIFICATION_COPY[payload.decision],
    emittedAt: new Date().toISOString(),
  };

  if (typeof console !== "undefined" && typeof console.info === "function") {
    console.info("[oorjaman:notification:placeholder]", record);
  }

  return record;
}
