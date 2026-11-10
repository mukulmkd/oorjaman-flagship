import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

export type NotifyVendorAssignmentBody =
  | { kind: "booking"; bookingId: string }
  | { kind: "amc_subscription"; subscriptionId: string };

/**
 * Best-effort Resend email to the assigned vendor (mirrors notify-state-ops-booking).
 * Never throws — assignment flows must not fail if email delivery is unavailable.
 */
export async function invokeNotifyVendorAssignment(
  client: SupabaseClient<Database>,
  body: NotifyVendorAssignmentBody,
): Promise<void> {
  try {
    const { error } = await client.functions.invoke("notify-vendor-assignment", {
      body,
    });
    if (error) {
      console.warn("Vendor assignment email was not sent.", error.message);
    }
  } catch (err) {
    console.warn("Vendor assignment email was not sent.", err);
  }
}
