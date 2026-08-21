/**
 * Home marketing content.
 * Keep claims defensible — no invented ROI % or star ratings.
 */

export const heroHeadline = {
  eyebrow: "Solar rooftop care",
  headline: "Maximize rooftop performance",
  support:
    "Book panel cleaning and AMC with verified partners — transparent pricing, live tracking, and photo evidence when the visit closes.",
} as const;

/** Trust strip under the hero */
export const trustItems = [
  {
    title: "Verified partners",
    body: "Only approved vendors are visible on the marketplace.",
    icon: "shield" as const,
  },
  {
    title: "Transparent pricing",
    body: "kW-band packages with GST shown before you pay.",
    icon: "tag" as const,
  },
  {
    title: "Service tracking",
    body: "Live visit status while a job is active in the app.",
    icon: "pin" as const,
  },
  {
    title: "Completion evidence",
    body: "Safety checklist plus before/after photo proof.",
    icon: "camera" as const,
  },
] as const;

export const whyFeatures = [
  {
    title: "Safety first",
    body: "Technicians complete platform safety checklists before work starts on your rooftop.",
    icon: "shield" as const,
  },
  {
    title: "Verified partners",
    body: "Approved vendors stay accountable from acceptance through visit close.",
    icon: "check" as const,
  },
  {
    title: "Transparent pricing",
    body: "Clear kW-band packages before checkout — no opaque rooftop quotes.",
    icon: "tag" as const,
  },
  {
    title: "Proof of service",
    body: "Booking codes, visit tracking, and before/after evidence in the app.",
    icon: "camera" as const,
  },
] as const;

export const homeSteps = [
  {
    step: "01",
    title: "Book",
    body: "Register your site, pick a slot, and confirm pricing in the app.",
  },
  {
    step: "02",
    title: "Partner accepts",
    body: "A verified partner accepts within the window and assigns a technician.",
  },
  {
    step: "03",
    title: "Service",
    body: "Track the visit, share access notes, then start with a code and safety checks.",
  },
  {
    step: "04",
    title: "Evidence",
    body: "Review before/after photos and close the visit with a clear record.",
  },
] as const;

export const commercialPoints = [
  "Multi-site and society-block registration in one account",
  "Visit tracking and completion evidence for facilities teams and committees",
  "Clear packages sized for larger commercial and shared rooftop arrays",
] as const;
