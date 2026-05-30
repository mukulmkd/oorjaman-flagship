/** Canonical public marketing site (oorjaman-web). Override via env in each app. */
export const DEFAULT_PUBLIC_SITE_URL = "https://oorjaman.com";

export function publicSiteBaseUrl(override?: string | null): string {
  const base = (override ?? process.env.NEXT_PUBLIC_SITE_URL ?? process.env.EXPO_PUBLIC_SITE_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  return base || DEFAULT_PUBLIC_SITE_URL;
}

export function publicLegalPath(path: string, baseUrl?: string | null): string {
  const base = publicSiteBaseUrl(baseUrl);
  const slug = path.startsWith("/") ? path : `/${path}`;
  return `${base}${slug}`;
}

export const publicLegalUrls = {
  index: () => publicLegalPath("/legal"),
  privacy: () => publicLegalPath("/legal/privacy-policy"),
  terms: () => publicLegalPath("/legal/terms-of-service"),
  cookies: () => publicLegalPath("/legal/cookie-policy"),
  acceptableUse: () => publicLegalPath("/legal/acceptable-use"),
  refunds: () => publicLegalPath("/legal/refund-cancellation"),
  community: () => publicLegalPath("/legal/community-guidelines"),
  vendorAgreement: () => publicLegalPath("/legal/vendor-partner-agreement"),
  dataProcessing: () => publicLegalPath("/legal/data-processing"),
  accountDeletion: () => publicLegalPath("/legal/account-deletion"),
  contact: () => publicLegalPath("/contact"),
  download: () => publicLegalPath("/download"),
} as const;
