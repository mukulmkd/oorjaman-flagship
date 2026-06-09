export type SupportSubcategory = {
  slug: string;
  label: string;
  /** Short line under the chip before the customer taps (pricing / policy). */
  hint?: string;
  prompt?: string;
};

/** Shown in support intake and AMC waiting screens. */
export const AMC_URGENT_CLEANING_SUBCATEGORY_SLUG = "urgent_cleaning" as const;

export const amcUrgentCleaningSupportHint =
  "Charged separately at one-time visit rates. Does not use your prepaid AMC visits.";

export const amcUrgentCleaningSupportPrompt =
  "Your AMC covers scheduled included visits - not same-day urgent cleans. If we arrange an urgent one-time visit, you pay the standard visit rate separately. It is not converted into an AMC visit and does not reduce your included visit count. Tell us your site, preferred date, and why you need it urgently.";

export type SupportCategory = {
  slug: string;
  label: string;
  description: string;
  subcategories: SupportSubcategory[];
};

/** Product copy for customer help intake (also mirrored in DB seed for admin reporting). */
export const SUPPORT_CATEGORIES: SupportCategory[] = [
  {
    slug: "booking",
    label: "Booking related",
    description: "Visits, scheduling, technicians, and payments for a booking.",
    subcategories: [
      { slug: "schedule_change", label: "Change or cancel a visit", prompt: "Share your booking reference and preferred new time." },
      { slug: "technician_visit", label: "Technician / on-site issue", prompt: "What happened during the visit?" },
      { slug: "payment_refund", label: "Payment or refund", prompt: "Include payment date and amount if you have it." },
      { slug: "wrong_address", label: "Wrong service address", prompt: "Tell us the correct site and booking reference." },
      { slug: "tracking", label: "Track technician / delay", prompt: "Booking reference and when the visit was scheduled." },
    ],
  },
  {
    slug: "amc",
    label: "AMC related",
    description: "Annual maintenance contracts, visit allowances, and renewals.",
    subcategories: [
      { slug: "plan_upgrade", label: "Upgrade or change plan", prompt: "Which site address and what plan do you want?" },
      {
        slug: AMC_URGENT_CLEANING_SUBCATEGORY_SLUG,
        label: "Need urgent cleaning?",
        hint: amcUrgentCleaningSupportHint,
        prompt: amcUrgentCleaningSupportPrompt,
      },
      { slug: "schedule_amc_visit", label: "Schedule an AMC visit", prompt: "Which visit number and preferred dates?" },
      { slug: "renewal", label: "Renewal or contract end", prompt: "Site address and when your plan ended or ends." },
      { slug: "visit_allowance", label: "Visit count / allowances", prompt: "Describe what looks wrong on your AMC screen." },
      { slug: "pricing", label: "AMC pricing question", prompt: "Your system size (kW) and plan name if known." },
    ],
  },
  {
    slug: "other",
    label: "Any other query",
    description: "Account, app, or anything not covered above.",
    subcategories: [
      { slug: "account_profile", label: "Profile or login", prompt: "Phone/email on the account and what you cannot do." },
      { slug: "addresses", label: "Saved addresses", prompt: "Which address label and what needs to change?" },
      { slug: "app_bug", label: "App not working", prompt: "What screen and what did you tap? Any error message?" },
      { slug: "notifications", label: "Notifications / SMS", prompt: "What alert did you expect and when?" },
      { slug: "general", label: "Something else", prompt: "Describe your question in a few sentences." },
    ],
  },
];

export function getSupportCategory(slug: string): SupportCategory | undefined {
  return SUPPORT_CATEGORIES.find((c) => c.slug === slug);
}

export function getSupportSubcategory(categorySlug: string, subSlug: string): SupportSubcategory | undefined {
  return getSupportCategory(categorySlug)?.subcategories.find((s) => s.slug === subSlug);
}

export function supportCategoryLabel(categorySlug: string, subcategorySlug: string): string {
  const cat = getSupportCategory(categorySlug);
  const sub = getSupportSubcategory(categorySlug, subcategorySlug);
  if (cat && sub) return `${cat.label} · ${sub.label}`;
  return categorySlug;
}
