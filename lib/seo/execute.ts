/**
 * The shared "run one audit and store it" routine.
 *
 * Both API routes call this: the plain JSON endpoint (POST /api/audit) and the
 * streaming one that reports progress (POST /api/audit/stream). Keeping the
 * logic here means the two cannot drift — the same validation, the same audit,
 * the same storage, the same error mapping.
 */

import { runAudit, generateAuditId, type AuditStage } from "./audit";
import { auditStore } from "@/lib/db/audit-store";
import { validateUrl } from "@/lib/security/url-guard";
import { logger } from "@/lib/logger";
import type { AuditReport, FetchErrorCode } from "./types";

export type ExecuteResult =
  | { ok: true; report: AuditReport }
  | { ok: false; auditId: string | null; code: FetchErrorCode | "INVALID_URL" | "BLOCKED_URL"; message: string; httpStatus: number };

/** HTTP status for each way an audit can fail. */
export const STATUS_BY_CODE: Record<string, number> = {
  INVALID_URL: 400,
  BLOCKED_URL: 400,
  UNSUPPORTED_CONTENT_TYPE: 422,
  DNS_FAILURE: 502,
  CONNECTION_FAILED: 502,
  HTTP_ERROR: 502,
  REDIRECT_LOOP: 502,
  TOO_MANY_REDIRECTS: 502,
  RESPONSE_TOO_LARGE: 413,
  TIMEOUT: 504,
  UNKNOWN: 500,
};

export async function executeAudit(
  rawUrl: string,
  onStage?: (stage: AuditStage) => void,
): Promise<ExecuteResult> {
  /* -- Validate before spending a crawl on it -------------------------- */
  const validation = validateUrl(rawUrl);
  if (!validation.ok) {
    logger.info("audit.url_rejected", { code: validation.code, detail: validation.detail });
    return {
      ok: false,
      auditId: null,
      code: validation.code,
      message: validation.message,
      httpStatus: 400,
    };
  }

  const auditId = generateAuditId();
  const outcome = await runAudit(validation.href, { auditId, onStage });

  if (!outcome.ok) {
    // A page we could not fetch is still a result worth keeping, so the user
    // can revisit or share the explanation of what went wrong.
    await auditStore.saveFailed({
      id: auditId,
      url: validation.href,
      code: outcome.failure.code,
      message: outcome.failure.message,
    });

    return {
      ok: false,
      auditId,
      code: outcome.failure.code,
      message: outcome.failure.message,
      httpStatus: STATUS_BY_CODE[outcome.failure.code] ?? 502,
    };
  }

  await auditStore.saveCompleted(outcome.report);
  return { ok: true, report: outcome.report };
}

/** The user-facing label for each stage, used by the streaming endpoint. */
export const STAGE_LABELS: Record<AuditStage, string> = {
  fetching: "Requesting the page…",
  parsing: "Reading the page structure…",
  robots: "Checking robots.txt…",
  sitemap: "Looking for a sitemap…",
  checks: "Running SEO checks…",
  scoring: "Calculating the score…",
  done: "Finishing up…",
};

export const STAGE_ORDER: AuditStage[] = [
  "fetching",
  "parsing",
  "robots",
  "sitemap",
  "checks",
  "scoring",
  "done",
];
