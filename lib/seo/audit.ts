/**
 * The audit orchestrator.
 *
 * This is the spine of the product. It runs, in order:
 *
 *   1. fetch the page safely            (lib/crawler/fetch-url.ts)
 *   2. parse the HTML into facts        (lib/seo/parser.ts)
 *   3. fetch robots.txt and the sitemap (lib/crawler/*)
 *   4. run every registered check       (lib/seo/registry.ts)
 *   5. calculate the score              (lib/seo/scoring.ts)
 *   6. assemble one report object       (this file)
 *
 * That report object is the ONLY thing downstream consumers see. The web UI,
 * the API, the printable report and any future integration all read the same
 * structure, so none of them can drift from each other.
 */

import { randomBytes } from "node:crypto";

import { fetchPage } from "@/lib/crawler/fetch-url";
import { evaluateRobotsForUrl, fetchRobotsDocument, type RobotsDocument } from "@/lib/crawler/robots";
import { analyzeSitemap } from "@/lib/crawler/sitemap";
import { parseHtml } from "./parser";
import { checkRegistry } from "./registry";
import { calculateScore, prioritiseIssues } from "./scoring";
import { TtlCache } from "@/lib/utils/cache";
import { env } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import type {
  AuditReport,
  CheckContext,
  CheckResult,
  PageFetchFailure,
} from "./types";

/**
 * robots.txt rarely changes and is shared by every page on a site, so we keep
 * it for five minutes. The cache key is the origin, not the page URL.
 */
const robotsCache = new TtlCache<RobotsDocument>(5 * 60 * 1000, 200);

/**
 * Generate a short, unguessable audit id.
 *
 * Unguessable matters: audit results are reachable by URL, so an id that could
 * be incremented or predicted would let someone read other people's reports.
 * 15 random bytes is 120 bits of entropy — not something anyone is going to
 * stumble onto.
 */
export function generateAuditId(): string {
  return randomBytes(15).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type AuditOutcome =
  | { ok: true; report: AuditReport }
  | { ok: false; failure: PageFetchFailure };

export interface RunAuditOptions {
  /** Supply an id to keep a pre-created database row and the report in sync. */
  auditId?: string;
  /** Called as each stage completes, for progress reporting. */
  onStage?: (stage: AuditStage) => void;
}

export type AuditStage =
  | "fetching"
  | "parsing"
  | "robots"
  | "sitemap"
  | "checks"
  | "scoring"
  | "done";

/**
 * Run a complete audit of one URL.
 *
 * Returns a discriminated union instead of throwing: a page that could not be
 * fetched is an ordinary outcome to report, not an exceptional one.
 */
export async function runAudit(
  url: string,
  options: RunAuditOptions = {},
): Promise<AuditOutcome> {
  const auditId = options.auditId ?? generateAuditId();
  const startedAt = new Date();
  const startedMs = Date.now();
  const stage = options.onStage ?? (() => undefined);

  /**
   * One wall-clock budget for the whole audit.
   *
   * The page fetch, robots.txt and the sitemap each have their own timeout,
   * and without this they could stack up to three times the expected wait.
   * Serverless hosts kill a function at a fixed limit, so everything has to
   * fit inside one number. Supporting requests give up their remaining share
   * rather than letting the audit be killed with nothing to show.
   */
  const deadline = startedMs + env.AUDIT_TIMEOUT;
  const remaining = () => deadline - Date.now();

  /* -- 1. Fetch ------------------------------------------------------- */
  stage("fetching");
  const fetchResult = await fetchPage(url, {
    timeoutMs: Math.min(env.CRAWL_TIMEOUT, Math.max(remaining(), 1000)),
  });

  if (!fetchResult.ok) {
    logger.info("audit.fetch_failed", {
      auditId,
      code: fetchResult.code,
      durationMs: Date.now() - startedMs,
    });
    return { ok: false, failure: fetchResult };
  }

  /* -- 2. Parse ------------------------------------------------------- */
  stage("parsing");
  const page = parseHtml(fetchResult.body, fetchResult.finalUrl);

  /* -- 3. robots.txt and sitemap --------------------------------------- */
  stage("robots");
  const origin = new URL(fetchResult.finalUrl).origin;

  let robotsDocument = robotsCache.get(origin);
  if (!robotsDocument) {
    robotsDocument = await fetchRobotsDocument(origin, {
      timeoutMs: Math.min(8000, remaining()),
    });
    // Only cache a definite answer. Caching a failure would make a transient
    // network blip look like a persistent problem for the next five minutes.
    if (robotsDocument.retrieved) robotsCache.set(origin, robotsDocument);
  }

  // The file is shared by the whole site, but the crawlability verdict is
  // specific to this page's path, so it is always computed fresh.
  const robotsTxt = evaluateRobotsForUrl(robotsDocument, fetchResult.finalUrl);

  stage("sitemap");
  const sitemap = await analyzeSitemap(fetchResult.finalUrl, robotsTxt.sitemaps, { deadline });

  /* -- 4. Checks ------------------------------------------------------- */
  stage("checks");
  const context: CheckContext = {
    requestedUrl: fetchResult.requestedUrl,
    finalUrl: fetchResult.finalUrl,
    page,
    fetchResult,
    robotsTxt,
    sitemap,
  };

  const checks: CheckResult[] = [];
  for (const check of checkRegistry) {
    try {
      checks.push(check.run(context));
    } catch (error) {
      // One broken check must never take down an entire audit. We record it
      // honestly as "unable to determine" rather than hiding it.
      logger.error("audit.check_threw", {
        auditId,
        checkKey: check.key,
        error: error instanceof Error ? error.message : String(error),
      });
      checks.push({
        key: check.key,
        title: check.title,
        category: check.category,
        status: "UNAVAILABLE",
        severity: "INFO",
        value: "Unable to determine",
        message: "This check could not be completed for this page.",
        recommendation: null,
        why: "",
        confidence: "unavailable",
        unavailableReason: "An internal error occurred while running this check.",
        guide: check.guide,
      });
    }
  }

  /* -- 5. Score -------------------------------------------------------- */
  stage("scoring");
  const score = calculateScore(checks, checkRegistry);
  const priorityIssues = prioritiseIssues(checks, checkRegistry, 5);

  /* -- 6. Assemble ----------------------------------------------------- */
  const completedAt = new Date();
  const titleText = page.titles[0] ?? null;
  const descriptionText = page.metaDescriptions[0] ?? null;
  const canonicalRaw = page.canonicals[0] ?? null;

  let canonicalResolved: string | null = null;
  if (canonicalRaw) {
    try {
      canonicalResolved = new URL(canonicalRaw, fetchResult.finalUrl).href;
    } catch {
      canonicalResolved = canonicalRaw;
    }
  }

  const robotsDirectives = `${page.metaRobots ?? ""} ${fetchResult.headers["x-robots-tag"] ?? ""}`
    .toLowerCase();

  const report: AuditReport = {
    id: auditId,
    requestedUrl: fetchResult.requestedUrl,
    finalUrl: fetchResult.finalUrl,
    createdAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedMs,
    http: {
      initialStatus: fetchResult.initialStatus,
      finalStatus: fetchResult.finalStatus,
      redirectCount: fetchResult.redirects.length,
      redirects: fetchResult.redirects,
      contentType: fetchResult.contentType,
      responseBytes: fetchResult.byteLength,
    },
    score,
    checks,
    priorityIssues,
    summary: {
      errors: checks.filter((check) => check.status === "ERROR").length,
      warnings: checks.filter((check) => check.status === "WARNING").length,
      passed: checks.filter((check) => check.status === "PASS").length,
      info: checks.filter((check) => check.status === "INFO").length,
      unavailable: checks.filter((check) => check.status === "UNAVAILABLE").length,
    },
    metadata: {
      title: titleText,
      titleLength: titleText === null ? null : titleText.length,
      metaDescription: descriptionText,
      metaDescriptionLength: descriptionText === null ? null : descriptionText.length,
      canonical: canonicalResolved,
      h1Count: page.headings.filter((heading) => heading.level === 1).length,
      wordCount: page.text.wordCount,
      internalLinks: page.links.filter((link) => link.kind === "internal").length,
      externalLinks: page.links.filter((link) => link.kind === "external").length,
      imageCount: page.images.length,
      imagesMissingAlt: page.images.filter((image) => !image.hasAltAttribute).length,
      schemaTypes: [...new Set(page.jsonLd.flatMap((block) => block.types))],
      lang: page.htmlLang,
      isHttps: fetchResult.finalUrl.startsWith("https://"),
      isNoindex: robotsDirectives.includes("noindex") || robotsDirectives.includes("none"),
    },
  };

  stage("done");

  logger.info("audit.completed", {
    auditId,
    host: new URL(fetchResult.finalUrl).host,
    status: fetchResult.finalStatus,
    score: score.total,
    durationMs: report.durationMs,
    errors: report.summary.errors,
    warnings: report.summary.warnings,
  });

  return { ok: true, report };
}
