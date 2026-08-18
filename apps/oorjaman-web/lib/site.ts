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
 * Customer store listing URLs. Leave env unset until listings are live -
 * `/download` then shows a notify / waitlist path instead of broken buttons.
 */
export const APP_LINKS = {
  customerIos: (process.env.NEXT_PUBLIC_APP_STORE_URL ?? "").trim(),
  customerAndroid: (process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? "").trim(),
  customerScheme: "oorjaman-customer://",
} as const;

export function customerStoreListingsLive(): boolean {
  return isPublicHttpsUrl(APP_LINKS.customerIos) && isPublicHttpsUrl(APP_LINKS.customerAndroid);
}

/** Partner portal origin for signup CTA, or null when not safe to expose publicly. */
export function vendorPortalPublicUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_VENDOR_PORTAL_URL ?? "").trim();
  return isPublicHttpsUrl(raw) ? raw.replace(/\/$/, "") : null;
}
