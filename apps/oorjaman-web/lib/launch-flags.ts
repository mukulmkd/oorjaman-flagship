/**
 * Pre-launch switches for the marketing site.
 * Flip to true when you are ready to publish that surface.
 */
export const showVisitStories = false;

/** Home why-us app preview + /download screenshot frames. */
export const showAppScreenshots = false;

/**
 * City landing pages. Home Coverage, /cities, nav, and sitemap only include
 * cities set to true. Leave all false for a single-market launch (Guwahati).
 */
export const publishedCities: Record<
  "bengaluru" | "mumbai" | "delhi-ncr" | "hyderabad" | "chennai" | "pune",
  boolean
> = {
  bengaluru: false,
  mumbai: false,
  "delhi-ncr": false,
  hyderabad: false,
  chennai: false,
  pune: false,
};

export type PublishedCitySlug = keyof typeof publishedCities;

export function isCityPublished(slug: string): boolean {
  return slug in publishedCities && publishedCities[slug as PublishedCitySlug];
}

export const showCityCoverage = Object.values(publishedCities).some(Boolean);
