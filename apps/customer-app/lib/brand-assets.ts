import { BRAND_TAGLINE, brandColors, type BrandTextColors } from "@oorjaman/config";

/** @deprecated Use `brandColors` */
export const brandTextColors: BrandTextColors = brandColors;

/** Central brand raster assets for the customer app. */
export const brandAssets = {
  logoIcon: require("../assets/brand/logo-icon.png"),
  sunburst: require("../assets/brand/sunburst.png"),
} as const;

export { BRAND_TAGLINE };
