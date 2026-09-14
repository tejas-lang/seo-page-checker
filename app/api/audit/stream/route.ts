/**
 * POST /api/audit/stream — run an audit, reporting each stage as it completes.
 *
 * This is what the web interface calls. It streams Server-Sent Events so the
 * loading screen shows what the server is ACTUALLY doing right now, rather
 * than a made-up percentage counting up on a timer. Each event corresponds to
 * a real stage the audit engine has reached.
 *
 * Event format (one JSON object per `data:` line):
 *   { "type": "stage",  "stage": "robots", "label": "Checking robots.txt…" }
 *   { "type": "result", "status": "completed", "auditId": "…", … }
 *   { "type": "result", "status": "failed",    "error": { … } }
 */

import { z } from "zod";

import { executeAudit, STAGE_LABELS, STAGE_ORDER } from "@/lib/seo/execute";
import { clientKeyFromRequest, consume } from "@/lib/rate-limit";
import { describeError, logger } from "@/lib/logger";
import type { AuditStage } from "@/lib/seo/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  url: z.string().min(1).max(2048),
});

function sseHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-store, no-transform",
    Connection: "keep-alive",
    // Tells nginx not to buffer, which would hold events back until the end.
    "X-Accel-Buffering": "no",
    ...extra,
  };
}

/** Emit a single JSON payload as one SSE message. */
function encodeEvent(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(request: Request) {
  const rateLimit = consume(clientKeyFromRequest(request));

  if (!rateLimit.allowed) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encodeEvent({
            type: "result",
            status: "failed",
            error: {
              code: "RATE_LIMITED",
              message: `You have used all ${rateLimit.limit} audits available in this window. Please try again in about ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minutes.`,
            },
          }),
        );
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: sseHeaders({ "Retry-After": String(rateLimit.retryAfterSeconds) }),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encodeEvent({
            type: "result",
            status: "failed",
            error: { code: "INVALID_REQUEST", message: "Please enter a valid URL." },
          }),
        );
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: sseHeaders() });
  }

  const url = parsed.data.url;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encodeEvent(payload));
        } catch {
          // The client navigated away mid-audit. Nothing to do.
          closed = true;
        }
      };

      // Tell the client the full list up front so it can render the whole
      // checklist and tick items off as they actually complete.
      send({
        type: "start",
        stages: STAGE_ORDER.filter((stage) => stage !== "done").map((stage) => ({
          stage,
          label: STAGE_LABELS[stage],
        })),
      });

      try {
        const result = await executeAudit(url, (stage: AuditStage) => {
          send({ type: "stage", stage, label: STAGE_LABELS[stage] });
        });

        if (result.ok) {
          send({
            type: "result",
            status: "completed",
            auditId: result.report.id,
            score: result.report.score.total,
            reportUrl: `/audit/${result.report.id}`,
          });
        } else {
          send({
            type: "result",
            status: "failed",
            ...(result.auditId ? { auditId: result.auditId } : {}),
            error: { code: result.code, message: result.message },
          });
        }
      } catch (error) {
        logger.error("api.stream_crashed", describeError(error));
        send({
          type: "result",
          status: "failed",
          error: {
            code: "INTERNAL_ERROR",
            message:
              "Something went wrong while analyzing this page. Please try again. If the problem continues, the website may be blocking automated requests.",
          },
        });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by the client disconnecting.
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: sseHeaders({
      "X-RateLimit-Limit": String(rateLimit.limit),
      "X-RateLimit-Remaining": String(rateLimit.remaining),
    }),
  });
}
