import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CustomerOorjamanCreditGrantRow,
  Database,
} from "../database.types";
import type { OorjamanCreditsRedemptionPlan } from "./customer-credits-policy";
import {
  creditsToPaise,
  planOorjamanCreditsRedemption,
  VENDOR_LAST_HOUR_CANCEL_CUSTOMER_CREDITS,
} from "./customer-credits-policy";
import { SupabaseApiError, takeRows, takeSingleRow } from "../result";

export type CustomerOorjamanCreditsSummary = {
  balance_credits: number;
  balance_paise: number;
  active_grants: CustomerOorjamanCreditGrantRow[];
};

async function resolveCustomerIdForSession(
  client: SupabaseClient<Database>,
  customerId?: string,
): Promise<string> {
  const cid = customerId?.trim();
  if (cid) return cid;

  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const uid = userData.user?.id;
  if (!uid) throw new SupabaseApiError("Customer profile required.");

  const { data, error } = await client
    .from("customers")
    .select("id")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  if (!data?.id) throw new SupabaseApiError("Customer profile required.");
  return data.id;
}

export async function listCustomerOorjamanCreditGrants(
  client: SupabaseClient<Database>,
  customerId?: string,
): Promise<CustomerOorjamanCreditGrantRow[]> {
  const cid = await resolveCustomerIdForSession(client, customerId);
  const { data, error } = await client
    .from("customer_oorjaman_credit_grants")
    .select("*")
    .eq("customer_id", cid)
    .order("expires_at", { ascending: true })
    .order("issued_at", { ascending: true });
  return takeRows(data, error);
}

export async function getCustomerOorjamanCreditsSummary(
  client: SupabaseClient<Database>,
): Promise<CustomerOorjamanCreditsSummary> {
  const grants = await listCustomerOorjamanCreditGrants(client);
  const nowMs = Date.now();
  const active = grants.filter(
    (g) =>
      g.credits_remaining > 0 &&
      new Date(g.expires_at).getTime() > nowMs,
  );
  const balanceCredits = active.reduce((sum, g) => sum + g.credits_remaining, 0);
  return {
    balance_credits: balanceCredits,
    balance_paise: creditsToPaise(balanceCredits),
    active_grants: active,
  };
}

export async function issueVendorLastHourCancelCredits(
  client: SupabaseClient<Database>,
  input: {
    customer_id: string;
    source_booking_id: string;
    credits?: number;
  },
): Promise<CustomerOorjamanCreditGrantRow> {
  const credits = input.credits ?? VENDOR_LAST_HOUR_CANCEL_CUSTOMER_CREDITS;

  const { data, error } = await client.rpc("issue_vendor_last_hour_cancel_credits", {
    p_customer_id: input.customer_id,
    p_source_booking_id: input.source_booking_id,
    p_credits: credits,
  });
  if (error) throw new SupabaseApiError(error.message, error);
  return data as CustomerOorjamanCreditGrantRow;
}

export async function redeemCustomerOorjamanCredits(
  client: SupabaseClient<Database>,
  input: {
    customer_id: string;
    booking_id: string;
    payment_id?: string | null;
    payable_paise: number;
  },
): Promise<{ plan: OorjamanCreditsRedemptionPlan }> {
  const { data, error } = await client.rpc("redeem_customer_oorjaman_credits", {
    p_customer_id: input.customer_id,
    p_booking_id: input.booking_id,
    p_payment_id: input.payment_id ?? null,
    p_payable_paise: Math.max(0, Math.round(input.payable_paise)),
  });
  if (error) throw new SupabaseApiError(error.message, error);
  const row = (data ?? {}) as Record<string, unknown>;
  const allocationsRaw = Array.isArray(row.allocations) ? row.allocations : [];
  const allocations = allocationsRaw
    .map((a) => {
      if (!a || typeof a !== "object" || Array.isArray(a)) return null;
      const grantId = (a as Record<string, unknown>).grant_id;
      const credits = (a as Record<string, unknown>).credits;
      if (typeof grantId !== "string" || typeof credits !== "number") return null;
      return { grant_id: grantId, credits: Math.round(credits) };
    })
    .filter(Boolean) as { grant_id: string; credits: number }[];

  const plan: OorjamanCreditsRedemptionPlan = {
    discount_paise:
      typeof row.discount_paise === "number" ? Math.max(0, Math.round(row.discount_paise)) : 0,
    discount_credits:
      typeof row.discount_credits === "number" ? Math.max(0, Math.round(row.discount_credits)) : 0,
    allocations,
  };
  return { plan };
}

export {
  creditsToPaise,
  isVendorCancelInLastHourBeforeSlot,
  OORJAMAN_CREDIT_PAISE,
  OORJAMAN_CREDIT_VALIDITY_MS,
  planOorjamanCreditsRedemption,
  VENDOR_CANCEL_LAST_HOUR_BEFORE_SLOT_MS,
  VENDOR_LAST_HOUR_CANCEL_CUSTOMER_CREDITS,
  type OorjamanCreditsRedemptionPlan,
} from "./customer-credits-policy";
