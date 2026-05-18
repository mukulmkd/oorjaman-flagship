import type { BookingRow, VendorRow } from "@oorjaman/api";
import {
  bookingUsedFallbackVendor,
  isDefaultVendorMarketplaceBooking,
  isSubscriptionAmcAwaitingAdminFloat,
  readBookingVendorReassignmentMeta,
  readBookingVendorRoutingMeta,
} from "@oorjaman/api";

function marketplaceAutoRoutedFromPreferred(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return false;
  const mp = (metadata as Record<string, unknown>).marketplace;
  if (!mp || typeof mp !== "object" || Array.isArray(mp)) return false;
  return (
    (mp as Record<string, unknown>).auto_routed_from_preferred_unavailable ===
    true
  );
}

/** Paid visit waiting on OorjaMan ops to assign or confirm a service partner. */
export function isBookingAwaitingOorjamanPartnerAssignment(
  booking: Pick<BookingRow, "metadata" | "vendor_id" | "status">,
): boolean {
  if (booking.status !== "confirmed" && booking.status !== "pending_payment")
    return false;
  const reassign = readBookingVendorReassignmentMeta(booking.metadata);
  if (reassign.awaitingAdminAssignment) return true;
  if (isSubscriptionAmcAwaitingAdminFloat(booking.metadata)) return true;
  if (isDefaultVendorMarketplaceBooking(booking.metadata)) return true;
  return booking.status === "confirmed" && booking.vendor_id == null;
}

export function buildPostCheckoutPartnerAlert(
  booking: Pick<BookingRow, "metadata" | "vendor_id">,
  approvedVendors: VendorRow[],
): { title: string; message: string } | null {
  const routing = readBookingVendorRoutingMeta(booking.metadata);

  if (routing?.reason === "default_vendor_marketplace") {
    if (marketplaceAutoRoutedFromPreferred(booking.metadata)) {
      return {
        title: "Visit request received",
        message:
          "Your chosen partner was not available for this time slot. OorjaMan will assign a service partner for your visit. Open My bookings for updates.",
      };
    }
    return {
      title: "Visit request received",
      message:
        "OorjaMan will assign a service partner for your saved address. Open My bookings for your visit timing and partner details once assigned.",
    };
  }

  if (!bookingUsedFallbackVendor(booking)) return null;

  const partnerBusinessName =
    booking.vendor_id != null
      ? approvedVendors
          .find((v) => v.id === booking.vendor_id)
          ?.business_name?.trim() || null
      : null;

  if (partnerBusinessName) {
    return {
      title: "Partner update",
      message: `Your preferred partner could not take this visit at your saved address. ${partnerBusinessName} will handle it instead. Open My bookings for timing and contact details.`,
    };
  }

  return {
    title: "Partner update",
    message:
      "Your preferred partner could not take this visit at your saved address. OorjaMan will assign another service partner — open My bookings for updates.",
  };
}

export function customerConfirmedBookingStatusHelp(
  booking: Pick<BookingRow, "metadata" | "vendor_id" | "status">,
): string | null {
  if (booking.status !== "confirmed") return null;

  const reassign = readBookingVendorReassignmentMeta(booking.metadata);
  if (reassign.awaitingAdminAssignment) {
    return "Your earlier partner could not continue. OorjaMan operations is assigning a new service partner.";
  }

  if (isSubscriptionAmcAwaitingAdminFloat(booking.metadata)) {
    return "Your AMC visit is confirmed. OorjaMan operations will assign a service partner for this visit — you'll see the partner name here once assigned.";
  }

  if (isBookingAwaitingOorjamanPartnerAssignment(booking)) {
    return "Your visit is confirmed. OorjaMan operations will assign a service partner for your area — you'll see the partner name here once assigned.";
  }

  if (booking.vendor_id) {
    return "We've notified your assigned service partner — they'll confirm your slot when ready.";
  }

  return null;
}
