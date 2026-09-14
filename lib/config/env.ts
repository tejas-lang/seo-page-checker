import { z } from "zod";

/**
 * Server-side environment configuration.
 *
 * WHAT IT IS: one validated, typed object holding every tunable setting.
 * WHY WE NEED IT: the crawler's safety limits (timeouts, size caps, redirect
 * caps) must never be `undefined` at runtime. Parsing them once, here, means a
 * misconfigured deployment fails loudly at boot instead of silently crawling
 * without limits.
 *
 * Every value has a safe default, so `npm run dev` works with an empty .env.
 */

/** Parse an integer env var, falling back to a default when unset/invalid. */
const intFromEnv = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((raw) => {
      if (raw === undefined || raw.trim() === "") return fallback;
      const parsed = Number.parseInt(raw, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    });

const boolFromEnv = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((raw) => {
      if (raw === undefined || raw.trim() === "") return fallback;
      return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
    });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** PostgreSQL connection string. Optional — see lib/db/audit-store.ts. */
  DATABASE_URL: z.string().optional(),

  /** Public origin of this app, used for canonical URLs and the bot page. */
  APP_URL: z.string().default("http://localhost:3000"),

  /** Identifies our crawler to the sites we fetch. Never impersonate Googlebot. */
  CRAWLER_USER_AGENT: z.string().optional(),

  /** Hard cap on the response body we will read, in bytes. */
  MAX_CRAWL_SIZE: intFromEnv(5 * 1024 * 1024),

  /** Per-request timeout in milliseconds. */
  CRAWL_TIMEOUT: intFromEnv(10_000),

  /** Maximum redirect hops we will follow before giving up. */
  MAX_REDIRECTS: intFromEnv(10),

  /** Audits allowed per IP inside the rate-limit window. */
  RATE_LIMIT_MAX: intFromEnv(5),

  /** Rate-limit window in milliseconds. Default: 1 hour. */
  RATE_LIMIT_WINDOW: intFromEnv(60 * 60 * 1000),

  /** How long anonymous audit records are retained, in days. */
  AUDIT_RETENTION_DAYS: intFromEnv(7),

  /**
   * Allows loopback/private targets. ONLY for local testing against your own
   * dev server. Must stay false in production — it disables SSRF protection.
   */
  ALLOW_PRIVATE_NETWORK_TARGETS: boolFromEnv(false),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // Fail loudly and early rather than crawling with undefined limits.
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === "production";

/**
 * The User-Agent we send. It names the bot and links to a page explaining it,
 * so site owners can identify and block us if they want to. We never pretend
 * to be Googlebot or a real browser.
 */
export const crawlerUserAgent =
  env.CRAWLER_USER_AGENT ||
  `SEOPageCheckerBot/1.0 (+${env.APP_URL.replace(/\/$/, "")}/about#bot)`;

/** The token a robots.txt `User-agent:` line would use to address us. */
export const crawlerUserAgentToken = "seopagecheckerbot";
