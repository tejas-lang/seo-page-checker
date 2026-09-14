/**
 * The PageSpeed Insights client.
 *
 * WHAT IT IS: a thin, defensive wrapper around Google's PageSpeed Insights
 * API v5, which returns both Lighthouse lab results and — when Google has
 * enough real traffic for the page — Chrome UX Report field data.
 *
 * WHY IT IS ITS OWN MODULE, NOT A CHECK: a PSI analysis takes ten to thirty
 * seconds, far longer than the whole SEO audit's budget. Running it inside the
 * audit would blow the serverless function's wall-clock limit and make every
 * audit slow for a figure most people do not need every time. It is requested
 * separately, on demand, from the report page.
 *
 * WHY THE PARSING IS SO CAREFUL: the PSI response is a large, deeply nested
 * object whose shape varies — field data may be absent, individual audits may
 * be missing or null, and error responses come back with a 200 in some cases.
 * Every read here is optional-chained and every number is validated, because
 * the alternative is a crash on somebody else's slow website.
 */

import { z } from "zod";
import { logger, describeError } from "@/lib/logger";
import type {
  PageSpeedFieldData,
  PageSpeedLabData,
  PageSpeedMetric,
  PageSpeedOpportunity,
  PageSpeedResult,
  PageSpeedStrategy,
} from "./types";

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

/** Is the integration usable at all? */
export function isPageSpeedConfigured(): boolean {
  return Boolean(process.env.PAGESPEED_API_KEY?.trim());
}

/* ------------------------------------------------------------------ */
/* Metric descriptions                                                 */
/* ------------------------------------------------------------------ */

/**
 * Plain explanations of each metric.
 *
 * Google's own descriptions assume you already know what a "layout shift" is.
 * These are written for the same reader the rest of this tool is written for.
 */
const METRIC_INFO: Record<string, { label: string; explanation: string }> = {
  "largest-contentful-paint": {
    label: "Largest Contentful Paint",
    explanation:
      "How long until the biggest thing on screen — usually the main image or headline — has finished loading. This is what most people mean by 'the page loaded'.",
  },
  "cumulative-layout-shift": {
    label: "Cumulative Layout Shift",
    explanation:
      "How much the page jumps around while it loads. High values are the reason you tap the wrong button because an advert appeared above it.",
  },
  "interaction-to-next-paint": {
    label: "Interaction to Next Paint",
    explanation:
      "How long the page takes to visibly respond after you tap or click something. It measures whether the page feels sluggish.",
  },
  "total-blocking-time": {
    label: "Total Blocking Time",
    explanation:
      "How long the page was busy running JavaScript and unable to respond to input. A lab stand-in for the responsiveness a real visitor feels.",
  },
  "first-contentful-paint": {
    label: "First Contentful Paint",
    explanation: "How long until anything at all appears, rather than a blank screen.",
  },
  "speed-index": {
    label: "Speed Index",
    explanation: "How quickly the page visibly fills in, rather than when it technically finishes.",
  },
  "experimental-time-to-first-byte": {
    label: "Time to First Byte",
    explanation: "How long the server took to start sending anything back. Mostly a hosting concern.",
  },
};

/** Field-data keys use a different naming convention from lab audits. */
const FIELD_METRIC_IDS: Record<string, string> = {
  LARGEST_CONTENTFUL_PAINT_MS: "largest-contentful-paint",
  CUMULATIVE_LAYOUT_SHIFT_SCORE: "cumulative-layout-shift",
  INTERACTION_TO_NEXT_PAINT: "interaction-to-next-paint",
  FIRST_CONTENTFUL_PAINT_MS: "first-contentful-paint",
  EXPERIMENTAL_TIME_TO_FIRST_BYTE: "experimental-time-to-first-byte",
};

/* ------------------------------------------------------------------ */
/* Response validation                                                 */
/* ------------------------------------------------------------------ */

/**
 * A deliberately loose schema.
 *
 * It confirms the response is the right *kind* of object without asserting the
 * presence of fields that are legitimately optional. Being strict here would
 * mean rejecting valid responses for pages that simply have no field data.
 */
const responseSchema = z.object({
  id: z.string().optional(),
  analysisUTCTimestamp: z.string().optional(),
  lighthouseResult: z
    .object({
      finalUrl: z.string().optional(),
      requestedUrl: z.string().optional(),
      lighthouseVersion: z.string().optional(),
      categories: z.record(z.string(), z.unknown()).optional(),
      audits: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  loadingExperience: z.unknown().optional(),
  originLoadingExperience: z.unknown().optional(),
  error: z
    .object({
      code: z.number().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

/* ------------------------------------------------------------------ */
/* Parsing helpers                                                     */
/* ------------------------------------------------------------------ */

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Map a Lighthouse audit's 0-1 score onto Google's three-band rating. */
function categoriseLabScore(score: unknown): PageSpeedMetric["category"] {
  const value = numberOrNull(score);
  if (value === null) return "UNKNOWN";
  if (value >= 0.9) return "GOOD";
  if (value >= 0.5) return "NEEDS_IMPROVEMENT";
  return "POOR";
}

function parseLabMetrics(audits: Record<string, unknown>): PageSpeedMetric[] {
  const wanted = [
    "largest-contentful-paint",
    "cumulative-layout-shift",
    "total-blocking-time",
    "first-contentful-paint",
    "speed-index",
  ];

  const metrics: PageSpeedMetric[] = [];

  for (const id of wanted) {
    const audit = audits[id] as Record<string, unknown> | undefined;
    if (!audit) continue;

    const info = METRIC_INFO[id];
    metrics.push({
      id,
      label: info?.label ?? id,
      displayValue: typeof audit.displayValue === "string" ? audit.displayValue : "—",
      numericValue: numberOrNull(audit.numericValue),
      category: categoriseLabScore(audit.score),
      explanation: info?.explanation ?? "",
    });
  }

  return metrics;
}

/** Google rates field metrics itself; we pass its verdict through unchanged. */
function parseFieldData(experience: unknown, isOriginFallback: boolean): PageSpeedFieldData {
  const record = experience as Record<string, unknown> | undefined;
  const rawMetrics = record?.metrics as Record<string, unknown> | undefined;

  if (!record || !rawMetrics || Object.keys(rawMetrics).length === 0) {
    return { available: false, overall: null, metrics: [], isOriginFallback };
  }

  const metrics: PageSpeedMetric[] = [];

  for (const [key, id] of Object.entries(FIELD_METRIC_IDS)) {
    const metric = rawMetrics[key] as Record<string, unknown> | undefined;
    if (!metric) continue;

    const percentile = numberOrNull(metric.percentile);
    const info = METRIC_INFO[id];

    // CLS is reported multiplied by 100 and is unitless; everything else is ms.
    const isCls = id === "cumulative-layout-shift";
    const displayValue =
      percentile === null
        ? "—"
        : isCls
          ? (percentile / 100).toFixed(2)
          : percentile >= 1000
            ? `${(percentile / 1000).toFixed(1)} s`
            : `${Math.round(percentile)} ms`;

    const rating = typeof metric.category === "string" ? metric.category : "UNKNOWN";

    metrics.push({
      id,
      label: info?.label ?? id,
      displayValue,
      numericValue: percentile,
      category:
        rating === "FAST"
          ? "GOOD"
          : rating === "AVERAGE"
            ? "NEEDS_IMPROVEMENT"
            : rating === "SLOW"
              ? "POOR"
              : "UNKNOWN",
      explanation: info?.explanation ?? "",
    });
  }

  const overall = typeof record.overall_category === "string" ? record.overall_category : null;

  return {
    available: metrics.length > 0,
    overall: (overall as PageSpeedFieldData["overall"]) ?? null,
    metrics,
    isOriginFallback,
  };
}

/** The suggestions with a quantified saving, biggest first. */
function parseOpportunities(audits: Record<string, unknown>): PageSpeedOpportunity[] {
  const opportunities: PageSpeedOpportunity[] = [];

  for (const [id, value] of Object.entries(audits)) {
    const audit = value as Record<string, unknown> | undefined;
    if (!audit) continue;

    const details = audit.details as Record<string, unknown> | undefined;
    if (details?.type !== "opportunity") continue;

    const savings = numberOrNull(details.overallSavingsMs);
    // Ignore anything Lighthouse itself considers negligible.
    if (savings === null || savings < 50) continue;

    opportunities.push({
      id,
      title: typeof audit.title === "string" ? audit.title : id,
      description:
        typeof audit.description === "string"
          ? // Strip the markdown links Google embeds in descriptions.
            audit.description.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim()
          : "",
      displayValue: typeof audit.displayValue === "string" ? audit.displayValue : "",
      savingsMs: savings,
    });
  }

  return opportunities.sort((a, b) => (b.savingsMs ?? 0) - (a.savingsMs ?? 0)).slice(0, 6);
}

/* ------------------------------------------------------------------ */
/* The request                                                         */
/* ------------------------------------------------------------------ */

export interface PageSpeedOptions {
  strategy?: PageSpeedStrategy;
  /** Our own budget. PSI itself can take far longer than an audit does. */
  timeoutMs?: number;
}

/**
 * Ask Google to analyse a URL.
 *
 * Returns a discriminated union rather than throwing: a quota error or a slow
 * response is an ordinary outcome to report, not an exception.
 */
export async function fetchPageSpeed(
  url: string,
  options: PageSpeedOptions = {},
): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY?.trim();

  if (!apiKey) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message:
        "PageSpeed data is not enabled on this deployment. It needs a Google PageSpeed Insights API key.",
    };
  }

  const strategy: PageSpeedStrategy = options.strategy ?? "mobile";
  const timeoutMs = options.timeoutMs ?? 55_000;

  const endpoint = new URL(PSI_ENDPOINT);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("category", "performance");
  endpoint.searchParams.set("key", apiKey);

  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const described = describeError(error);
    const timedOut = described.name === "TimeoutError" || described.name === "AbortError";

    logger.warn("pagespeed.request_failed", { strategy, timedOut, ...described });

    return timedOut
      ? {
          ok: false,
          code: "TIMEOUT",
          message:
            "Google's PageSpeed analysis took too long to come back. Very slow or very large pages sometimes exceed the time limit — trying again often works.",
        }
      : {
          ok: false,
          code: "UPSTREAM_ERROR",
          message: "We could not reach Google's PageSpeed service. Please try again shortly.",
        };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      code: "UPSTREAM_ERROR",
      message: "Google's PageSpeed service returned a response we could not read.",
    };
  }

  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) {
    logger.error("pagespeed.unexpected_shape", { status: response.status });
    return {
      ok: false,
      code: "UPSTREAM_ERROR",
      message: "Google's PageSpeed service returned an unexpected response.",
    };
  }

  const data = parsed.data;

  // PSI reports some failures with a 200 and an `error` object.
  if (data.error || !response.ok) {
    const status = data.error?.code ?? response.status;
    const upstreamMessage = data.error?.message ?? "";

    logger.warn("pagespeed.api_error", { status, message: upstreamMessage.slice(0, 200) });

    if (status === 429) {
      return {
        ok: false,
        code: "QUOTA_EXCEEDED",
        message:
          "The PageSpeed API quota has been used up for now. It resets daily — please try again later.",
      };
    }

    if (status === 400) {
      return {
        ok: false,
        code: "INVALID_URL",
        message:
          "Google could not analyse that URL. It must be a public page that loads without a login.",
      };
    }

    if (status === 500 || status === 404) {
      return {
        ok: false,
        code: "UNREACHABLE",
        message:
          "Google could not load that page. It may be blocking automated requests, or be too slow to finish loading.",
      };
    }

    return {
      ok: false,
      code: "UPSTREAM_ERROR",
      message: "Google's PageSpeed service could not complete this analysis.",
    };
  }

  const lighthouse = data.lighthouseResult;
  const audits = (lighthouse?.audits ?? {}) as Record<string, unknown>;
  const performance = lighthouse?.categories?.performance as Record<string, unknown> | undefined;

  const rawScore = numberOrNull(performance?.score);

  const lab: PageSpeedLabData = {
    score: rawScore === null ? null : Math.round(rawScore * 100),
    metrics: parseLabMetrics(audits),
  };

  // Prefer data for this exact URL; fall back to the whole origin, and say
  // which one is being shown rather than passing origin data off as page data.
  const pageExperience = data.loadingExperience;
  const pageMetrics = (pageExperience as Record<string, unknown> | undefined)?.metrics;
  const hasPageData = Boolean(pageMetrics && Object.keys(pageMetrics).length > 0);

  const field = hasPageData
    ? parseFieldData(pageExperience, false)
    : parseFieldData(data.originLoadingExperience, true);

  logger.info("pagespeed.completed", {
    strategy,
    score: lab.score,
    hasFieldData: field.available,
    durationMs: Date.now() - startedAt,
  });

  return {
    ok: true,
    strategy,
    finalUrl: lighthouse?.finalUrl ?? url,
    analysedAt: data.analysisUTCTimestamp ?? new Date().toISOString(),
    lab,
    field,
    opportunities: parseOpportunities(audits),
    lighthouseVersion: lighthouse?.lighthouseVersion ?? null,
  };
}
