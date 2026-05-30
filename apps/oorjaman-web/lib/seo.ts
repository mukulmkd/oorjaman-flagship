import type { Metadata } from "next";
import {
  isPublicMarketingIndexable,
  parseDeployEnvironment,
} from "@oorjaman/config";
import { SITE_NAME, SITE_TAGLINE, siteUrl } from "./site";

const marketingIndexable = isPublicMarketingIndexable(
  parseDeployEnvironment({ siteUrl: process.env.NEXT_PUBLIC_SITE_URL }),
);

/** Served by app/opengraph-image.tsx */
const DEFAULT_OG = "/opengraph-image";

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
      images: [{ url: DEFAULT_OG, width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [DEFAULT_OG],
    },
  };
}

export const homeMetadata = buildPageMetadata({
  title: `${SITE_NAME} - Solar panel cleaning & AMC in India`,
  description:
    "Book professional solar rooftop cleaning and annual maintenance (AMC). Verified partners, transparent pricing, and real-time visit tracking.",
  path: "/",
});

export const defaultDescription = SITE_TAGLINE;
