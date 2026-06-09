import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SubscriptionRow } from "../database.types";
import { SupabaseApiError } from "../result";
import { BRAND } from "./notification-copy";

export type AdminAmcNotificationEventType = "admin_amc_awaiting_partner";

export type AmcInAppNotificationPayload = {
  reference_code: string | null;
  booking_id: string | null;
  subscription_id: string;
  title: string;
  body: string;
  href: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  technician_id: string | null;
  technician_name: string | null;
  status: string | null;
  emitted_at: string;
  note: string | null;
};

function adminAmcContractsHref(subscriptionId: string): string {
  return `/dashboard/finance/amc-contracts?highlight=${encodeURIComponent(subscriptionId)}`;
}

export function adminAmcAwaitingPartnerCopy(
  subscription: Pick<SubscriptionRow, "plan_name" | "id">,
): { title: string; body: string } {
  const plan = subscription.plan_name?.trim() || "AMC plan";
  return {
    title: "New AMC - assign partner",
    body: `${plan} is paid and active. Assign a dedicated partner from Finance → AMC contracts.`,
  };
}

export async function emitAdminAmcAwaitingPartnerNotification(
  client: SupabaseClient<Database>,
  subscription: Pick<SubscriptionRow, "id" | "plan_name">,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const copy = adminAmcAwaitingPartnerCopy(subscription);
  const payload: AmcInAppNotificationPayload = {
    reference_code: null,
    booking_id: null,
    subscription_id: subscription.id,
    title: copy.title,
    body: copy.body,
    href: adminAmcContractsHref(subscription.id),
    vendor_id: null,
    vendor_name: null,
    technician_id: null,
    technician_name: null,
    status: "active",
    emitted_at: nowIso,
    note: null,
  };

  const row: Database["public"]["Tables"]["notification_events"]["Insert"] = {
    booking_id: null,
    recipient_audience: "admin",
    recipient_vendor_id: null,
    event_type: "admin_amc_awaiting_partner",
    channels: ["in_app"] as unknown as Database["public"]["Tables"]["notification_events"]["Insert"]["channels"],
    status: "sent",
    processed_at: nowIso,
    payload: payload as unknown as Database["public"]["Tables"]["notification_events"]["Insert"]["payload"],
  };

  const { error } = await client.from("notification_events").insert(row);
  if (error) throw new SupabaseApiError(error.message, error);
}

export function customerAmcPartnerAssignedCopy(
  subscription: Pick<SubscriptionRow, "plan_name">,
  vendorName?: string | null,
): { title: string; body: string } {
  const plan = subscription.plan_name?.trim() || "AMC plan";
  const partner = vendorName?.trim() || "your dedicated partner";
  return {
    title: `${BRAND} - AMC partner assigned`,
    body: `${partner} is assigned to ${plan}. Open the app to schedule your included visits.`,
  };
}
