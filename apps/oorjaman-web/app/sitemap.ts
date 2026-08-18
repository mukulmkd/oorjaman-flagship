import type { MetadataRoute } from "next";
import { isPublicMarketingIndexable, parseDeployEnvironment } from "@oorjaman/config";

export const dynamic = "force-static";
import { blogPosts } from "@/lib/blog-posts";
import { publishedCityLandings } from "@/lib/cities";
import { legalDocuments } from "@/lib/legal-docs";
import { showCityCoverage, showVisitStories } from "@/lib/launch-flags";
import { siteUrl } from "@/lib/site";
import { visitStories } from "@/lib/visit-stories";

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
  ...(showVisitStories ? ["/stories"] : []),
  "/faq",
  "/about",
  "/contact",
  "/download",
  "/legal",
  ...(showCityCoverage ? ["/cities"] : []),
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

  for (const city of publishedCityLandings()) {
    entries.push({
      url: siteUrl(`/cities/${city.slug}`),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.75,
    });
  }

  if (showVisitStories) {
    for (const story of visitStories) {
      entries.push({
        url: siteUrl(`/stories/${story.slug}`),
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
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
