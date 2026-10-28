import { BRAND_TAGLINE, publicSiteBaseUrl } from "@oorjaman/config";

export const SITE_NAME = "OorjaMan";
export const SITE_TAGLINE = "Solar rooftop care - cleaning, maintenance & AMC";
export { BRAND_TAGLINE };

export const SUPPORT_EMAIL = "support@oorjaman.com";
export const PRIVACY_EMAIL = "privacy@oorjaman.com";
export const LEGAL_EMAIL = "legal@oorjaman.com";
export const INFO_EMAIL = "info@oorjaman.com";
export const GRIEVANCE_EMAIL = "grievance@oorjaman.com";

/**
 * Public support phone. Override with NEXT_PUBLIC_SUPPORT_PHONE.
 * Default is a dummy number for preview - replace before public launch.
 */
export const SUPPORT_PHONE = (
  process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "+91 80 4567 8900"
).trim();
export const SUPPORT_PHONE_TEL = SUPPORT_PHONE.replace(/[^\d+]/g, "");

/** Support hours shown in footer / contact. Dummy default until ops confirms. */
export const SUPPORT_HOURS =
  (process.env.NEXT_PUBLIC_SUPPORT_HOURS ?? "Mon-Sat, 9:00 AM - 6:00 PM IST").trim();

/**
 * Public Instagram profile. Override with NEXT_PUBLIC_INSTAGRAM_URL if the handle changes.
 * Canonical (no tracking query params).
 */
export const INSTAGRAM_URL = (
  process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://www.instagram.com/oorjaman/"
).trim();
export const INSTAGRAM_HANDLE = "@oorjaman";

/** Legal entity shown on About / Contact / legal pages. */
export const COMPANY_LEGAL_NAME = "OORJA MAN LLP";
/**
 * Registered office (full postal line preferred for Indian privacy / grievance /
 * consumer disclosures). Override with NEXT_PUBLIC_COMPANY_ADDRESS when the
 * real LLP registered office is confirmed. Current value is a dummy Guwahati address.
 */
export const COMPANY_ADDRESS = (
  process.env.NEXT_PUBLIC_COMPANY_ADDRESS ??
  "House No. 18, Bye Lane 2, Zoo Road Tiniali, Guwahati, Assam 781001, India"
).trim();
/** Optional - set NEXT_PUBLIC_COMPANY_GSTIN only when the real GSTIN is verified. */
export const COMPANY_GSTIN = (process.env.NEXT_PUBLIC_COMPANY_GSTIN ?? "").trim();

/**
 * Named Grievance Officer for public legal pages. Set
 * NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME before launch (Indian compliance expects a named officer).
 */
export const GRIEVANCE_OFFICER_NAME = (
  process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME ?? ""
).trim();

export function grievanceOfficerLabel(): string {
  return GRIEVANCE_OFFICER_NAME
    ? `${GRIEVANCE_OFFICER_NAME}, Grievance Officer, ${COMPANY_LEGAL_NAME}`
    : `Grievance Officer, ${COMPANY_LEGAL_NAME}`;
}

export function siteUrl(path = ""): string {
  const base = publicSiteBaseUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** True for public https URLs that are not localhost / private-dev hosts. */
export function isPublicHttpsUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Live customer store listings (App Store id from EAS `ascAppId`, Play package
 * `com.oorjaman.customer`). Override with NEXT_PUBLIC_* when a region/locale
 * URL is preferred. Empty override that fails `isPublicHttpsUrl` falls back.
 */
const DEFAULT_CUSTOMER_APP_STORE_URL = "https://apps.apple.com/app/id6818586874";
const DEFAULT_CUSTOMER_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.oorjaman.customer";

function envOrDefaultStoreUrl(envValue: string | undefined, fallback: string): string {
  const trimmed = (envValue ?? "").trim();
  return isPublicHttpsUrl(trimmed) ? trimmed : fallback;
}

/**
 * Customer store listing URLs. Defaults point at the live production listings.
 * `/download` shows official store badges when both resolve to public https URLs.
 */
export const APP_LINKS = {
  customerIos: envOrDefaultStoreUrl(
    process.env.NEXT_PUBLIC_APP_STORE_URL,
    DEFAULT_CUSTOMER_APP_STORE_URL,
  ),
  customerAndroid: envOrDefaultStoreUrl(
    process.env.NEXT_PUBLIC_PLAY_STORE_URL,
    DEFAULT_CUSTOMER_PLAY_STORE_URL,
  ),
  customerScheme: "oorjaman-customer://",
} as const;

export function customerStoreListingsLive(): boolean {
  return isPublicHttpsUrl(APP_LINKS.customerIos) && isPublicHttpsUrl(APP_LINKS.customerAndroid);
}

/**
 * Customer Expo Web app (CSR) — Universal Web host `app.oorjaman.com`.
 * When set, marketing CTAs can open the web product; SEO stays on this Next site.
 */
export function customerWebAppPublicUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_CUSTOMER_WEB_URL ?? "").trim();
  return isPublicHttpsUrl(raw) ? raw.replace(/\/$/, "") : null;
}

/** Login entry for the customer web app (Expo Router `/login`). */
export function customerWebLoginUrl(): string | null {
  const base = customerWebAppPublicUrl();
  return base ? `${base}/login` : null;
}

/**
 * Technician / Partner Expo Web app — Universal Web host `partner.oorjaman.com`.
 * Distinct from the vendor Vite portal (`NEXT_PUBLIC_VENDOR_PORTAL_URL`).
 */
export function partnerWebAppPublicUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_PARTNER_WEB_URL ?? "").trim();
  return isPublicHttpsUrl(raw) ? raw.replace(/\/$/, "") : null;
}

export function partnerWebLoginUrl(): string | null {
  const base = partnerWebAppPublicUrl();
  return base ? `${base}/login` : null;
}

/** Partner portal origin for signup CTA, or null when not safe to expose publicly. */
export function vendorPortalPublicUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_VENDOR_PORTAL_URL ?? "").trim();
  return isPublicHttpsUrl(raw) ? raw.replace(/\/$/, "") : null;
}
