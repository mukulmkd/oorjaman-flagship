import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AmcWalletEntryRow,
  AmcWalletRow,
  BookingRow,
  Database,
  SubscriptionRow,
  VendorSettlementRow,
} from "../database.types";
import { SupabaseApiError, takeRows, takeSingleRow } from "../result";

export function computeAmcPerVisitAllocPaise(
  subscription: Pick<SubscriptionRow, "amount_cents" | "visits_included">,
): number {
  const total = Math.max(0, Math.round(subscription.amount_cents));
  const visits = Math.max(1, subscription.visits_included ?? 1);
  return Math.max(0, Math.round(total / visits));
}

export async function ensureAmcWalletForSubscription(
  client: SupabaseClient<Database>,
  subscription: Pick<
    SubscriptionRow,
    "id" | "customer_id" | "amount_cents" | "visits_included" | "currency" | "assigned_vendor_id"
  >,
): Promise<AmcWalletRow> {
  const { data: existing } = await client
    .from("amc_wallets")
    .select("*")
    .eq("subscription_id", subscription.id)
    .maybeSingle();

  if (existing) return existing as AmcWalletRow;

  const perVisit = computeAmcPerVisitAllocPaise(subscription);
  const row: Database["public"]["Tables"]["amc_wallets"]["Insert"] = {
    subscription_id: subscription.id,
    customer_id: subscription.customer_id,
    assigned_vendor_id: subscription.assigned_vendor_id,
    per_visit_alloc_paise: perVisit,
    visits_allocated: subscription.visits_included ?? 0,
    currency: subscription.currency ?? "INR",
    status: "pending_funding",
  };

  const { data, error } = await client.from("amc_wallets").insert(row).select("*").single();
  return takeSingleRow(data, error) as AmcWalletRow;
}

export async function getAmcWalletBySubscriptionId(
  client: SupabaseClient<Database>,
  subscriptionId: string,
): Promise<AmcWalletRow | null> {
  const { data, error } = await client
    .from("amc_wallets")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  return data as AmcWalletRow | null;
}

export async function listAmcWalletEntries(
  client: SupabaseClient<Database>,
  walletId: string,
  options?: { limit?: number },
): Promise<AmcWalletEntryRow[]> {
  const limit = Math.min(200, Math.max(1, options?.limit ?? 50));
  const { data, error } = await client
    .from("amc_wallet_entries")
    .select("*")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return takeRows(data, error) as AmcWalletEntryRow[];
}

export type AmcWalletAdminRow = AmcWalletRow & {
  subscription: Pick<SubscriptionRow, "plan_name" | "status" | "ends_at"> | null;
};

export async function adminListAmcWallets(
  client: SupabaseClient<Database>,
  options?: { status?: AmcWalletRow["status"]; limit?: number },
): Promise<AmcWalletAdminRow[]> {
  const limit = Math.min(500, Math.max(1, options?.limit ?? 200));
  let q = client.from("amc_wallets").select("*").order("created_at", { ascending: false }).limit(limit);
  if (options?.status) q = q.eq("status", options.status);
  const { data, error } = await q;
  const wallets = takeRows(data, error) as AmcWalletRow[];
  if (wallets.length === 0) return [];

  const subscriptionIds = [...new Set(wallets.map((w) => w.subscription_id))];
  const { data: subs, error: subErr } = await client
    .from("subscriptions")
    .select("id, plan_name, status, ends_at")
    .in("id", subscriptionIds);
  if (subErr) throw new SupabaseApiError(subErr.message, subErr);

  const subById = new Map<string, Pick<SubscriptionRow, "plan_name" | "status" | "ends_at">>();
  for (const s of subs ?? []) {
    subById.set(s.id, {
      plan_name: s.plan_name,
      status: s.status,
      ends_at: s.ends_at,
    });
  }

  return wallets.map((wallet) => ({
    ...wallet,
    subscription: subById.get(wallet.subscription_id) ?? null,
  }));
}

export async function adminAssignAmcSubscriptionVendor(
  client: SupabaseClient<Database>,
  subscriptionId: string,
  vendorId: string,
  options?: { reassignOpenBookings?: boolean },
): Promise<SubscriptionRow> {
  const { data, error } = await client.rpc("admin_assign_amc_subscription_vendor", {
    p_subscription_id: subscriptionId,
    p_vendor_id: vendorId,
    p_reassign_open_bookings: options?.reassignOpenBookings ?? true,
  });
  if (error) throw new SupabaseApiError(error.message, error);
  return data as SubscriptionRow;
}

export async function fundAmcWalletFromPayment(
  client: SupabaseClient<Database>,
  params: { subscriptionId: string; paymentId: string; amountPaise: number },
): Promise<AmcWalletRow> {
  const { data, error } = await client.rpc("fund_amc_wallet_from_payment", {
    p_subscription_id: params.subscriptionId,
    p_payment_id: params.paymentId,
    p_amount_paise: params.amountPaise,
  });
  if (error) throw new SupabaseApiError(error.message, error);
  return data as AmcWalletRow;
}

/** Release one visit allocation from the AMC wallet (security definer RPC). */
export async function releaseAmcWalletVisitPayout(
  client: SupabaseClient<Database>,
  booking: Pick<BookingRow, "id" | "subscription_id" | "vendor_id" | "status">,
): Promise<VendorSettlementRow | null> {
  if (booking.status !== "completed" || !booking.vendor_id || !booking.subscription_id) {
    return null;
  }

  const { data, error } = await client.rpc("release_amc_wallet_visit_payout", {
    p_booking_id: booking.id,
  });
  if (error) throw new SupabaseApiError(error.message, error);
  return data as VendorSettlementRow;
}
