/**
 * Home marketing content. Dummy testimonials are published for preview.
 * Replace with permissioned quotes before public launch.
 */

export const heroSlides = [
  {
    id: "performance",
    eyebrow: "Technology marketplace",
    headline: "Maximize rooftop performance",
    support:
      "Book professional solar panel cleaning and AMC through verified partners - tracked from acceptance to completion.",
  },
  {
    id: "output",
    eyebrow: "Clean panels. Clear output.",
    headline: "More generation. Less chase.",
    support:
      "Dust and debris cut yield. OorjaMan connects you with trained technicians so your system works as hard as it should.",
  },
  {
    id: "protect",
    eyebrow: "Safety-first visits",
    headline: "Protect your solar investment",
    support:
      "Booking codes, safety checklists, and before/after evidence - so every visit is accountable and warranty-conscious.",
  },
] as const;

/** Defensible platform facts (not invented ROI %). */
export const proofItems = [
  { value: "1 hr", label: "Partner acceptance window on new bookings" },
  { value: "Guwahati", label: "First service market - more cities as partners go live" },
  { value: "GST", label: "Transparent catalogue pricing with tax included" },
  { value: "Live", label: "Visit tracking while a job is active" },
] as const;

export const whyFeatures = [
  {
    title: "Verified partners",
    body: "Only approved vendors are visible. Technicians follow platform safety and evidence workflows.",
  },
  {
    title: "Transparent pricing",
    body: "kW-band packages and geo-tier notes shown before you pay - no opaque rooftop quotes.",
  },
  {
    title: "Track every visit",
    body: "Status, en-route visibility, and completion photos in the customer app.",
  },
] as const;

export const homeSteps = [
  {
    step: "01",
    title: "Register your site",
    body: "Add rooftop details, photos, access notes, and water availability.",
  },
  {
    step: "02",
    title: "Book a slot",
    body: "Choose one-time cleaning or an AMC plan and confirm pricing in-app.",
  },
  {
    step: "03",
    title: "Partner accepts",
    body: "A verified partner accepts within the window and assigns a technician.",
  },
  {
    step: "04",
    title: "Track & close",
    body: "Follow progress, codes, and photo evidence until the visit is complete.",
  },
] as const;

/**
 * Dummy quotes so the home testimonials band is visible in preview.
 * Replace names, roles, and quotes with permissioned reviews, or set
 * placeholder: true to hide a quote until it is real.
 */
export const homeTestimonials = [
  {
    quote:
      "Booking and tracking in one place is what we needed - no endless calls to find a rooftop crew.",
    name: "Ananya Rao",
    role: "Homeowner · Bengaluru",
    placeholder: true,
  },
  {
    quote:
      "Clear package pricing before pay made it easy to approve AMC for our society terrace.",
    name: "Rahul Mehta",
    role: "Facilities lead · Pune",
    placeholder: true,
  },
  {
    quote:
      "Safety checklist and photo evidence gave us confidence the visit actually happened.",
    name: "Kavita Iyer",
    role: "Commercial rooftop · Chennai",
    placeholder: true,
  },
] as const;

/** True once real quotes exist (set placeholder: false on each published quote). */
export const showHomeTestimonials = homeTestimonials.some((t) => !t.placeholder);

/** Published quotes only - used when showHomeTestimonials is true. */
export const publishedHomeTestimonials = homeTestimonials.filter((t) => !t.placeholder);

/** Home “who it’s for” cards - shown instead of testimonials pre-launch. */
export const audienceCards = [
  {
    href: "/for-homeowners",
    title: "Homeowners",
    body: "Book a clean or start an AMC for your rooftop - track the visit without managing vendors yourself.",
    cta: "For homeowners",
  },
  {
    href: "/for-businesses",
    title: "Businesses & societies",
    body: "Multi-site rooftops, clearer scheduling, and evidence after every visit for facilities teams.",
    cta: "For businesses",
  },
  {
    href: "/partners",
    title: "Service partners",
    body: "Join as a verified vendor, accept jobs in your service area, and settle through the partner portal.",
    cta: "Become a partner",
  },
] as const;

export const homeServices = [
  {
    href: "/services/panel-cleaning",
    index: "01",
    title: "Panel cleaning",
    body: "One-time rooftop visits sized to your system capacity - clear pricing before you pay.",
  },
  {
    href: "/services/amc-maintenance",
    index: "02",
    title: "AMC maintenance",
    body: "Annual plans with scheduled visits so yield stays steady through dust and seasons.",
  },
  {
    href: "/partners",
    index: "03",
    title: "Partner network",
    body: "Verified vendors and technicians trained for safe solar O&M - grow with the platform.",
  },
] as const;
