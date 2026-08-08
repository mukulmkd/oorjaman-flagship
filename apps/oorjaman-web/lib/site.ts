import { BRAND_TAGLINE, publicSiteBaseUrl } from "@oorjaman/config";

export const SITE_NAME = "OorjaMan";
export const SITE_TAGLINE = "Solar rooftop care - cleaning, maintenance & AMC";
export { BRAND_TAGLINE };

export const SUPPORT_EMAIL = "support@oorjaman.com";
export const PRIVACY_EMAIL = "privacy@oorjaman.com";
export const LEGAL_EMAIL = "legal@oorjaman.com";
export const INFO_EMAIL = "info@oorjaman.com";

/** Legal entity shown on About / Contact (matches brand print defaults). */
export const COMPANY_LEGAL_NAME = "OORJA MAN LLP";
export const COMPANY_ADDRESS = "Bengaluru, Karnataka, India";
/** Optional — set NEXT_PUBLIC_COMPANY_GSTIN only when the real GSTIN is verified. */
export const COMPANY_GSTIN = (process.env.NEXT_PUBLIC_COMPANY_GSTIN ?? "").trim();

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
 * Customer store listing URLs. Leave env unset until listings are live —
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
