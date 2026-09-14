import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config/site";

/**
 * robots.txt for this website.
 *
 * /audit/ is disallowed because reports are analyses of other people's pages,
 * held at unlisted URLs, and have no business in a search index. The reports
 * also carry a noindex directive — robots.txt alone would not remove one that
 * had already been discovered, which is exactly the point made in the
 * robots.txt guide.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/audit/"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
