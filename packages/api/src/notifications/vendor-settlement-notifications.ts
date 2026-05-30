import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, VendorSettlementRow } from "../database.types";
import { emitInAppNotification } from "./booking-notifications";
import {
  vendorSettlementApprovedCopy,
  vendorSettlementSettledCopy,
  vendorSettlementWaivedCopy,
} from "./notification-copy";

export type VendorSettlementNotificationEventType =
  | "vendor_settlement_approved"
  | "vendor_settlement_settled"
  | "vendor_settlement_waived";

function vendorFinanceHref(): string {
  return "/dashboard/finance";
}

/** Notify partner when admin changes settlement status (in-app + realtime inbox). */
export async function emitVendorSettlementStatusNotification(
  client: SupabaseClient<Database>,
  prev: Pick<VendorSettlementRow, "status" | "kind">,
  next: VendorSettlementRow,
): Promise<void> {
  if (next.status === prev.status) return;

  let eventType: VendorSettlementNotificationEventType | null = null;
  let copy: { title: string; body: string } | null = null;

  if (next.status === "approved" && prev.status === "pending_review") {
    eventType = "vendor_settlement_approved";
    copy = vendorSettlementApprovedCopy(next);
  } else if (next.status === "settled") {
    eventType = "vendor_settlement_settled";
    copy = vendorSettlementSettledCopy(next);
  } else if (next.status === "waived" && next.kind === "cancellation_penalty") {
    eventType = "vendor_settlement_waived";
    copy = vendorSettlementWaivedCopy(next);
  }

  if (!eventType || !copy) return;

  const ref = next.reference_code?.trim() || next.booking_id;

  await emitInAppNotification(client, {
    booking: {
      id: next.booking_id,
      reference_code: ref,
      status: "completed",
      vendor_id: next.vendor_id,
      technician_id: null,
    },
    eventType,
    audience: "vendor",
    recipientVendorId: next.vendor_id,
    title: copy.title,
    body: copy.body,
    href: vendorFinanceHref(),
  });
}
