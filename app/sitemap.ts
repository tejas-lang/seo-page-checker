import type { MetadataRoute } from "next";

import { guides } from "@/content/guides";
import { siteConfig } from "@/lib/config/site";

/**
 * The sitemap for this website.
 *
 * Only the public, indexable pages are listed. Audit reports are deliberately
 * excluded: they are noindex, they expire, and they are analyses of other
 * people's pages rather than our content to publish. Practising what the
 * guides preach — a sitemap should list the canonical, indexable URLs and
 * nothing else.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = (
    [
      { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
      { url: `${base}/seo-checker`, changeFrequency: "monthly", priority: 0.9 },
      { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.8 },
      { url: `${base}/seo-guides`, changeFrequency: "monthly", priority: 0.8 },
      { url: `${base}/about`, changeFrequency: "yearly", priority: 0.5 },
      { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.4 },
      { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
      { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    ] satisfies MetadataRoute.Sitemap
  ).map((entry) => ({ ...entry, lastModified }));

  const guideRoutes: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: `${base}/seo-guides/${guide.slug}`,
    lastModified: new Date(guide.updated),
    changeFrequency: "yearly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...guideRoutes];
}
