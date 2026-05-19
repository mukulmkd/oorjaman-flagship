import type { BookingRow } from "../database.types";

/** Customer-facing brand spelling */
export const BRAND = "OorjaMan" as const;

export type RenewalAudience = "expiring_soon" | "lapsed";

function bookingRef(booking: Pick<BookingRow, "reference_code" | "id">): string {
  return booking.reference_code?.trim() || booking.id.slice(0, 8).toUpperCase();
}

function partnerName(name: string | null | undefined): string {
  return name?.trim() || "Your OorjaMan partner";
}

// —— Admin / ops in-app ——

export function adminMarketplaceFloatedCopy(
  booking: Pick<BookingRow, "reference_code" | "id">,
  vendorCount: number,
): { title: string; body: string } {
  const ref = bookingRef(booking);
  return {
    title: "Marketplace is live",
    body:
      vendorCount > 0
        ? `${ref} is open on the OorjaMan partner marketplace — ${vendorCount} eligible partner${vendorCount === 1 ? "" : "s"} can claim it. First to accept gets the visit.`
        : `${ref} was floated, but no partners matched slot and service area yet. You may assign directly or widen the broadcast.`,
  };
}

export function adminVendorClaimedCopy(
  booking: Pick<BookingRow, "reference_code" | "id">,
  vendorName: string | null,
): { title: string; body: string } {
  const ref = bookingRef(booking);
  const who = partnerName(vendorName);
  return {
    title: "Partner claimed visit",
    body: `${who} claimed marketplace visit ${ref}. Review acceptance and technician assignment when ready.`,
  };
}

export function adminVendorAcceptedCopy(
  booking: Pick<BookingRow, "reference_code" | "id">,
  vendorName: string | null,
  technicianName: string | null,
): { title: string; body: string } {
  const ref = bookingRef(booking);
  const tech = technicianName?.trim() || "a technician";
  const vendor = partnerName(vendorName);
  return {
    title: "Crew assigned",
    body: `${vendor} accepted ${ref} and assigned ${tech}. The customer can track the visit in the OorjaMan app.`,
  };
}

export function adminVendorDeclinedCopy(
  booking: Pick<BookingRow, "reference_code" | "id">,
  vendorName: string | null,
  reason: string,
): { title: string; body: string } {
  const ref = bookingRef(booking);
  return {
    title: "Partner could not take visit",
    body: `${partnerName(vendorName)} gently declined ${ref}. Reason: ${reason}. A quick reassignment keeps the customer’s day on track.`,
  };
}

export function adminBookingCancelledCopy(
  booking: Pick<BookingRow, "reference_code" | "id">,
): { title: string; body: string } {
  const ref = bookingRef(booking);
  return {
    title: "Visit cancelled",
    body: `${ref} was cancelled. If the customer still needs help, a fresh booking or partner assignment restores continuity.`,
  };
}

export function adminReassignmentNeededCopy(
  booking: Pick<BookingRow, "reference_code" | "id">,
  vendorName: string | null,
): { title: string; body: string } {
  const ref = bookingRef(booking);
  return {
    title: "Please reassign partner",
    body: `${partnerName(vendorName)} had to step back from accepted visit ${ref}. Assign another trusted partner when you can — we’ll keep the customer informed.`,
  };
}

export function adminTechnicianReassignedCopy(
  booking: Pick<BookingRow, "reference_code" | "id">,
  vendorName: string | null,
  technicianName: string | null,
): { title: string; body: string } {
  const ref = bookingRef(booking);
  return {
    title: "Technician updated",
    body: `${partnerName(vendorName)} reassigned ${ref} to ${technicianName?.trim() || "another technician"}. The visit window stays the same unless ops reschedules.`,
  };
}

export function adminVisitStartedCopy(booking: Pick<BookingRow, "reference_code" | "id">): {
  title: string;
  body: string;
} {
  const ref = bookingRef(booking);
  return {
    title: "Visit underway",
    body: `Technician checked in for ${ref}. Panel care and safety checks are in progress on site.`,
  };
}

export function adminVisitCompletedCopy(booking: Pick<BookingRow, "reference_code" | "id">): {
  title: string;
  body: string;
} {
  const ref = bookingRef(booking);
  return {
    title: "Visit complete",
    body: `${ref} is marked complete. Review the job report and ratings when convenient — your feedback loop keeps partners sharp.`,
  };
}

// —— Vendor in-app ——

export function vendorBookingAssignedCopy(booking: Pick<BookingRow, "reference_code" | "id">): {
  title: string;
  body: string;
} {
  const ref = bookingRef(booking);
  return {
    title: "New OorjaMan visit for you",
    body: `Operations assigned ${ref} to your organisation. Please accept and assign a technician soon — the homeowner is counting on timely solar care.`,
  };
}

export function vendorVisitStartedCopy(booking: Pick<BookingRow, "reference_code" | "id">): {
  title: string;
  body: string;
} {
  const ref = bookingRef(booking);
  return {
    title: "Your crew is on site",
    body: `Your technician started ${ref}. Thank you for representing ${BRAND} with care.`,
  };
}

export function vendorVisitCompletedCopy(booking: Pick<BookingRow, "reference_code" | "id">): {
  title: string;
  body: string;
} {
  const ref = bookingRef(booking);
  return {
    title: "Visit closed",
    body: `Your technician completed ${ref}. The report is saved — great work keeping the customer’s system healthy.`,
  };
}

// —— Marketplace (vendor channels) ——

export function marketplaceBroadcastCopy(booking: Pick<BookingRow, "reference_code" | "id">): {
  title: string;
  body: string;
} {
  const ref = bookingRef(booking);
  return {
    title: "New visit to claim",
    body: `OorjaMan marketplace: ${ref} is open in your service area. Claim promptly — homeowners receive faster care when partners respond quickly.`,
  };
}

export function marketplaceClaimWonCopy(booking: Pick<BookingRow, "reference_code" | "id">): {
  title: string;
  body: string;
} {
  const ref = bookingRef(booking);
  return {
    title: "Claim confirmed",
    body: `You secured marketplace visit ${ref}. Assign your best technician and confirm the slot so the customer knows help is on the way.`,
  };
}

// —— Low rating (admin / ops) ——

export function lowRatingFollowupInAppCopy(referenceCode: string, rating: number): {
  title: string;
  body: string;
} {
  return {
    title: "Customer needs a caring follow-up",
    body: `Booking ${referenceCode} received ${rating}/5. Please read their feedback and reach out with humility — a short, sincere call often restores trust.`,
  };
}

// —— AMC renewal (customer channels; template variables) ——

export function renewalNudgeTemplateContext(input: {
  customer_name: string | null;
  plan_name: string;
  ends_at: string;
  days_to_expiry: number;
  days_since_expiry: number;
  renewal_audience: RenewalAudience;
}): Record<string, string | number> {
  const name = input.customer_name?.trim() || "there";
  const endsLabel = new Date(input.ends_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const isLapsed = input.renewal_audience === "lapsed";

  const renewal_intro = isLapsed
    ? `We noticed your ${input.plan_name} care plan ended on ${endsLabel}. If that was unintentional, we would be honoured to welcome you back — uninterrupted AMC keeps panels clean, safe, and performing season after season.`
    : `Your ${input.plan_name} plan with ${BRAND} reaches an important date on ${endsLabel} (${input.days_to_expiry === 0 ? "today" : `in ${input.days_to_expiry} day${input.days_to_expiry === 1 ? "" : "s"}`}). Renewing on time avoids any gap in scheduled care and priority support.`;

  const renewal_cta = isLapsed
    ? "Renew in the OorjaMan app or reply to this message — we will help you pick up right where you left off."
    : "Renew in the OorjaMan app when convenient; our team is here if you have questions about coverage or visits.";

  return {
    customer_name: name,
    plan_name: input.plan_name,
    ends_at: endsLabel,
    days_to_expiry: input.days_to_expiry,
    days_since_expiry: input.days_since_expiry,
    renewal_audience: input.renewal_audience,
    renewal_intro,
    renewal_cta,
    brand: BRAND,
  };
}
