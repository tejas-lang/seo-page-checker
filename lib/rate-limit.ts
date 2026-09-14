/**
 * Server-side rate limiting.
 *
 * WHY IT EXISTS: every audit makes our server fetch a page, its robots.txt and
 * its sitemap. Without a limit, one script could use us to hammer someone
 * else's website, or simply exhaust our own resources. The limit is enforced
 * HERE, on the server — a limit implemented in the browser is a suggestion,
 * not a control.
 *
 * HOW IT WORKS: a fixed window per client. Each client gets N audits per
 * window; the counter resets when the window rolls over. Fixed windows are
 * slightly less smooth than a sliding window at the boundary, and that is an
 * acceptable trade for something this easy to reason about.
 *
 * LIMITATION, STATED PLAINLY: the counters live in this process's memory. Run
 * two instances behind a load balancer and each enforces the limit separately,
 * so the effective limit doubles. For a single instance — which is how this
 * ships — it is correct. To scale horizontally, swap the Map for Redis or
 * Upstash; the interface below is the only thing that would change.
 */

import { env } from "@/lib/config/env";

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Stop the map growing forever when many one-off clients appear. */
const MAX_TRACKED_CLIENTS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix ms when the window resets. */
  resetAt: number;
  /** Seconds until reset, for the Retry-After header. */
  retryAfterSeconds: number;
}

function prune(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/**
 * Record one request against a client's allowance.
 *
 * @param key an opaque client identifier — see `clientKeyFromRequest`
 */
export function consume(
  key: string,
  options: { limit?: number; windowMs?: number } = {},
): RateLimitResult {
  const limit = options.limit ?? env.RATE_LIMIT_MAX;
  const windowMs = options.windowMs ?? env.RATE_LIMIT_WINDOW;
  const now = Date.now();

  if (windows.size > MAX_TRACKED_CLIENTS) prune(now);

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    windows.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/** Look at a client's allowance without spending any of it. */
export function peek(key: string, options: { limit?: number } = {}): RateLimitResult {
  const limit = options.limit ?? env.RATE_LIMIT_MAX;
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetAt: now + env.RATE_LIMIT_WINDOW,
      retryAfterSeconds: 0,
    };
  }

  return {
    allowed: existing.count < limit,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/** Test helper. Never called in application code. */
export function resetRateLimits(): void {
  windows.clear();
}

/**
 * Work out which client a request came from.
 *
 * Behind a proxy (Vercel, Cloudflare, nginx) the socket address is the proxy's,
 * so we read the forwarding headers. These headers are trivially forgeable by
 * a direct caller, which is why rate limiting is one layer of defence and not
 * the only one — the crawler's own timeouts and size caps bound the damage a
 * determined abuser can do.
 *
 * The address is used as a bucket key and is never stored or logged.
 */
export function clientKeyFromRequest(request: Request): string {
  const headers = request.headers;

  const candidates = [
    headers.get("x-vercel-forwarded-for"),
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }

  return "unknown-client";
}
