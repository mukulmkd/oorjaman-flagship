import type { MetadataRoute } from "next";
import { isPublicMarketingIndexable, parseDeployEnvironment } from "@oorjaman/config";

export const dynamic = "force-static";
import { blogPosts } from "@/lib/blog-posts";
import { cityLandings } from "@/lib/cities";
import { legalDocuments } from "@/lib/legal-docs";
import { siteUrl } from "@/lib/site";

const staticPaths = [
  "",
  "/how-it-works",
  "/services/panel-cleaning",
  "/services/amc-maintenance",
  "/for-homeowners",
  "/for-businesses",
  "/partners",
  "/pricing",
  "/safety",
  "/faq",
  "/about",
  "/contact",
  "/download",
  "/legal",
  "/cities",
  "/blog",
];

export default function sitemap(): MetadataRoute.Sitemap {
  if (
    !isPublicMarketingIndexable(parseDeployEnvironment({ siteUrl: process.env.NEXT_PUBLIC_SITE_URL }))
  ) {
    return [];
  }

  const now = new Date();
  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: siteUrl(path),
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path.startsWith("/legal") ? 0.6 : 0.8,
  }));

  for (const doc of legalDocuments) {
    entries.push({
      url: siteUrl(`/legal/${doc.slug}`),
      lastModified: new Date(doc.lastUpdated),
      changeFrequency: "yearly",
      priority: 0.5,
    });
  }

  for (const city of cityLandings) {
    entries.push({
      url: siteUrl(`/cities/${city.slug}`),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.75,
    });
  }

  for (const post of blogPosts) {
    entries.push({
      url: siteUrl(`/blog/${post.slug}`),
      lastModified: new Date(post.published),
      changeFrequency: "monthly",
      priority: 0.65,
    });
  }

  return entries;
}
