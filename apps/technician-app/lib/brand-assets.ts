import { BRAND_TAGLINE, brandColors, type BrandTextColors } from "@oorjaman/config";

/** @deprecated Use `brandColors` */
export const brandTextColors: BrandTextColors = brandColors;

/** Central brand raster assets for the OorjaMan Partner field app. */
export const brandAssets = {
  logoIcon: require("../assets/brand/logo-icon.png"),
  sunburst: require("../assets/brand/sunburst.png"),
} as const;

/** Same platform tagline as customer app and partner portal. */
export const PARTNER_APP_TAGLINE = BRAND_TAGLINE;

export { BRAND_TAGLINE };
