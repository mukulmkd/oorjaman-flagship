import { SUPPORT_EMAIL } from "./site";

/** Shared FAQ for /faq page, home JSON-LD, and future surfaces. */
export const FAQ_ITEMS = [
  {
    q: "What does OorjaMan do?",
    a: "OorjaMan is a solar rooftop care platform. Customers book professional panel cleaning and annual maintenance (AMC) through the customer app. Verified partners accept jobs, assign technicians, and complete visits with safety checks and photo evidence.",
  },
  {
    q: "Do I need the app to book?",
    a: "Yes. Booking, payments, visit tracking, and support chat are available in the OorjaMan customer app for iOS and Android. Until store listings are live, use the Get the app page to request a launch notification.",
  },
  {
    q: "Where do you operate?",
    a: "We publish city pages for major metros and expand coverage as verified partners come online. Availability depends on partner coverage at your service address — confirm in the app when you book.",
  },
  {
    q: "How does pricing work?",
    a: "Packages are priced by system capacity (kW band). City-tier surcharges may apply when your address maps to a geo tier. You always see the price before you confirm payment. See the Pricing page for published catalogue bands.",
  },
  {
    q: "What is included in an AMC plan?",
    a: "An AMC (annual maintenance contract) includes scheduled visits for your contract term. Visit entitlements depend on your system band and plan code, and are shown when you purchase. You can pause, resume, or cancel according to the terms shown in-app.",
  },
  {
    q: "How is a visit fulfilled?",
    a: "After you book, a verified partner accepts within the acceptance window and assigns a technician. The technician verifies a booking code with you, completes a safety checklist, runs the job timer, uploads before/after photos, and submits completion.",
  },
  {
    q: "Can I cancel a booking?",
    a: "Yes. A grace window applies after booking (typically one hour). Late cancellations may incur a fee that is shown before you confirm cancel. Full rules are in the Refund & Cancellation Policy.",
  },
  {
    q: "Is rooftop work safe?",
    a: "Partners and technicians follow mandatory safety checklists before starting. Site access and water availability are captured at registration. Methods aim to protect manufacturer warranties — always follow your module OEM guidance.",
  },
  {
    q: "How do I contact support?",
    a: `Email ${SUPPORT_EMAIL} or use in-app chat when signed in. Privacy requests go to privacy@oorjaman.com; legal enquiries to legal@oorjaman.com. We typically respond within one business day.`,
  },
  {
    q: "How do I delete my account?",
    a: "In the OorjaMan customer app go to Profile → Account → Delete account and type DELETE to confirm. Active bookings must be finished or cancelled first. You can also email support@oorjaman.com with subject “Account deletion request”. Full details are on the Account Deletion page.",
  },
  {
    q: "How do I become a partner?",
    a: "Visit the Partners page to review the partner programme and Vendor Partner Agreement. Apply via the partner portal when available, or email support@oorjaman.com with your city, team size, and GSTIN.",
  },
] as const;

export function faqPageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
