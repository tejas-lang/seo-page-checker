/**
 * GET /api/audit/[id] — read a stored audit report.
 *
 * Returns the same report object the web UI renders, so anything built on this
 * API sees exactly what a person sees.
 *
 * On privacy: ids are 120 bits of randomness, so a report cannot be found by
 * guessing. Anyone holding the link can read it — that is what makes a report
 * shareable — and the /privacy page says so plainly.
 */

import { NextResponse } from "next/server";
import { auditStore } from "@/lib/db/audit-store";
import { describeError, logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ids are generated as lowercase base64url, stripped to [a-z0-9]. */
const ID_PATTERN = /^[a-z0-9]{10,40}$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!ID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "That audit could not be found." } },
      { status: 404 },
    );
  }

  try {
    const stored = await auditStore.get(id);

    if (!stored) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message:
              "That audit could not be found. Reports are deleted automatically after a short retention period.",
          },
        },
        { status: 404 },
      );
    }

    if (stored.state === "FAILED") {
      return NextResponse.json(
        {
          auditId: stored.id,
          status: "failed",
          url: stored.url,
          createdAt: stored.createdAt,
          error: stored.error,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        auditId: stored.id,
        status: "completed",
        createdAt: stored.createdAt,
        expiresAt: stored.expiresAt,
        report: stored.report,
      },
      {
        status: 200,
        // A finished report never changes, so it is safe to cache privately.
        headers: { "Cache-Control": "private, max-age=300" },
      },
    );
  } catch (error) {
    logger.error("api.audit_read_failed", { auditId: id, ...describeError(error) });
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong while loading this report. Please try again.",
        },
      },
      { status: 500 },
    );
  }
}
