import { isCityPublished } from "./launch-flags";

export type CityLanding = {
  slug: string;
  name: string;
  state: string;
  headline: string;
  intro: string;
  localNotes: string[];
};

/**
 * Metro landings for local SEO. Copy stays coverage-honest: availability depends on
 * verified partners at the service address.
 */
export const cityLandings: CityLanding[] = [
  {
    slug: "bengaluru",
    name: "Bengaluru",
    state: "Karnataka",
    headline: "Solar panel cleaning & AMC in Bengaluru",
    intro:
      "Bengaluru’s mix of dry seasons, construction dust, and pollen means rooftop modules often need structured cleaning - not an occasional hose-down. Residential layouts in Whitefield, Sarjapur, Electronic City, and the ORR corridor, plus commercial sheds in Peenya and Bommasandra, all see soiling that can drag inverter output between rains. OorjaMan helps homeowners and facilities teams book one-time solar panel cleaning or annual maintenance (AMC) through the customer app, with transparent kW-band pricing before you pay. Verified partners accept jobs within the acceptance window, assign technicians, and close visits with safety checklists and before/after photo evidence. Service is available where partner coverage maps to your address - confirm availability when you book. If you manage multiple sites across the city, contact support for rollout planning while you register each rooftop with access and water notes so technicians arrive prepared.",
    localNotes: [
      "Book one-time visits or AMC plans sized to your kW band in the customer app.",
      "City-tier pricing surcharges apply when your service address maps to a geo tier.",
      "Track technicians during active visits and review completion evidence in-app.",
      "Capture rooftop access and water availability at registration for smoother jobs.",
    ],
  },
  {
    slug: "mumbai",
    name: "Mumbai",
    state: "Maharashtra",
    headline: "Solar panel cleaning & AMC in Mumbai",
    intro:
      "Coastal humidity, saline air near the shore, and dense urban grime affect yield on Mumbai and Navi Mumbai rooftops - from Andheri and Powai housing societies to industrial terraces further east. Panels that look only lightly dusty can still lose meaningful current until a professional clean restores performance. OorjaMan connects you with verified solar O&M partners for one-time cleaning visits and AMC plans, booked in the customer app with prices shown before checkout. Partners follow safety checklists suited to multi-storey access constraints you capture during site registration. Availability depends on partner coverage at your pin code when you book; city pages help you plan, while the app confirms whether a visit can be fulfilled. Support remains available via in-app chat and support@oorjaman.com for booking or payment questions.",
    localNotes: [
      "Verified partners follow safety checklists for multi-storey and society access.",
      "Transparent package pricing before checkout in the OorjaMan app.",
      "Support via in-app chat and support@oorjaman.com.",
      "Register water and access notes so technicians plan for terrace constraints.",
    ],
  },
  {
    slug: "delhi-ncr",
    name: "Delhi NCR",
    state: "Delhi / NCR",
    headline: "Solar panel cleaning & AMC in Delhi NCR",
    intro:
      "Seasonal dust storms, construction particulate, and winter smog layers reduce output across Delhi, Gurugram, Noida, and Faridabad installations. Many owners notice production dips after dry spells or festival periods when soot and debris settle on glass. Structured AMC visits help maintain production through the year instead of waiting for a visible drop. With OorjaMan you register residential or commercial sites, choose one-time cleaning or an AMC plan by capacity band, and track fulfilment with safety checks and photo evidence. Late-cancellation rules are shown in-app before you confirm a cancel. Coverage expands with verified partners - use the app to confirm service at your address. Multi-site businesses across NCR can email support to discuss sequencing while each rooftop is registered with accurate access details.",
    localNotes: [
      "Residential and commercial sites supported at registration.",
      "Late-cancellation rules shown in-app before you confirm cancel.",
      "Get the customer app to book your first visit when coverage allows.",
      "AMC plans help schedule cleans through dust and winter pollution seasons.",
    ],
  },
  {
    slug: "hyderabad",
    name: "Hyderabad",
    state: "Telangana",
    headline: "Solar panel cleaning & AMC in Hyderabad",
    intro:
      "Hyderabad’s gated communities, IT campuses, and warehouse solar create varied rooftop access needs - ladder points, terrace permissions, and water availability differ block to block. Capturing those details during site registration helps technicians arrive prepared and keeps visits efficient. Dust and dry spells still cut yield between monsoons, so owners often prefer AMC entitlements over ad-hoc calls. OorjaMan offers one-time solar panel cleaning and annual maintenance plans with transparent pricing, partner acceptance workflows, and completion evidence in the app. Partners onboard through the OorjaMan partner programme so only approved vendors are visible for booking. Confirm coverage for your locality in the app; city pages describe demand drivers, not a guarantee of same-day availability everywhere in the metro.",
    localNotes: [
      "AMC plans with scheduled visit entitlements per contract.",
      "Photo evidence and visit summaries after each job.",
      "Partners onboarded through the OorjaMan partner programme.",
      "Share access constraints at registration for gated-community sites.",
    ],
  },
  {
    slug: "chennai",
    name: "Chennai",
    state: "Tamil Nadu",
    headline: "Solar panel cleaning & AMC in Chennai",
    intro:
      "Salt air near the coast and urban dust inland both call for preventive cleaning on Chennai rooftops. Coastal installations can accumulate film faster; inland sites still face dry-season soiling that reduces generation until glass is cleared with warranty-conscious methods. OorjaMan packages one-time visits by system capacity band and publishes AMC options for owners who want recurring care. Per-panel reference pricing supports transparency alongside package totals. Verified partners complete safety checklists and upload evidence so facilities and homeowners can audit the visit. Account deletion, privacy, and refund policies are published on oorjaman.com for store and customer compliance. As with other metros, book only when the app shows partner coverage for your address.",
    localNotes: [
      "One-time cleaning visits by system capacity band.",
      "Per-panel reference pricing for transparency.",
      "Privacy, terms, and account deletion policies on oorjaman.com.",
      "Coastal vs inland soiling patterns - schedule AMC if output dips between rains.",
    ],
  },
  {
    slug: "pune",
    name: "Pune",
    state: "Maharashtra",
    headline: "Solar panel cleaning & AMC in Pune",
    intro:
      "Pune’s growing residential solar base in Hinjewadi, Baner, Wakad, and surrounding townships benefits from scheduled AMC maintenance rather than emergency cleans after a long dry stretch. Societies and villas often share terrace access rules that technicians must respect; registering those notes up front avoids failed visits. OorjaMan lets you book slots that fit your calendar, see geo-tier add-ons when your city maps to a catalogue tier, and track jobs with live status and photo evidence. Commercial multi-site enquiries can reach support while individual rooftops are onboarded in the app. Coverage grows with verified partners - treat city landings as planning guides and confirm fulfilment at booking time.",
    localNotes: [
      "Book slots that fit your calendar in the customer app.",
      "Geo-tier add-ons stack when your city maps to a catalogue tier.",
      "Contact support for multi-site commercial enquiries.",
      "Society access notes at registration reduce day-of delays.",
    ],
  },
];

export function getCityLanding(slug: string): CityLanding | undefined {
  return cityLandings.find((c) => c.slug === slug);
}

export function publishedCityLandings(): CityLanding[] {
  return cityLandings.filter((c) => isCityPublished(c.slug));
}

export function getPublishedCityLanding(slug: string): CityLanding | undefined {
  const city = getCityLanding(slug);
  return city && isCityPublished(city.slug) ? city : undefined;
}
