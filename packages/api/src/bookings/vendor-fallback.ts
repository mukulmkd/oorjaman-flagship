import type { VendorRow } from "../database.types";
import { SupabaseApiError } from "../result";
import type { CustomerLocationSignals } from "../vendors/vendor-service-area";
import { vendorCoversCustomerSignals } from "../vendors/vendor-service-area";

export type VendorRoutingReason =
  | "preferred_ok"
  | "preferred_ineligible_customer_fallback"
  | "preferred_ineligible_platform_default"
  | "preferred_missing_customer_fallback"
  | "preferred_missing_platform_default"
  /** First AMC visit: no vendor until ops floats to marketplace or assigns. */
  | "amc_awaiting_admin_marketplace"
  /** AMC contract has a dedicated partner assigned by admin. */
  | "amc_assigned_partner";

export type VendorRoutingResolution = {
  resolvedVendorId: string;
  usedFallback: boolean;
  requestedVendorId: string;
  reason: VendorRoutingReason;
};

function eligibleVendor(
  vendor: VendorRow | undefined,
  signals: CustomerLocationSignals,
): vendor is VendorRow {
  return Boolean(vendor && vendorCoversCustomerSignals(vendor, signals));
}

/**
 * When the customer's chosen vendor cannot serve the saved location, assign customer fallback
 * (Partners tab) then platform default (admin). Throws if no eligible vendor exists.
 */
export function resolveBookingVendor(params: {
  requestedVendorId: string;
  customerFallbackVendorId: string | null | undefined;
  platformDefaultVendorId: string | null | undefined;
  signals: CustomerLocationSignals;
  approvedVendors: VendorRow[];
}): VendorRoutingResolution {
  const { requestedVendorId, customerFallbackVendorId, platformDefaultVendorId, signals, approvedVendors } =
    params;

  const byId = new Map(approvedVendors.map((v) => [v.id, v]));
  const requested = byId.get(requestedVendorId);

  if (eligibleVendor(requested, signals)) {
    return {
      resolvedVendorId: requested.id,
      usedFallback: false,
      requestedVendorId,
      reason: "preferred_ok",
    };
  }

  const hadPreferredRow = Boolean(requested);

  if (
    customerFallbackVendorId &&
    customerFallbackVendorId !== requestedVendorId
  ) {
    const fb = byId.get(customerFallbackVendorId);
    if (eligibleVendor(fb, signals)) {
      return {
        resolvedVendorId: fb.id,
        usedFallback: true,
        requestedVendorId,
        reason: hadPreferredRow
          ? "preferred_ineligible_customer_fallback"
          : "preferred_missing_customer_fallback",
      };
    }
  }

  if (platformDefaultVendorId) {
    const plat = byId.get(platformDefaultVendorId);
    if (eligibleVendor(plat, signals)) {
      return {
        resolvedVendorId: plat.id,
        usedFallback: true,
        requestedVendorId,
        reason: hadPreferredRow
          ? "preferred_ineligible_platform_default"
          : "preferred_missing_platform_default",
      };
    }
  }

  throw new SupabaseApiError(
    "No partner covers your saved location with the current selections. Update your site address, choose another vendor in Partners, or contact support.",
  );
}
