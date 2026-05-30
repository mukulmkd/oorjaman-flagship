import { publicSiteBaseUrl } from "@oorjaman/config";

export const SITE_NAME = "OorjaMan";
export const SITE_TAGLINE = "Solar rooftop care - cleaning, maintenance & AMC";
export const SUPPORT_EMAIL = "support@oorjaman.com";
export const PRIVACY_EMAIL = "privacy@oorjaman.com";
export const LEGAL_EMAIL = "legal@oorjaman.com";

export function siteUrl(path = ""): string {
  const base = publicSiteBaseUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export const APP_LINKS = {
  customerIos: "https://apps.apple.com/app/oorjaman",
  customerAndroid:
    "https://play.google.com/store/apps/details?id=com.oorjaman.customer",
  customerScheme: "oorjaman-customer://",
} as const;
