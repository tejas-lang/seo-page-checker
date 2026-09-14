/**
 * POST /api/pagespeed — fetch Google PageSpeed Insights data for a URL.
 *
 * Deliberately separate from /api/audit. A PSI analysis takes ten to thirty
 * seconds; the SEO audit finishes in about one. Running them together would
 * make every audit feel broken and would exceed the serverless function's
 * wall-clock limit. So this is requested on demand, from a button on the
 * report, and the audit stays fast.
 *
 * The API key never leaves the server. Google supports referrer-restricted
 * keys for browser use, but proxying keeps the key secret outright, which is
 * the stronger position.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchPageSpeed, isPageSpeedConfigured } from "@/lib/pagespeed/client";
import { clientKeyFromRequest, consume } from "@/lib/rate-limit";
import { validateUrl } from "@/lib/security/url-guard";
import { describeError, logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PSI is slow, so this route needs a longer budget than an audit.
 * Hosts enforce their own ceiling on top of this — see DEPLOYMENT.md.
 */
export const maxDuration = 60;

const requestSchema = z.object({
  url: z.string().min(1).max(2048),
  strategy: z.enum(["mobile", "desktop"]).default("mobile"),
});

export async function POST(request: Request) {
  if (!isPageSpeedConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_CONFIGURED",
          message:
            "PageSpeed data is not enabled on this deployment. It needs a Google PageSpeed Insights API key.",
        },
      },
      { status: 503 },
    );
  }

  // PSI calls cost real quota, so they get their own stricter allowance
  // rather than sharing the audit budget.
  const rateLimit = consume(`psi:${clientKeyFromRequest(request)}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: `You have used all ${rateLimit.limit} speed tests available in this window. Please try again later.`,
        },
      },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "The request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Please provide a valid URL." } },
      { status: 400 },
    );
  }

  // The same URL guard the crawler uses. Google would refuse a private address
  // anyway, but there is no reason to forward one, and this keeps every
  // outbound URL in the application subject to one set of rules.
  const validation = validateUrl(parsed.data.url);
  if (!validation.ok) {
    return NextResponse.json(
      { error: { code: validation.code, message: validation.message } },
      { status: 400 },
    );
  }

  try {
    const result = await fetchPageSpeed(validation.href, { strategy: parsed.data.strategy });

    if (!result.ok) {
      const status =
        result.code === "QUOTA_EXCEEDED"
          ? 429
          : result.code === "TIMEOUT"
            ? 504
            : result.code === "NOT_CONFIGURED"
              ? 503
              : result.code === "INVALID_URL"
                ? 400
                : 502;

      return NextResponse.json({ error: { code: result.code, message: result.message } }, { status });
    }

    return NextResponse.json(result, {
      status: 200,
      // Google's own result changes slowly; caching briefly avoids burning
      // quota when somebody reloads a report.
      headers: { "Cache-Control": "private, max-age=600" },
    });
  } catch (error) {
    logger.error("api.pagespeed_crashed", describeError(error));
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong while fetching the speed data. Please try again.",
        },
      },
      { status: 500 },
    );
  }
}
