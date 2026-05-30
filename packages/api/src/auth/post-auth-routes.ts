import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import * as customerApi from "../customers/customer-api";
import * as technicianApi from "../technicians/technician-api";
import { getMyUserRecord, getMyUserRecordWithRetry } from "../users/user-api";

/** Customer mobile app - partners must use the web portal, not this binary. */
export type CustomerAppPostAuthPath =
  | "/(main)"
  | "/customer-registration"
  | "/wrong-role";

/** Technician field app. */
export type TechnicianAppPostAuthPath =
  | "/(main)"
  | "/technician-onboarding"
  | "/pending-vendor-review"
  | "/vendor-not-onboarded"
  | "/wrong-role";

/**
 * Where to send the user after Supabase Auth succeeds in the **customer** mobile app.
 * Uses `public.users.role` (maps `auth.uid`) plus customer onboarding state. Partner (`vendor`) accounts are sent to
 * `/wrong-role` - they must use the partner web portal.
 */
export async function resolveCustomerAppPostAuthPath(
  client: SupabaseClient<Database>,
): Promise<CustomerAppPostAuthPath> {
  const user = await getMyUserRecordWithRetry(client);
  if (!user) {
    // Signed in but no `public.users` row yet (or trigger lag) - treat as new customer.
    return "/customer-registration";
  }

  switch (user.role) {
    case "customer": {
      const cust = await customerApi.getMyCustomer(client);
      return cust?.onboarding_completed_at
        ? "/(main)"
        : "/customer-registration";
    }
    case "vendor":
      return "/wrong-role";
    case "technician":
    case "admin":
      return "/wrong-role";
  }
}

/**
 * Where to send the user after Supabase Auth succeeds in the **technician** mobile app.
 */
export async function resolveTechnicianAppPostAuthPath(
  client: SupabaseClient<Database>,
): Promise<TechnicianAppPostAuthPath> {
  const user = await getMyUserRecordWithRetry(client);
  if (!user) return "/wrong-role";

  if (user.role !== "technician") return "/wrong-role";

  const tech = await technicianApi.getMyTechnicianProfile(client);
  if (technicianApi.technicianIsFullyOnboarded(tech)) return "/(main)";

  const hasVendorLink =
    await technicianApi.technicianHasVendorOnboardingAccess(client);
  if (!hasVendorLink) return "/vendor-not-onboarded";

  if (technicianApi.technicianShowsPendingReviewScreen(tech))
    return "/pending-vendor-review";

  return "/technician-onboarding";
}
