/**
 * OorjaMan brand wordmark + lockup colours (single source of truth).
 *
 * Sampled from `brand/source/` PNG masters. After updating logo masters, adjust
 * here and in `.cursor/rules/oorjaman-ui.mdc`, then run `npm run brand:sync`.
 */
export const BRAND_TAGLINE = "WE CLEAN. YOU GENERATE." as const;

export const brandColors = {
  /** “Oorja” — logo / lockup green */
  oorja: "#549048",
  /** “Man” — softened navy (readable blue on white; not near-black) */
  man: "#1C4276",
  /** Tagline + muted loading label */
  tagline: "#9B9B9B",
  /** Loading bar start / green accent endpoints */
  gradientGreen: "#549048",
  /** Loading bar end / blue accent endpoints */
  gradientBlue: "#1C4276",
} as const;

/** Alias used by customer-app wordmark components */
export const brandTextColors = brandColors;

export type BrandColorToken = keyof typeof brandColors;
