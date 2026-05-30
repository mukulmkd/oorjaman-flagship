export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  slug: string;
  title: string;
  description: string;
  lastUpdated: string;
  sections: LegalSection[];
};

const LAST_UPDATED = "2026-05-19";

export const legalDocuments: LegalDocument[] = [
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    description:
      "How OorjaMan collects, uses, and protects your personal data.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "introduction",
        title: "Introduction",
        paragraphs: [
          "OorjaMan (“we”, “us”, “our”) operates a solar rooftop care platform that connects property owners with verified service partners and technicians. This Privacy Policy explains what information we collect, why we collect it, and your choices.",
          "By using the OorjaMan customer or technician mobile applications, partner portal, or this website, you agree to this policy.",
        ],
      },
      {
        id: "data-we-collect",
        title: "Information we collect",
        paragraphs: [
          "We collect information necessary to provide booking, visit execution, payments, and support:",
        ],
        bullets: [
          "Account: name, phone number, email, role (customer, technician, partner, support).",
          "Property & site: service addresses, rooftop details, capacity, photos you upload for scoping and evidence.",
          "Location: GPS when you grant permission - for address capture, technician navigation, and live visit tracking during active jobs.",
          "Bookings & payments: visit history, pricing, payment status, cancellation records.",
          "Communications: in-app support chat messages and notification preferences.",
          "Device: push tokens, app version, and diagnostic logs for reliability.",
        ],
      },
      {
        id: "how-we-use",
        title: "How we use information",
        bullets: [
          "Schedule and fulfil solar cleaning and AMC visits.",
          "Match you with partners operating in your service area.",
          "Send booking updates, OTP/happy codes, and service notifications.",
          "Process platform fees, settlements, and applicable cancellation charges.",
          "Improve safety, fraud prevention, and service quality.",
          "Comply with law and respond to lawful requests.",
        ],
        paragraphs: [],
      },
      {
        id: "sharing",
        title: "Sharing with others",
        paragraphs: [
          "We share limited data with assigned partners and technicians to perform your visit (address, contact, site notes, photos). We use infrastructure providers (e.g. cloud hosting, maps, payment processors) under contractual safeguards. We do not sell your personal information.",
        ],
      },
      {
        id: "retention",
        title: "Retention",
        paragraphs: [
          "We retain account and booking records while your account is active and as required for tax, dispute, and safety obligations. You may request deletion as described in our Account Deletion policy.",
        ],
      },
      {
        id: "rights",
        title: "Your rights",
        bullets: [
          "Access and correct profile information in the app.",
          "Withdraw location or notification permissions in device settings.",
          "Request account deletion via the in-app flow or our Account Deletion page.",
          "Contact privacy@oorjaman.com for questions or complaints.",
        ],
        paragraphs: [
          "If you are in India, we process personal data in line with applicable law including the Digital Personal Data Protection Act, 2023, as it comes into force.",
        ],
      },
      {
        id: "children",
        title: "Children",
        paragraphs: [
          "OorjaMan is not directed at children under 13. We do not knowingly collect data from children.",
        ],
      },
      {
        id: "contact",
        title: "Contact",
        paragraphs: [
          "Privacy enquiries: privacy@oorjaman.com · General support: support@oorjaman.com",
        ],
      },
    ],
  },
  {
    slug: "terms-of-service",
    title: "Terms of Service",
    description: "Terms governing use of OorjaMan apps and services.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "agreement",
        title: "Agreement",
        paragraphs: [
          "These Terms of Service (“Terms”) govern your access to OorjaMan’s platform, mobile applications, and related services. OorjaMan provides a technology marketplace connecting customers with independent service partners; partners and their technicians perform on-site work.",
        ],
      },
      {
        id: "eligibility",
        title: "Eligibility",
        paragraphs: [
          "You must be at least 18 years old and able to enter a binding contract. You are responsible for accurate site and contact information.",
        ],
      },
      {
        id: "bookings",
        title: "Bookings & pricing",
        bullets: [
          "Displayed prices include platform pricing rules and applicable geo-tier surcharges where configured.",
          "AMC plans include visit allowances per contract terms shown at purchase.",
          "You may cancel within the grace window shown in the app; late cancellations may incur a fee published on the platform.",
        ],
        paragraphs: [],
      },
      {
        id: "conduct",
        title: "Acceptable use",
        paragraphs: [
          "You may not misuse the platform, harass staff or technicians, submit false site information, or interfere with visit safety protocols.",
        ],
      },
      {
        id: "liability",
        title: "Disclaimer & liability",
        paragraphs: [
          "Services are provided by independent partners. OorjaMan facilitates scheduling, payments, and quality workflows but does not replace manufacturer warranties or structural engineering advice. To the extent permitted by law, our liability is limited to fees paid for the affected booking in the prior three months.",
        ],
      },
      {
        id: "law",
        title: "Governing law",
        paragraphs: [
          "These Terms are governed by the laws of India. Courts in Bengaluru, Karnataka shall have exclusive jurisdiction, subject to mandatory consumer protections.",
        ],
      },
    ],
  },
  {
    slug: "account-deletion",
    title: "Account Deletion",
    description:
      "How to delete your OorjaMan account and what happens to your data.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "overview",
        title: "Overview",
        paragraphs: [
          "You can delete your OorjaMan customer account at any time. Deletion is permanent for the customer profile and removes access to booking history in the app after processing completes.",
        ],
      },
      {
        id: "in-app",
        title: "Delete in the app",
        bullets: [
          "Open the OorjaMan customer app and sign in.",
          "Go to Profile → Account settings → Delete account.",
          "Confirm your request. You may be asked to complete active bookings or settle outstanding payments first.",
        ],
        paragraphs: [],
      },
      {
        id: "email",
        title: "Request by email",
        paragraphs: [
          "If you cannot access the app, email support@oorjaman.com from your registered phone/email with subject “Account deletion request”. We will verify ownership and respond within 7 business days.",
        ],
      },
      {
        id: "timeline",
        title: "Processing timeline",
        paragraphs: [
          "Most requests complete within 30 days. We may retain minimal records required by law (tax, fraud prevention, dispute resolution) after deletion.",
        ],
      },
    ],
  },
  {
    slug: "refund-cancellation",
    title: "Refund & Cancellation Policy",
    description: "Cancellations, grace periods, and late-cancellation fees.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "grace",
        title: "Grace window",
        paragraphs: [
          "Customers may cancel a booked visit within the one-hour grace window after booking without a late-cancellation fee, as shown in the app at the time of booking.",
        ],
      },
      {
        id: "late-fee",
        title: "Late cancellation",
        paragraphs: [
          "Cancellations after the grace window may incur a late-cancellation fee. The current fee amount is displayed in the app before you confirm “Cancel anyway” and stored against the booking for partner settlement.",
        ],
      },
      {
        id: "refunds",
        title: "Refunds",
        paragraphs: [
          "Eligible refunds for failed or cancelled visits are processed to the original payment method where applicable. Processing times depend on your bank or UPI provider (typically 5–10 business days).",
        ],
      },
    ],
  },
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    description: "Cookies and similar technologies on oorjaman.com.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "what",
        title: "What we use",
        paragraphs: [
          "This website may use essential cookies for security and preferences. If analytics are enabled, we use cookies to measure traffic and improve content.",
        ],
      },
      {
        id: "control",
        title: "Your choices",
        paragraphs: [
          "You can block cookies in your browser settings. Some site features may not function without essential cookies.",
        ],
      },
    ],
  },
  {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    description: "Rules for using OorjaMan platforms responsibly.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "rules",
        title: "Rules",
        bullets: [
          "Provide accurate rooftop and access information.",
          "Do not attempt unauthorized access to systems or other users’ data.",
          "Do not use the platform for unlawful purposes.",
          "Respect technicians and support staff.",
        ],
        paragraphs: [
          "Violations may result in suspension or termination of access.",
        ],
      },
    ],
  },
  {
    slug: "community-guidelines",
    title: "Community Guidelines",
    description: "Standards for in-app chat and support interactions.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "respect",
        title: "Be respectful",
        paragraphs: [
          "Support chat and notifications exist to resolve service issues. Harassment, hate speech, or threats are prohibited.",
        ],
      },
      {
        id: "reports",
        title: "Reporting",
        paragraphs: [
          "Report concerns to support@oorjaman.com. We may review message metadata to investigate abuse.",
        ],
      },
    ],
  },
  {
    slug: "vendor-partner-agreement",
    title: "Vendor Partner Agreement",
    description: "Summary terms for OorjaMan service partners.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "relationship",
        title: "Relationship",
        paragraphs: [
          "Partners are independent businesses responsible for technician conduct, safety compliance, insurance where required, and visit quality. OorjaMan provides booking demand, pricing tools, and settlement reporting.",
        ],
      },
      {
        id: "obligations",
        title: "Partner obligations",
        bullets: [
          "Maintain verified documents and technician credentials.",
          "Accept or decline bookings within SLA windows.",
          "Follow safety checklists and evidence capture requirements.",
          "Honour published pricing and AMC visit entitlements.",
        ],
        paragraphs: [],
      },
      {
        id: "payments",
        title: "Settlements",
        paragraphs: [
          "Visit payouts and cancellation penalties follow platform settlement rules visible in the partner finance dashboard. Platform fees are deducted as configured by OorjaMan operations.",
        ],
      },
    ],
  },
  {
    slug: "data-processing",
    title: "Data Processing Notice",
    description: "Summary of processing purposes and subprocessors.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "roles",
        title: "Roles",
        paragraphs: [
          "OorjaMan acts as a data fiduciary for customer accounts. Partners process visit data as instructed to deliver services.",
        ],
      },
      {
        id: "subprocessors",
        title: "Infrastructure",
        bullets: [
          "Cloud database, authentication, storage, and serverless functions (Supabase).",
          "Maps and geocoding providers when you use location features.",
          "Push notification delivery (Apple APNS, Google FCM via Expo).",
          "Payment processors integrated for checkout.",
        ],
        paragraphs: [
          "We require subprocessors to protect data under contract.",
        ],
      },
    ],
  },
];

export function getLegalDocument(slug: string): LegalDocument | undefined {
  return legalDocuments.find((d) => d.slug === slug);
}

export const legalNav = legalDocuments.map((d) => ({
  slug: d.slug,
  title: d.title,
  href: `/legal/${d.slug}`,
}));
