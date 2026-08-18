/**
 * Dummy visit stories for marketing preview (not live customer case studies).
 * Hidden until `showVisitStories` is true in lib/launch-flags.ts.
 */

export type VisitStory = {
  slug: string;
  title: string;
  segment: string;
  summary: string;
  outcome: string;
  steps: string[];
  /** Optional stock/public marketing image under /public */
  image?: string;
};

export const visitStories: VisitStory[] = [
  {
    slug: "residential-first-clean",
    title: "First clean after a dry season",
    segment: "Homeowner · Whitefield (sample)",
    summary:
      "A residential rooftop books a one-time clean after noticing lower daytime generation. Site details and water notes are captured in the app before a partner accepts.",
    outcome: "Visit closed with booking-code start, safety checklist, and before/after photos in the customer timeline.",
    steps: [
      "Customer registers capacity and access notes",
      "Confirms kW-band package price in-app",
      "Verified partner accepts within the response window",
      "Technician completes evidence-backed visit",
    ],
    image: "/marketing/residential-visit.jpg",
  },
  {
    slug: "society-amc-rhythm",
    title: "Society terrace on an AMC rhythm",
    segment: "Housing society · AMC (sample)",
    summary:
      "A society committee chooses an annual plan so cleaning is scheduled instead of emergency call-outs. Upcoming visits are generated from the subscription.",
    outcome: "Facilities get predictable slots, entitlements in-app, and completion evidence after each visit.",
    steps: [
      "Select AMC plan by system band",
      "Platform schedules included visits",
      "Partner network fulfils each slot",
      "Pause or adjust per plan terms when needed",
    ],
    image: "/marketing/service-amc.jpg",
  },
  {
    slug: "commercial-multi-site",
    title: "Commercial site with live tracking",
    segment: "Business · facilities (sample)",
    summary:
      "A facilities lead books cleaning for a warehouse rooftop and wants visibility while the crew is on site - without coordinating vendors on WhatsApp threads.",
    outcome: "En-route tracking and job status reduce follow-up calls; photo evidence supports internal sign-off.",
    steps: [
      "Book from the customer app",
      "Partner assigns a verified technician",
      "Customer sees live visit status",
      "Report and photos available after completion",
    ],
    image: "/marketing/crew-cleaning.jpg",
  },
];

export function getVisitStory(slug: string): VisitStory | undefined {
  return visitStories.find((s) => s.slug === slug);
}
