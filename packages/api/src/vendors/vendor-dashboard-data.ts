import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, JobReportRow, PaymentRow, SubscriptionRow } from "../database.types";
import { takeRows } from "../result";

/**
 * Payments visible to the vendor org (RLS: linked booking or customer with shared bookings).
 */
export async function listVendorPayments(client: SupabaseClient<Database>): Promise<PaymentRow[]> {
  const { data, error } = await client
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  return takeRows(data, error);
}

/**
 * AMC subscriptions for customers the vendor has served (RLS).
 */
export async function listVendorSubscriptions(client: SupabaseClient<Database>): Promise<SubscriptionRow[]> {
  const { data, error } = await client
    .from("subscriptions")
    .select("*")
    .order("ends_at", { ascending: true })
    .limit(300);

  return takeRows(data, error);
}

/**
 * Job reports for bookings the vendor can see (RLS via parent booking).
 */
export async function listVendorJobReports(
  client: SupabaseClient<Database>,
  options?: { limit?: number },
): Promise<JobReportRow[]> {
  const lim = options?.limit ?? 300;
  const { data, error } = await client
    .from("job_reports")
    .select("*")
    .order("completed_at", { ascending: false })
    .limit(lim);

  return takeRows(data, error);
}
