/**
 * Test fixtures.
 *
 * `buildContext` assembles the object a check receives, so a test can supply
 * only the HTML it cares about and get sensible defaults for everything else.
 */

import { parseHtml } from "@/lib/seo/parser";
import type {
  CheckContext,
  PageFetchSuccess,
  RobotsTxtResult,
  SitemapResult,
} from "@/lib/seo/types";

export const DEFAULT_URL = "https://example.com/page";

export function buildFetchResult(overrides: Partial<PageFetchSuccess> = {}): PageFetchSuccess {
  return {
    ok: true,
    requestedUrl: DEFAULT_URL,
    finalUrl: DEFAULT_URL,
    initialStatus: 200,
    finalStatus: 200,
    redirects: [],
    headers: { "content-type": "text/html; charset=utf-8" },
    contentType: "text/html; charset=utf-8",
    body: "",
    byteLength: 0,
    durationMs: 120,
    ...overrides,
  };
}

export function buildRobots(overrides: Partial<RobotsTxtResult> = {}): RobotsTxtResult {
  return {
    retrieved: true,
    url: "https://example.com/robots.txt",
    status: 200,
    error: null,
    groups: [],
    sitemaps: [],
    pathVerdict: "allowed",
    matchedRule: null,
    hasComplexRules: false,
    ...overrides,
  };
}

export function buildSitemap(overrides: Partial<SitemapResult> = {}): SitemapResult {
  return {
    checkedUrls: ["https://example.com/sitemap.xml"],
    foundUrl: "https://example.com/sitemap.xml",
    retrieved: true,
    status: 200,
    error: null,
    kind: "urlset",
    urlCount: 10,
    countTruncated: false,
    containsAuditedUrl: "yes",
    discoveredVia: "convention",
    ...overrides,
  };
}

export function buildContext(
  html: string,
  overrides: {
    url?: string;
    fetchResult?: Partial<PageFetchSuccess>;
    robotsTxt?: Partial<RobotsTxtResult>;
    sitemap?: Partial<SitemapResult>;
  } = {},
): CheckContext {
  const url = overrides.url ?? DEFAULT_URL;
  const fetchResult = buildFetchResult({
    requestedUrl: url,
    finalUrl: url,
    body: html,
    byteLength: Buffer.byteLength(html),
    ...overrides.fetchResult,
  });

  return {
    requestedUrl: fetchResult.requestedUrl,
    finalUrl: fetchResult.finalUrl,
    page: parseHtml(html, fetchResult.finalUrl),
    fetchResult,
    robotsTxt: buildRobots(overrides.robotsTxt),
    sitemap: buildSitemap(overrides.sitemap),
  };
}

/** A minimal, valid HTML document to build variations from. */
export function htmlDocument(options: {
  head?: string;
  body?: string;
  lang?: string;
} = {}): string {
  return `<!doctype html>
<html lang="${options.lang ?? "en"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>An example page about roll forming</title>
    <meta name="description" content="A description of the page that is long enough to be sensible and short enough to display in a search result without being cut." />
    <link rel="canonical" href="${DEFAULT_URL}" />
    <link rel="icon" href="/favicon.ico" />
    ${options.head ?? ""}
  </head>
  <body>
    <h1>An example page</h1>
    ${options.body ?? "<p>Some body text.</p>"}
  </body>
</html>`;
}
