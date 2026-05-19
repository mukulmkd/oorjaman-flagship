import type { SupportCategory } from "./support-catalog";

/** Product copy for technician field-support intake. */
export const TECHNICIAN_SUPPORT_CATEGORIES: SupportCategory[] = [
  {
    slug: "job",
    label: "On-site job & visit",
    description: "Assigned visits, job start/complete, customer on site, OTP, and evidence.",
    subcategories: [
      {
        slug: "cannot_start",
        label: "Cannot start job",
        prompt: "Booking reference, what you tapped, and any error message.",
      },
      {
        slug: "wrong_address",
        label: "Wrong address / GPS",
        prompt: "Booking reference and where you actually are.",
      },
      {
        slug: "customer_unavailable",
        label: "Customer not available",
        prompt: "Booking reference, time on site, and contact attempts.",
      },
      {
        slug: "otp_happy_code",
        label: "OTP / happy code issue",
        prompt: "Booking reference and what the customer sees on their app.",
      },
      {
        slug: "evidence_upload",
        label: "Photos / evidence upload",
        prompt: "Which step failed and any error shown.",
      },
      {
        slug: "reschedule",
        label: "Reschedule or reassign",
        prompt: "Booking reference and preferred outcome.",
      },
    ],
  },
  {
    slug: "app",
    label: "App, login & permissions",
    description: "Crashes, sign-in, location tracking, camera, and notifications.",
    subcategories: [
      { slug: "login", label: "Cannot sign in", prompt: "Phone/email used and what happens after OTP." },
      {
        slug: "location_gps",
        label: "Location / GPS tracking",
        prompt: "Which screen and whether location permission is on.",
      },
      {
        slug: "camera",
        label: "Camera / gallery",
        prompt: "When taking site photos or uploading documents.",
      },
      {
        slug: "notifications",
        label: "Job alerts / notifications",
        prompt: "Which alert you expected and when.",
      },
      { slug: "crash", label: "App crash or freeze", prompt: "Screen name and steps before it crashed." },
    ],
  },
  {
    slug: "partner",
    label: "Partner / vendor",
    description: "Employer vendor, roster, and dispatch assignment questions.",
    subcategories: [
      { slug: "wrong_assignment", label: "Wrong job assigned", prompt: "Booking reference and why it looks wrong." },
      { slug: "vendor_contact", label: "Reach my vendor", prompt: "Vendor name and what you need from them." },
      { slug: "availability", label: "Availability / go offline", prompt: "What you changed and what you expected." },
    ],
  },
  {
    slug: "earnings",
    label: "Payments & earnings",
    description: "Payouts, incentives, and payment details on your profile.",
    subcategories: [
      { slug: "payout_missing", label: "Missing or delayed payout", prompt: "Period/date and amount if known." },
      { slug: "bank_details", label: "Bank account on file", prompt: "What you are trying to update or verify." },
      { slug: "incentive", label: "Bonus / incentive question", prompt: "Campaign or date range if known." },
    ],
  },
  {
    slug: "safety",
    label: "Safety & on-site incident",
    description: "Site access, equipment, or safety concerns during a visit.",
    subcategories: [
      { slug: "site_access", label: "Cannot access site safely", prompt: "Booking reference and what is blocking access." },
      { slug: "equipment", label: "Equipment / electrical concern", prompt: "Describe the hazard without putting yourself at risk." },
      { slug: "incident", label: "Report an incident", prompt: "Booking reference, time, and what happened." },
    ],
  },
  {
    slug: "account",
    label: "Profile & documents",
    description: "Verification, ID documents, and profile updates.",
    subcategories: [
      { slug: "verification", label: "Verification status", prompt: "What status you see and when you submitted." },
      { slug: "documents", label: "Upload / reject documents", prompt: "Which document and any rejection reason shown." },
      { slug: "profile_update", label: "Update phone or details", prompt: "What field needs to change." },
    ],
  },
  {
    slug: "other",
    label: "Other",
    description: "Anything not covered above.",
    subcategories: [
      { slug: "general", label: "Something else", prompt: "Describe your question in a few sentences." },
    ],
  },
];

export function getTechnicianSupportCategory(slug: string): SupportCategory | undefined {
  return TECHNICIAN_SUPPORT_CATEGORIES.find((c) => c.slug === slug);
}

export function getTechnicianSupportSubcategory(
  categorySlug: string,
  subSlug: string,
): SupportCategory["subcategories"][number] | undefined {
  return getTechnicianSupportCategory(categorySlug)?.subcategories.find((s) => s.slug === subSlug);
}

export function technicianSupportCategoryLabel(categorySlug: string, subcategorySlug: string): string {
  const cat = getTechnicianSupportCategory(categorySlug);
  const sub = getTechnicianSupportSubcategory(categorySlug, subcategorySlug);
  if (cat && sub) return `${cat.label} · ${sub.label}`;
  return categorySlug;
}
