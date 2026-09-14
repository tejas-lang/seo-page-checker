/**
 * POST /api/audit — run an audit and return the result as JSON.
 *
 * Request:  { "url": "https://example.com/page" }
 * Response: { "auditId": "...", "status": "completed", "score": 78, ... }
 *
 * The audit runs synchronously. For a single page that is the right choice:
 * the work is bounded by the crawler's own timeouts (about ten seconds in the
 * worst case), and a synchronous response means no polling, no job queue and
 * no partial states to reason about. If this ever grows into a whole-site
 * crawler, that is the moment to move to a background worker — see
 * ARCHITECTURE.md.
 *
 * The web interface uses /api/audit/stream instead, which does the same work
 * but reports each stage as it happens.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { executeAudit } from "@/lib/seo/execute";
import { clientKeyFromRequest, consume } from "@/lib/rate-limit";
import { describeError, logger } from "@/lib/logger";
import { env } from "@/lib/config/env";

/** Node runtime: the crawler needs DNS and raw sockets, which Edge cannot do. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  url: z
    .string({ message: "A url is required." })
    .min(1, "Please enter a webpage URL.")
    .max(2048, "That URL is too long to analyze."),
});

export async function POST(request: Request) {
  const startedAt = Date.now();

  /* -- Rate limit before doing any work -------------------------------- */
  const rateLimit = consume(clientKeyFromRequest(request));

  const rateLimitHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
  };

  if (!rateLimit.allowed) {
    logger.warn("api.rate_limited", { limit: rateLimit.limit });
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: `You have used all ${rateLimit.limit} audits available in this window. Please try again later.`,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
      },
      {
        status: 429,
        headers: { ...rateLimitHeaders, "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  /* -- Parse and validate the body -------------------------------------- */
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "The request body must be valid JSON." } },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: parsed.error.issues[0]?.message ?? "Please enter a valid URL.",
        },
      },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  /* -- Run ---------------------------------------------------------------- */
  try {
    const result = await executeAudit(parsed.data.url);

    if (!result.ok) {
      return NextResponse.json(
        {
          ...(result.auditId ? { auditId: result.auditId } : {}),
          status: "failed",
          error: { code: result.code, message: result.message },
        },
        { status: result.httpStatus, headers: rateLimitHeaders },
      );
    }

    const { report } = result;

    return NextResponse.json(
      {
        auditId: report.id,
        status: "completed",
        score: report.score.total,
        band: report.score.band.id,
        requestedUrl: report.requestedUrl,
        finalUrl: report.finalUrl,
        httpStatus: report.http.finalStatus,
        durationMs: report.durationMs,
        summary: report.summary,
        categories: report.score.categories.map((category) => ({
          category: category.category,
          score: category.score,
          max: category.max,
        })),
        reportUrl: `/audit/${report.id}`,
      },
      { status: 200, headers: rateLimitHeaders },
    );
  } catch (error) {
    // Anything reaching here is a bug in our code, not a problem with the URL.
    // Log the detail server-side; show the user something human.
    logger.error("api.audit_crashed", {
      durationMs: Date.now() - startedAt,
      ...describeError(error),
    });

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            "Something went wrong while analyzing this page. Please try again. If the problem continues, the website may be blocking automated requests.",
          ...(env.NODE_ENV === "development"
            ? { developerDetail: describeError(error).message }
            : {}),
        },
      },
      { status: 500, headers: rateLimitHeaders },
    );
  }
}

/** Anything other than POST is a client mistake worth naming clearly. */
export async function GET() {
  return NextResponse.json(
    {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: 'Use POST with a JSON body of { "url": "https://example.com" } to run an audit.',
      },
    },
    { status: 405, headers: { Allow: "POST" } },
  );
}
