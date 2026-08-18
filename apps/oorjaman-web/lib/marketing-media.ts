import { existsSync } from "node:fs";
import path from "node:path";
import { showAppScreenshots } from "./launch-flags";

/**
 * Optional marketing media under `public/marketing/` (see README + ATTRIBUTION.md).
 * When missing, UI keeps gradient / mock fallbacks - no broken images.
 */
const PUBLIC_ROOT = path.join(process.cwd(), "public");

function resolvePublicAsset(...candidates: string[]): string | null {
  for (const relativeFromPublic of candidates) {
    const cleaned = relativeFromPublic.replace(/^\/+/, "");
    const full = path.join(PUBLIC_ROOT, cleaned);
    if (existsSync(full)) return `/${cleaned}`;
  }
  return null;
}

export type MarketingMedia = {
  /** Full-bleed / hero atmosphere photo */
  heroPhoto: string | null;
  /** Optional muted looping hero video (preferred over photo when present) */
  heroVideo: string | null;
  /** Why-us stage background (behind phone mock) */
  whyUsPhoto: string | null;
  /** Optional muted looping why-us video (preferred over photo when present) */
  whyUsVideo: string | null;
};

export function getMarketingMedia(): MarketingMedia {
  return {
    heroPhoto: resolvePublicAsset("marketing/hero-rooftop.jpg", "marketing/hero-rooftop.webp"),
    heroVideo: resolvePublicAsset("marketing/hero-rooftop.mp4", "marketing/hero-rooftop.webm"),
    whyUsPhoto: resolvePublicAsset("marketing/why-us-visit.jpg", "marketing/why-us-visit.webp"),
    whyUsVideo: resolvePublicAsset("marketing/why-us-rooftop.mp4", "marketing/why-us-rooftop.webm"),
  };
}

/** App screenshots for /download - drop PNGs under public/marketing/screenshots/. Hidden until showAppScreenshots. */
export function getAppScreenshotSlots(): {
  booking: string | null;
  tracking: string | null;
  evidence: string | null;
} {
  if (!showAppScreenshots) {
    return { booking: null, tracking: null, evidence: null };
  }
  return {
    booking: resolvePublicAsset(
      "marketing/screenshots/booking.png",
      "marketing/screenshots/booking.webp",
      "marketing/screenshots/booking.jpg",
    ),
    tracking: resolvePublicAsset(
      "marketing/screenshots/tracking.png",
      "marketing/screenshots/tracking.webp",
      "marketing/screenshots/tracking.jpg",
    ),
    evidence: resolvePublicAsset(
      "marketing/screenshots/evidence.png",
      "marketing/screenshots/evidence.webp",
      "marketing/screenshots/evidence.jpg",
    ),
  };
}
