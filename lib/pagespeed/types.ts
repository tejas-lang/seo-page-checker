/**
 * PageSpeed Insights types.
 *
 * WHY THIS IS SEPARATE FROM THE AUDIT TYPES
 *
 * PageSpeed data is not ours. It is measured by Google, on Google's
 * infrastructure, and it deliberately does NOT feed into this tool's SEO score.
 * Three reasons, all of which matter:
 *
 *   1. The score is deterministic. The same page always produces the same
 *      number — there are tests enforcing it. Lighthouse lab results vary
 *      between runs on identical pages, so folding them in would quietly break
 *      that promise.
 *
 *   2. Different provenance. Our 26 checks are things we measured ourselves
 *      from the HTML. Mixing in a third party's numbers under one score would
 *      blur where each figure came from.
 *
 *   3. Different question. "Is this page described clearly for search engines?"
 *      and "how fast does it load?" are separate concerns, and a single blended
 *      number answers neither well.
 *
 * So it is presented alongside the audit, clearly attributed, never inside it.
 */

export type PageSpeedStrategy = "mobile" | "desktop";

/**
 * One Core Web Vitals metric, as Google reports it.
 *
 * `category` is Google's own verdict, not ours — we display their rating
 * rather than inventing thresholds.
 */
export interface PageSpeedMetric {
  id: string;
  label: string;
  /** Human-readable, e.g. "2.4 s" or "0.08". */
  displayValue: string;
  /** Raw value in milliseconds, or unitless for CLS. */
  numericValue: number | null;
  /** Google's rating: FAST / AVERAGE / SLOW, or GOOD / NEEDS_IMPROVEMENT / POOR. */
  category: "GOOD" | "NEEDS_IMPROVEMENT" | "POOR" | "UNKNOWN";
  /** One line on what this metric actually means, for people who have not met it before. */
  explanation: string;
}

/**
 * Field data: what real Chrome users actually experienced.
 *
 * This is the more meaningful of the two datasets, and the one Google uses as
 * a ranking signal. It only exists for pages with enough real traffic in the
 * Chrome UX Report, which is why `available` can be false for a perfectly
 * healthy site — a new or low-traffic page simply has no field data yet. That
 * is not a fault, and the UI says so rather than showing an empty chart.
 */
export interface PageSpeedFieldData {
  available: boolean;
  /** Google's overall verdict across the metrics. */
  overall: "FAST" | "AVERAGE" | "SLOW" | "NONE" | null;
  metrics: PageSpeedMetric[];
  /** True when the data describes the whole origin rather than this exact URL. */
  isOriginFallback: boolean;
}

/**
 * Lab data: a single simulated load from Google's servers.
 *
 * Useful for diagnosing, because it is reproducible and comes with specific
 * suggestions. Not a measurement of your real visitors — it is one run, on
 * Google's hardware, over a throttled connection.
 */
export interface PageSpeedLabData {
  /** Lighthouse performance score, 0-100. */
  score: number | null;
  metrics: PageSpeedMetric[];
}

/** A concrete, quantified improvement Lighthouse suggests. */
export interface PageSpeedOpportunity {
  id: string;
  title: string;
  description: string;
  /** e.g. "Potential savings of 320 ms". */
  displayValue: string;
  savingsMs: number | null;
}

export interface PageSpeedSuccess {
  ok: true;
  strategy: PageSpeedStrategy;
  /** The URL Google actually analysed, after any redirects it followed. */
  finalUrl: string;
  /** When Google ran the analysis (their timestamp, not ours). */
  analysedAt: string;
  lab: PageSpeedLabData;
  field: PageSpeedFieldData;
  opportunities: PageSpeedOpportunity[];
  /** Lighthouse version, so a reader knows which ruleset produced this. */
  lighthouseVersion: string | null;
}

export type PageSpeedErrorCode =
  | "NOT_CONFIGURED"
  | "QUOTA_EXCEEDED"
  | "INVALID_URL"
  | "UNREACHABLE"
  | "TIMEOUT"
  | "UPSTREAM_ERROR";

export interface PageSpeedFailure {
  ok: false;
  code: PageSpeedErrorCode;
  /** Safe to show a user, and specific enough to act on. */
  message: string;
}

export type PageSpeedResult = PageSpeedSuccess | PageSpeedFailure;
