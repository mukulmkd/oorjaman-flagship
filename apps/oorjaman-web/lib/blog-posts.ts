export type BlogPost = {
  slug: string;
  title: string;
  published: string;
  excerpt: string;
  paragraphs: string[];
};

/** Starter posts for content SEO - add more in `content/blog/` later (see SEO.md). */
export const blogPosts: BlogPost[] = [
  {
    slug: "why-clean-solar-panels",
    title: "Why clean solar panels matter in Indian cities",
    published: "2026-05-01",
    excerpt:
      "Dust, pollen, and bird droppings can cut rooftop yield. Here is what homeowners should plan for.",
    paragraphs: [
      "Most Indian metros see enough airborne dust that panels lose a noticeable share of output between rains. Cleaning is not cosmetic-it restores current to your inverter.",
      "OorjaMan packages visits by system size so you pay for a defined scope, not an open-ended hourly rate. AMC plans spread visits across the year for steadier production.",
      "Always follow your module manufacturer’s maintenance guidance; our partners are trained for warranty-safe methods, not abrasive scrubbing.",
    ],
  },
  {
    slug: "amc-vs-one-time-cleaning",
    title: "AMC vs one-time cleaning: which fits your rooftop?",
    published: "2026-05-10",
    excerpt:
      "Compare annual maintenance contracts with on-demand visits before you book.",
    paragraphs: [
      "One-time visits suit new owners validating service quality or addressing a visible soiling event after construction or festivals.",
      "AMC contracts bundle multiple visits per year by kW band-better when you want reminders, entitlements, and renewal nudges in the app.",
      "Both options stack with city-tier surcharges where your address maps to a geo tier in our catalogue.",
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
