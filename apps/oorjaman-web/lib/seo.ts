import type { Metadata } from "next";
import {
  isPublicMarketingIndexable,
  parseDeployEnvironment,
} from "@oorjaman/config";
import {
  COMPANY_ADDRESS,
  COMPANY_LEGAL_NAME,
  INSTAGRAM_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  siteUrl,
} from "./site";

const marketingIndexable = isPublicMarketingIndexable(
  parseDeployEnvironment({ siteUrl: process.env.NEXT_PUBLIC_SITE_URL }),
);

/** Synced brand lockup from `npm run brand:sync` → public/og-default.png */
const DEFAULT_OG = "/og-default.png";

/** Brand name variants Google may see in the wild (legal, spaced, domain-style). */
export const SITE_ALTERNATE_NAMES = [
  "Oorja Man",
  "OORJA MAN",
  "oorjaman",
  COMPANY_LEGAL_NAME,
] as const;

export const ORGANIZATION_ID = `${siteUrl()}/#organization`;
export const WEBSITE_ID = `${siteUrl()}/#website`;

type PageMetaInput = {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
};

export function buildPageMetadata({
  title,
  description,
  path,
  noIndex,
}: PageMetaInput): Metadata {
  const url = siteUrl(path);
  const fullTitle = title.includes(SITE_NAME)
    ? title
    : `${title} | ${SITE_NAME}`;

  return {
    title: fullTitle,
    description,
    metadataBase: new URL(siteUrl()),
    applicationName: SITE_NAME,
    authors: [{ name: SITE_NAME, url: siteUrl() }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    alternates: { canonical: url },
    robots:
      noIndex || !marketingIndexable
        ? { index: false, follow: false, nocache: true }
        : { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "en_IN",
      url,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      images: [{ url: DEFAULT_OG, width: 1200, height: 630, alt: `${SITE_NAME} — ${SITE_TAGLINE}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [DEFAULT_OG],
    },
  };
}

/**
 * Homepage brand query target — lead with OorjaMan so navigational searches
 * resolve to the hub (sitelinks may follow over time; not guaranteed).
 */
export const homeMetadata = buildPageMetadata({
  title: `${SITE_NAME} — Solar panel cleaning & AMC in India`,
  description: `${SITE_NAME} helps homeowners, housing societies, and businesses book professional solar rooftop cleaning and AMC through verified partners — transparent pricing, visit tracking, and completion evidence.`,
  path: "/",
});

export const defaultDescription = SITE_TAGLINE;

/** Sitewide Organization + WebSite graph for brand entity clarity. */
export function brandEntityJsonLd() {
  const logoUrl = siteUrl("/logo-icon.png");

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    alternateName: [...SITE_ALTERNATE_NAMES],
    legalName: COMPANY_LEGAL_NAME,
    url: siteUrl(),
    logo: {
      "@type": "ImageObject",
      url: logoUrl,
      width: 512,
      height: 512,
    },
    image: logoUrl,
    description: `${SITE_NAME} is a solar rooftop care marketplace in India for panel cleaning and annual maintenance (AMC), fulfilled by verified partners.`,
    email: SUPPORT_EMAIL,
    telephone: SUPPORT_PHONE,
    address: {
      "@type": "PostalAddress",
      streetAddress: COMPANY_ADDRESS,
      addressCountry: "IN",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SUPPORT_EMAIL,
        telephone: SUPPORT_PHONE,
        areaServed: "IN",
        availableLanguage: ["English", "Hindi"],
      },
    ],
    sameAs: [INSTAGRAM_URL],
    knowsAbout: [
      "Solar panel cleaning",
      "Solar rooftop AMC",
      "Solar O&M",
      "Housing society solar maintenance",
    ],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    alternateName: [...SITE_ALTERNATE_NAMES],
    url: siteUrl(),
    description: SITE_TAGLINE,
    inLanguage: "en-IN",
    publisher: { "@id": ORGANIZATION_ID },
    about: { "@id": ORGANIZATION_ID },
  };

  return [organization, website];
}
