import { BRAND_TAGLINE, brandTextColors } from "@oorjaman/config";

/** Central brand raster assets for the OorjaMan Partner field app. */
export const brandAssets = {
  logoIcon: require("../assets/brand/logo-icon.png"),
  logoLockupTagline: require("../assets/brand/logo-lockup-tagline.png"),
  sunburst: require("../assets/brand/sunburst.png"),
  splashProgressLottie: require("../assets/brand/splash-progress.json"),
} as const;

/** Splash / onboarding tagline — field workflow, not customer booking. */
export const PARTNER_APP_TAGLINE = "ASSIGNED. ON SITE. ACCOUNTABLE." as const;

export { BRAND_TAGLINE, brandTextColors };
