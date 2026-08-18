export type BlogPost = {
  slug: string;
  title: string;
  published: string;
  excerpt: string;
  paragraphs: string[];
};

/** Marketing blog posts for content SEO - expand over time (see SEO.md). */
export const blogPosts: BlogPost[] = [
  {
    slug: "why-clean-solar-panels",
    title: "Why clean solar panels matter in Indian cities",
    published: "2026-05-01",
    excerpt:
      "Dust, pollen, and bird droppings can cut rooftop yield. Here is what homeowners should plan for.",
    paragraphs: [
      "Most Indian metros see enough airborne dust that panels lose a noticeable share of output between rains. Cleaning is not cosmetic - it restores current to your inverter and helps you get the generation you paid for when you installed the system.",
      "Soiling looks different by city. Coastal humidity and salt film behave differently from inland construction dust or winter smog layers. Bird droppings and leaf litter create hot spots of shading that a light rinse may not remove safely without the right tools and water plan.",
      "OorjaMan packages visits by system size so you pay for a defined scope, not an open-ended hourly rate. AMC plans spread visits across the year for steadier production instead of waiting until the drop is obvious on your monitoring app.",
      "Always follow your module manufacturer’s maintenance guidance. Our partners are trained for warranty-safe methods - not abrasive scrubbing or harsh chemicals that risk coating damage. Register water availability and rooftop access when you add a site so the technician arrives prepared.",
      "If you are deciding between a one-time clean and an annual plan, start with a single visit to validate quality, then move to AMC once you trust the rhythm. Transparent pricing and photo evidence after each job make that decision easier.",
    ],
  },
  {
    slug: "amc-vs-one-time-cleaning",
    title: "AMC vs one-time cleaning: which fits your rooftop?",
    published: "2026-05-10",
    excerpt:
      "Compare annual maintenance contracts with on-demand visits before you book.",
    paragraphs: [
      "One-time visits suit new owners validating service quality, or anyone addressing a visible soiling event after construction, festivals, or a long dry spell. You pick a slot, confirm the package price for your kW band, and track the visit like any other booking.",
      "AMC contracts bundle multiple visits per year by capacity band. They are better when you want reminders, visit entitlements, and renewal nudges in the app - especially in cities where dust returns quickly after each clean.",
      "Both options stack with city-tier surcharges where your address maps to a geo tier in our catalogue. You always see the amount before you pay. Grace and late-cancellation rules are published in the Refund & Cancellation Policy and shown in-app when you cancel.",
      "Commercial sites with multiple rooftops often mix approaches: an AMC on the primary plant and one-time cleans for overflow or newly commissioned arrays. Register each site with accurate capacity and access notes so partners can staff correctly.",
      "Not sure which path to take? Book a one-time clean first, review the photo evidence, then upgrade to AMC if you want the calendar handled for you. Pricing details live on the Pricing page; fulfilment depends on verified partner coverage at your address.",
    ],
  },
  {
    slug: "what-happens-on-a-cleaning-visit",
    title: "What happens on an OorjaMan cleaning visit",
    published: "2026-05-18",
    excerpt:
      "From booking code to photo evidence - the steps that keep rooftop jobs safe and accountable.",
    paragraphs: [
      "After you book, a verified partner accepts within the acceptance window and assigns a technician. You receive a booking code that must be verified on site before work starts - this protects you from unauthorised visits and confirms the right job is underway.",
      "The technician completes a safety checklist, starts the job timer, and captures before-cleaning photos. Cleaning follows warranty-conscious methods suited to your module type; water and access constraints you registered earlier guide how the team works.",
      "When cleaning and any agreed inspection steps are done, after photos are uploaded and the completion report is submitted. You can follow status in the customer app during the active visit and review evidence afterward.",
      "If something looks wrong - wrong address notes, incomplete evidence, or a safety concern - contact support@oorjaman.com or use in-app chat promptly so we can investigate with the partner. Refund and cancellation rules remain as published in our legal policies.",
      "This workflow is why OorjaMan is more than a phone number for a cleaner: scheduling, safety, evidence, and settlements sit on one platform for customers and partners alike.",
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
