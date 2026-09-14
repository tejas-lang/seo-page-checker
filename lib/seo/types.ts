/**
 * The shared vocabulary of the audit engine.
 *
 * Every check, the scoring engine, the API and the UI all speak these types.
 * Keeping them in one place is what makes it possible to add a new SEO check
 * without touching the scorer, the API or the dashboard.
 */

/* ------------------------------------------------------------------ */
/* Status + severity models (fixed enums, never free-form strings)      */
/* ------------------------------------------------------------------ */

/** The outcome of a single check. */
export const CHECK_STATUSES = ["PASS", "WARNING", "ERROR", "INFO", "UNAVAILABLE"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

/** How much a non-passing result matters. */
export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** The six scoring categories. */
export const CHECK_CATEGORIES = [
  "technical",
  "on-page",
  "content",
  "links",
  "structured-data",
  "social",
] as const;
export type CheckCategory = (typeof CHECK_CATEGORIES)[number];

/**
 * How much to trust a finding.
 * - `measured`: read directly from the response or the HTML. A hard fact.
 * - `inferred`: derived with rules that can be wrong in edge cases.
 * - `unavailable`: we could not determine it. Never guess in this case.
 */
export type Confidence = "measured" | "inferred" | "unavailable";

export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  technical: "Technical SEO",
  "on-page": "On-Page SEO",
  content: "Content & Structure",
  links: "Links",
  "structured-data": "Structured Data",
  social: "Social Metadata",
};

export const CATEGORY_DESCRIPTIONS: Record<CheckCategory, string> = {
  technical:
    "How well the page can be reached, crawled and understood: status codes, HTTPS, canonical, robots directives, language and viewport.",
  "on-page":
    "The elements search engines read to understand the topic of the page: title, meta description, headings and image alt text.",
  content: "The amount and structure of the readable text on the page.",
  links: "The internal and external links found in the page.",
  "structured-data":
    "Machine-readable markup (JSON-LD, microdata) that describes the content of the page.",
  social:
    "Open Graph and Twitter/X metadata that controls how the page may look when shared.",
};

/* ------------------------------------------------------------------ */
/* A single check result                                                */
/* ------------------------------------------------------------------ */

export interface CheckResult {
  /** Stable machine key, e.g. "title". Used by the UI and the database. */
  key: string;
  /** Human label, e.g. "Title tag". */
  title: string;
  category: CheckCategory;
  status: CheckStatus;
  severity: Severity;
  /**
   * The measured FACT, short enough for a table cell.
   * e.g. "54 characters", "2 H1 headings", "Missing".
   */
  value: string | null;
  /** A plain-language statement of what we found. Facts only. */
  message: string;
  /**
   * What the user could do about it. `null` when there is nothing to fix.
   * This is advice, kept strictly separate from `message`.
   */
  recommendation: string | null;
  /** Why this element matters for SEO. Educational, never a ranking promise. */
  why: string;
  /** Optional copy-pasteable fix. */
  codeExample?: string;
  confidence: Confidence;
  /** Populated only when status is UNAVAILABLE: why we could not determine it. */
  unavailableReason?: string;
  /** Structured facts for richer UI rendering. */
  details?: Record<string, unknown>;
  /** Slug of the matching page under /seo-guides. */
  guide?: string;
}

/* ------------------------------------------------------------------ */
/* Check definitions + registry                                         */
/* ------------------------------------------------------------------ */

export interface SeoCheck {
  key: string;
  title: string;
  category: CheckCategory;
  /**
   * Points this check contributes INSIDE its category. Relative, not absolute:
   * the scorer normalises each category's points to the category's percentage
   * weight, so a check can be added without rebalancing every other number.
   */
  weight: number;
  guide?: string;
  run: (ctx: CheckContext) => CheckResult;
}

/** Everything a check may look at. Checks are pure functions of this. */
export interface CheckContext {
  requestedUrl: string;
  finalUrl: string;
  page: PageData;
  fetchResult: PageFetchSuccess;
  robotsTxt: RobotsTxtResult;
  sitemap: SitemapResult;
}

/* ------------------------------------------------------------------ */
/* Parsed page facts                                                    */
/* ------------------------------------------------------------------ */

export interface HeadingInfo {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  isEmpty: boolean;
}

export interface ImageInfo {
  src: string | null;
  /** null = no alt attribute at all. "" = explicitly empty (decorative). */
  alt: string | null;
  hasAltAttribute: boolean;
  width: string | null;
  height: string | null;
  loading: string | null;
  /** True when the image sits inside a link, so its alt acts as link text. */
  isLinked: boolean;
}

export type LinkKind =
  | "internal"
  | "external"
  | "fragment"
  | "mailto"
  | "tel"
  | "javascript"
  | "empty"
  | "other";

export interface LinkInfo {
  href: string;
  resolved: string | null;
  kind: LinkKind;
  anchorText: string;
  rel: string[];
  isNofollow: boolean;
  isSponsored: boolean;
  isUgc: boolean;
  target: string | null;
}

export interface JsonLdBlock {
  /** Parsed successfully? */
  valid: boolean;
  /** Parse error message when invalid. */
  error: string | null;
  /** Every @type value found in the block (deduped). */
  types: string[];
  /** Size of the raw script content, in characters. */
  size: number;
}

export interface TextStats {
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  /** Visible text length / total HTML length, as a 0-1 ratio. */
  textToHtmlRatio: number;
  /** First ~300 characters of visible text, for the UI preview. */
  excerpt: string;
}

export interface PageData {
  /** All title elements found (more than one is a mistake). */
  titles: string[];
  metaDescriptions: string[];
  metaRobots: string | null;
  metaGooglebot: string | null;
  canonicals: string[];
  htmlLang: string | null;
  charset: string | null;
  viewport: string | null;
  favicons: { rel: string; href: string }[];
  headings: HeadingInfo[];
  images: ImageInfo[];
  links: LinkInfo[];
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  jsonLd: JsonLdBlock[];
  /** itemtype values from microdata, and typeof values from RDFa. */
  microdataTypes: string[];
  rdfaTypes: string[];
  hreflang: { lang: string; href: string }[];
  text: TextStats;
  /** Size of the raw HTML document in bytes. */
  htmlBytes: number;
  /** True when the document starts with a doctype declaration. */
  hasDoctype: boolean;
  /** The content of a meta http-equiv="refresh" tag, if present. */
  metaRefresh: string | null;
}

/* ------------------------------------------------------------------ */
/* Crawler results                                                      */
/* ------------------------------------------------------------------ */

export interface RedirectHop {
  url: string;
  status: number;
  location: string | null;
}

export interface PageFetchSuccess {
  ok: true;
  requestedUrl: string;
  finalUrl: string;
  /** Status of the FIRST response (may be a redirect). */
  initialStatus: number;
  /** Status of the LAST response (the page we actually parsed). */
  finalStatus: number;
  redirects: RedirectHop[];
  headers: Record<string, string>;
  contentType: string | null;
  /** Decoded HTML. */
  body: string;
  /** Raw byte length of the body we read. */
  byteLength: number;
  /** Milliseconds from request start to body fully read. */
  durationMs: number;
}

/** Machine-readable failure reasons, mapped to friendly copy in the UI. */
export type FetchErrorCode =
  | "INVALID_URL"
  | "BLOCKED_URL"
  | "DNS_FAILURE"
  | "CONNECTION_FAILED"
  | "TIMEOUT"
  | "TOO_MANY_REDIRECTS"
  | "REDIRECT_LOOP"
  | "RESPONSE_TOO_LARGE"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "HTTP_ERROR"
  | "UNKNOWN";

export interface PageFetchFailure {
  ok: false;
  code: FetchErrorCode;
  /** Safe, user-facing message. Never contains stack traces or internal hosts. */
  message: string;
  requestedUrl: string;
  finalUrl?: string;
  status?: number;
  redirects?: RedirectHop[];
}

export type PageFetchResult = PageFetchSuccess | PageFetchFailure;

/* ------------------------------------------------------------------ */
/* robots.txt + sitemap                                                 */
/* ------------------------------------------------------------------ */

export interface RobotsRule {
  userAgents: string[];
  allow: string[];
  disallow: string[];
}

export interface RobotsTxtResult {
  /** Did we manage to retrieve and read it at all? */
  retrieved: boolean;
  url: string;
  status: number | null;
  /** Why retrieval failed, when retrieved is false. */
  error: string | null;
  groups: RobotsRule[];
  sitemaps: string[];
  /**
   * Our best reading of whether the audited path is crawlable.
   * `unknown` whenever the rules are too complex to judge confidently — we
   * would rather say "unknown" than assert something wrong.
   */
  pathVerdict: "allowed" | "disallowed" | "unknown";
  /** The rule line that produced the verdict, for transparency. */
  matchedRule: string | null;
  /** True when the file contains syntax we do not fully model. */
  hasComplexRules: boolean;
}

export interface SitemapResult {
  /** Every location we looked in. */
  checkedUrls: string[];
  /** The first sitemap we successfully retrieved, if any. */
  foundUrl: string | null;
  retrieved: boolean;
  status: number | null;
  error: string | null;
  kind: "urlset" | "sitemapindex" | null;
  /** Number of loc entries we counted (capped). */
  urlCount: number;
  /** True if we hit the parse cap and the real count is higher. */
  countTruncated: boolean;
  /**
   * Whether the audited URL appears in the sitemap.
   * `unknown` for sitemap indexes — we do not fetch child sitemaps in V1.
   */
  containsAuditedUrl: "yes" | "no" | "unknown";
  /** Where the sitemap reference came from. */
  discoveredVia: "robots.txt" | "convention" | null;
}

/* ------------------------------------------------------------------ */
/* Scoring                                                              */
/* ------------------------------------------------------------------ */

export interface CategoryScore {
  category: CheckCategory;
  label: string;
  /** Points awarded, already rounded. */
  score: number;
  /** Maximum points available for this category in THIS audit. */
  max: number;
  /** 0-1 ratio before rounding, or null when nothing could be measured. */
  ratio: number | null;
  checksTotal: number;
  checksPassed: number;
  checksUnavailable: number;
}

export interface ScoreBand {
  id: "excellent" | "good" | "needs-improvement" | "significant-issues";
  label: string;
  summary: string;
  min: number;
  max: number;
}

export interface ScoreResult {
  /** 0-100. The sum of the rounded category scores, so the breakdown adds up. */
  total: number;
  categories: CategoryScore[];
  band: ScoreBand;
  /** True when a category was excluded and its weight redistributed. */
  weightsRedistributed: boolean;
}

/* ------------------------------------------------------------------ */
/* The full report — one object powering UI, PDF, API and share pages   */
/* ------------------------------------------------------------------ */

export interface AuditReport {
  id: string;
  requestedUrl: string;
  finalUrl: string;
  createdAt: string;
  completedAt: string;
  durationMs: number;
  http: {
    initialStatus: number;
    finalStatus: number;
    redirectCount: number;
    redirects: RedirectHop[];
    contentType: string | null;
    responseBytes: number;
  };
  score: ScoreResult;
  checks: CheckResult[];
  /** The highest-impact issues, already ordered. Drives "Fix these first". */
  priorityIssues: CheckResult[];
  summary: {
    errors: number;
    warnings: number;
    passed: number;
    info: number;
    unavailable: number;
  };
  /** A small, privacy-conscious set of facts worth storing and displaying. */
  metadata: {
    title: string | null;
    titleLength: number | null;
    metaDescription: string | null;
    metaDescriptionLength: number | null;
    canonical: string | null;
    h1Count: number;
    wordCount: number;
    internalLinks: number;
    externalLinks: number;
    imageCount: number;
    imagesMissingAlt: number;
    schemaTypes: string[];
    lang: string | null;
    isHttps: boolean;
    isNoindex: boolean;
  };
}
