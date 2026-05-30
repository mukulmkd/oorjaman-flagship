import type { MetadataRoute } from "next";
import { isPublicMarketingIndexable, parseDeployEnvironment } from "@oorjaman/config";

export const dynamic = "force-static";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const indexable = isPublicMarketingIndexable(
    parseDeployEnvironment({ siteUrl: process.env.NEXT_PUBLIC_SITE_URL }),
  );

  if (!indexable) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl(),
  };
}
