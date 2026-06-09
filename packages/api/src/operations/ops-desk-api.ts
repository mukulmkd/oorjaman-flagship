import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminGetBookingMonitoringRows,
  readBookingServiceOtpMeta,
} from "../bookings/booking-api";
import type { Database, SubscriptionRow } from "../database.types";
import { adminCountNotificationEvents } from "../notifications/notification-events-api";
import { SupabaseApiError, takeRows } from "../result";

export type OpsAmcAwaitingPartnerRow = {
  subscription_id: string;
  plan_name: string;
  customer_id: string;
  customer_label: string | null;
  service_address_id: string | null;
  visits_included: number | null;
  funded_at: string | null;
  wallet_id: string;
};

export type OpsDeskSummary = {
  bookingExceptionsActionable: number;
  onsiteBlocked: number;
  amcAwaitingPartner: number;
  notificationsFailed24h: number;
};

function countOtpRiskFromMonitor(
  rows: Awaited<ReturnType<typeof adminGetBookingMonitoringRows>>,
): number {
  let n = 0;
  for (const row of rows) {
    const otp = readBookingServiceOtpMeta(row.metadata);
    const locked = Boolean(otp.startLockedUntil || otp.happyLockedUntil);
    const mismatches = otp.startFailCount + otp.happyFailCount;
    if (locked || mismatches >= 2) n += 1;
  }
  return n;
}

export async function adminListAmcAwaitingPartnerAssignments(
  client: SupabaseClient<Database>,
  options?: { limit?: number },
): Promise<OpsAmcAwaitingPartnerRow[]> {
  const limit = Math.min(200, Math.max(1, options?.limit ?? 100));
  const { data: subs, error: subErr } = await client
    .from("subscriptions")
    .select(
      "id, plan_name, customer_id, service_address_id, visits_included, assigned_vendor_id, status",
    )
    .eq("status", "active")
    .is("assigned_vendor_id", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (subErr) throw new SupabaseApiError(subErr.message, subErr);
  const candidates = (subs ?? []) as Pick<
    SubscriptionRow,
    | "id"
    | "plan_name"
    | "customer_id"
    | "service_address_id"
    | "visits_included"
    | "assigned_vendor_id"
    | "status"
  >[];
  if (candidates.length === 0) return [];

  const subIds = candidates.map((s) => s.id);
  const { data: wallets, error: walletErr } = await client
    .from("amc_wallets")
    .select("id, subscription_id, status, funded_at")
    .in("subscription_id", subIds)
    .eq("status", "funded");
  if (walletErr) throw new SupabaseApiError(walletErr.message, walletErr);

  const walletBySub = new Map(
    (wallets ?? []).map((w) => [w.subscription_id, w] as const),
  );
  const fundedSubs = candidates.filter((s) => walletBySub.has(s.id));
  if (fundedSubs.length === 0) return [];

  const customerIds = [...new Set(fundedSubs.map((s) => s.customer_id))];
  const { data: customers, error: custErr } = await client
    .from("customers")
    .select("id, display_name")
    .in("id", customerIds);
  if (custErr) throw new SupabaseApiError(custErr.message, custErr);
  const customerNameById = new Map(
    (customers ?? []).map((c) => [c.id, c.display_name?.trim() || null] as const),
  );

  return fundedSubs.map((sub) => {
    const wallet = walletBySub.get(sub.id)!;
    return {
      subscription_id: sub.id,
      plan_name: sub.plan_name,
      customer_id: sub.customer_id,
      customer_label: customerNameById.get(sub.customer_id) ?? null,
      service_address_id: sub.service_address_id,
      visits_included: sub.visits_included,
      funded_at: wallet.funded_at,
      wallet_id: wallet.id,
    };
  });
}

export async function adminFetchOpsDeskSummary(
  client: SupabaseClient<Database>,
): Promise<OpsDeskSummary> {
  const nowIso = new Date().toISOString();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    actionableRes,
    amcRows,
    failedNotifs,
    monitorRows,
  ] = await Promise.all([
    client
      .from("ops_booking_exceptions")
      .select("booking_id", { count: "exact", head: true })
      .gte("scheduled_end", nowIso),
    adminListAmcAwaitingPartnerAssignments(client, { limit: 200 }),
    adminCountNotificationEvents(client, { status: "failed", sinceIso: since24h }),
    adminGetBookingMonitoringRows(client, "all", { limit: 500 }),
  ]);

  if (actionableRes.error) {
    throw new SupabaseApiError(actionableRes.error.message, actionableRes.error);
  }

  return {
    bookingExceptionsActionable: actionableRes.count ?? 0,
    onsiteBlocked: countOtpRiskFromMonitor(monitorRows),
    amcAwaitingPartner: amcRows.length,
    notificationsFailed24h: failedNotifs,
  };
}

/** Recent failed notification events for platform health surfaces. */
export async function adminListRecentFailedNotificationEvents(
  client: SupabaseClient<Database>,
  options?: { limit?: number; sinceHours?: number },
) {
  const limit = Math.min(100, Math.max(1, options?.limit ?? 40));
  const hours = Math.max(1, options?.sinceHours ?? 168);
  const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from("notification_events")
    .select("*")
    .eq("status", "failed")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);
  return takeRows(data, error);
}
