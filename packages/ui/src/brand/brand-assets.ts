import { BRAND_TAGLINE, brandColors, typography, type BrandTextColors } from "@oorjaman/config";

/** @deprecated Use `brandColors` */
export const brandTextColors: BrandTextColors = brandColors;

/** Shared brand raster assets for mobile apps (synced via `npm run brand:sync`). */
export const brandAssets = {
  logoIcon: require("../../assets/brand/logo-icon.png"),
  sunburst: require("../../assets/brand/sunburst.png"),
} as const;

export { BRAND_TAGLINE };

export const mobileBrandFontSize = typography.size;
