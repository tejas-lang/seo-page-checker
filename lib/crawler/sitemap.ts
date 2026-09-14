/**
 * XML sitemap discovery and inspection.
 *
 * WHAT IT IS: looks for a sitemap, confirms it is valid XML, counts its URLs
 * and checks whether the audited page is listed.
 *
 * AN IMPORTANT HONESTY NOTE: a sitemap can live at any path. Not finding one at
 * /sitemap.xml proves nothing. So when we find nothing we say "we could not
 * find one at the usual locations" — never "this site has no sitemap".
 */

import { fetchText } from "./fetch-url";
import { isSamePage } from "@/lib/utils/url";
import type { SitemapResult } from "@/lib/seo/types";

/** Paths tried when robots.txt does not name a sitemap. */
const CONVENTIONAL_PATHS = ["/sitemap.xml", "/sitemap_index.xml"] as const;

/** Stop after this many <loc> entries — a sitemap may hold 50,000 URLs. */
const MAX_PARSED_URLS = 5000;

export interface ParsedSitemap {
  kind: "urlset" | "sitemapindex" | null;
  locations: string[];
  truncated: boolean;
  /** Total <loc> elements seen, even beyond the parse cap. */
  totalLocations: number;
}

/**
 * Pull the <loc> values out of a sitemap.
 *
 * We use a regular expression rather than a full XML parser on purpose: this
 * is read-only extraction of one well-known element from a document we do not
 * trust, and a streaming regex cannot be talked into expanding an entity or
 * following an external DTD reference (the "billion laughs" and XXE attacks).
 */
export function parseSitemap(xml: string): ParsedSitemap {
  const trimmed = xml.slice(0, 5_000_000);

  let kind: "urlset" | "sitemapindex" | null = null;
  if (/<sitemapindex[\s>]/i.test(trimmed)) kind = "sitemapindex";
  else if (/<urlset[\s>]/i.test(trimmed)) kind = "urlset";

  const locations: string[] = [];
  let totalLocations = 0;

  const pattern = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(trimmed)) !== null) {
    totalLocations += 1;
    if (locations.length >= MAX_PARSED_URLS) continue;

    const value = (match[1] ?? "")
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();

    if (value) locations.push(value);
  }

  return {
    kind,
    locations,
    truncated: totalLocations > locations.length,
    totalLocations,
  };
}

function emptyResult(checkedUrls: string[], error: string | null): SitemapResult {
  return {
    checkedUrls,
    foundUrl: null,
    retrieved: false,
    status: null,
    error,
    kind: null,
    urlCount: 0,
    countTruncated: false,
    containsAuditedUrl: "unknown",
    discoveredVia: null,
  };
}

/**
 * Find and inspect a sitemap for the audited URL.
 *
 * Order of preference:
 *   1. Whatever robots.txt declares (authoritative — the site told us).
 *   2. The conventional paths, as a fallback.
 *
 * We only fetch the FIRST sitemap we can retrieve. This is a page checker, not
 * a site crawler: we will not walk a sitemap index and pull down 50 child
 * files on someone else's bandwidth.
 */
export async function analyzeSitemap(
  auditedUrl: string,
  sitemapsFromRobots: string[],
): Promise<SitemapResult> {
  let origin: string;
  try {
    origin = new URL(auditedUrl).origin;
  } catch {
    return emptyResult([], "The audited URL could not be parsed.");
  }

  const candidates: { url: string; via: "robots.txt" | "convention" }[] = [];

  for (const declared of sitemapsFromRobots.slice(0, 3)) {
    try {
      candidates.push({ url: new URL(declared, origin).href, via: "robots.txt" });
    } catch {
      // A malformed Sitemap: line is reported by the robots.txt check.
    }
  }

  for (const path of CONVENTIONAL_PATHS) {
    const url = new URL(path, origin).href;
    if (!candidates.some((candidate) => candidate.url === url)) {
      candidates.push({ url, via: "convention" });
    }
  }

  const checkedUrls: string[] = [];
  let lastError: string | null = null;
  let lastStatus: number | null = null;

  for (const candidate of candidates) {
    checkedUrls.push(candidate.url);

    const response = await fetchText(candidate.url, { maxBytes: 4 * 1024 * 1024, timeoutMs: 8000 });
    lastStatus = response.status;

    if (!response.ok || !response.text) {
      lastError = response.error ?? `HTTP ${response.status ?? "no response"}`;
      continue;
    }

    const text = response.text;

    // A site that serves its 404 page with a 200 status would otherwise look
    // like a sitemap full of zero URLs.
    if (!/<(?:urlset|sitemapindex)[\s>]/i.test(text)) {
      lastError = "The file we found is not a valid XML sitemap.";
      continue;
    }

    const parsed = parseSitemap(text);

    let containsAuditedUrl: SitemapResult["containsAuditedUrl"] = "unknown";
    if (parsed.kind === "urlset") {
      if (parsed.locations.some((location) => isSamePage(location, auditedUrl))) {
        containsAuditedUrl = "yes";
      } else if (!parsed.truncated) {
        containsAuditedUrl = "no";
      }
      // If the list was truncated and we did not find it, we genuinely do not
      // know — leave the verdict as "unknown".
    }

    return {
      checkedUrls,
      foundUrl: response.url,
      retrieved: true,
      status: response.status,
      error: null,
      kind: parsed.kind,
      urlCount: parsed.totalLocations,
      countTruncated: parsed.truncated,
      containsAuditedUrl,
      discoveredVia: candidate.via,
    };
  }

  return {
    ...emptyResult(checkedUrls, lastError),
    status: lastStatus,
  };
}
