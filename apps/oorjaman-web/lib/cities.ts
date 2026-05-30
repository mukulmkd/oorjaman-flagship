export type CityLanding = {
  slug: string;
  name: string;
  state: string;
  headline: string;
  intro: string;
  localNotes: string[];
};

/** Top metros for programmatic local SEO (expand in SEO.md). */
export const cityLandings: CityLanding[] = [
  {
    slug: "bengaluru",
    name: "Bengaluru",
    state: "Karnataka",
    headline: "Solar panel cleaning & AMC in Bengaluru",
    intro:
      "High dust and pollen across Bengaluru rooftops make regular panel cleaning worthwhile for residential layouts in Whitefield, Sarjapur, and the ORR corridor, as well as commercial sheds in Peenya and Bommasandra.",
    localNotes: [
      "Book one-time visits or annual AMC plans sized to your kW band.",
      "City-tier pricing surcharges apply when your service address maps to a geo tier.",
      "Track technicians in the app during active visits.",
    ],
  },
  {
    slug: "mumbai",
    name: "Mumbai",
    state: "Maharashtra",
    headline: "Solar panel cleaning & AMC in Mumbai",
    intro:
      "Coastal humidity and urban grime affect yield on Mumbai rooftops-from Andheri and Powai housing societies to Navi Mumbai industrial terraces.",
    localNotes: [
      "Verified partners follow safety checklists for multi-storey access.",
      "Transparent package pricing before checkout in the OorjaMan app.",
      "Support via in-app chat and support@oorjaman.com.",
    ],
  },
  {
    slug: "delhi-ncr",
    name: "Delhi NCR",
    state: "Delhi / NCR",
    headline: "Solar panel cleaning & AMC in Delhi NCR",
    intro:
      "Seasonal dust storms and winter smog layers reduce output across Delhi, Gurugram, and Noida installations. Structured AMC visits help maintain production through the year.",
    localNotes: [
      "Residential and commercial sites supported at registration.",
      "Late-cancellation rules shown in-app before you confirm cancel.",
      "Download the customer app to book your first visit.",
    ],
  },
  {
    slug: "hyderabad",
    name: "Hyderabad",
    state: "Telangana",
    headline: "Solar panel cleaning & AMC in Hyderabad",
    intro:
      "Hyderabad’s mix of gated communities and warehouse solar means varied access needs-captured during site registration so technicians arrive prepared.",
    localNotes: [
      "AMC plans with scheduled visit entitlements per contract.",
      "Photo evidence and visit summaries after each job.",
      "Partners onboarded through the OorjaMan partner programme.",
    ],
  },
  {
    slug: "chennai",
    name: "Chennai",
    state: "Tamil Nadu",
    headline: "Solar panel cleaning & AMC in Chennai",
    intro:
      "Salt air near the coast and urban dust inland both call for preventive cleaning on Chennai rooftops, with warranty-conscious methods from trained partners.",
    localNotes: [
      "One-time cleaning visits by system capacity band.",
      "Per-panel reference pricing for transparency.",
      "Account deletion and privacy policies on oorjaman.com.",
    ],
  },
  {
    slug: "pune",
    name: "Pune",
    state: "Maharashtra",
    headline: "Solar panel cleaning & AMC in Pune",
    intro:
      "Pune’s growing residential solar base in Hinjewadi, Baner, and Wakad benefits from scheduled AMC maintenance rather than ad-hoc hose-downs.",
    localNotes: [
      "Book slots that fit your calendar in the customer app.",
      "Geo-tier add-ons stacked when your city maps to a catalogue tier.",
      "Contact support for multi-site commercial enquiries.",
    ],
  },
];

export function getCityLanding(slug: string): CityLanding | undefined {
  return cityLandings.find((c) => c.slug === slug);
}
