/**
 * The factory every SEO check is built with.
 *
 * WHY A FACTORY: a check has two kinds of information. The constant kind (its
 * name, its category, its scoring weight, why the thing it looks at matters)
 * never changes between audits. The variable kind (what we found, what to do
 * about it) is computed per page. Splitting them means each check file is
 * mostly the interesting part, and every result comes out with the same shape
 * whether it passed, failed, or could not be determined.
 *
 * The `why` text is written once here and reused everywhere — including the
 * PDF and the API — so the explanation a user sees is always the same.
 */

import type {
  CheckCategory,
  CheckContext,
  CheckResult,
  CheckStatus,
  Confidence,
  SeoCheck,
  Severity,
} from "@/lib/seo/types";

export interface CheckDefinition {
  key: string;
  title: string;
  category: CheckCategory;
  /** Points inside the category. See lib/seo/scoring.ts. */
  weight: number;
  /** Constant, educational explanation of why this element matters. */
  why: string;
  /** Slug under /seo-guides. */
  guide?: string;
}

/** The per-page half of a result. Everything else is filled in from the definition. */
export interface CheckOutcome {
  status: CheckStatus;
  severity?: Severity;
  value: string | null;
  message: string;
  recommendation?: string | null;
  codeExample?: string;
  confidence?: Confidence;
  unavailableReason?: string;
  details?: Record<string, unknown>;
}

/** Sensible severity for a status when a check does not state one. */
function defaultSeverity(status: CheckStatus): Severity {
  switch (status) {
    case "ERROR":
      return "HIGH";
    case "WARNING":
      return "MEDIUM";
    default:
      return "INFO";
  }
}

function defaultConfidence(status: CheckStatus): Confidence {
  return status === "UNAVAILABLE" ? "unavailable" : "measured";
}

export function createCheck(
  definition: CheckDefinition,
  run: (context: CheckContext) => CheckOutcome,
): SeoCheck {
  return {
    key: definition.key,
    title: definition.title,
    category: definition.category,
    weight: definition.weight,
    guide: definition.guide,
    run(context: CheckContext): CheckResult {
      const outcome = run(context);

      return {
        key: definition.key,
        title: definition.title,
        category: definition.category,
        why: definition.why,
        guide: definition.guide,
        status: outcome.status,
        severity: outcome.severity ?? defaultSeverity(outcome.status),
        value: outcome.value,
        message: outcome.message,
        recommendation: outcome.recommendation ?? null,
        confidence: outcome.confidence ?? defaultConfidence(outcome.status),
        ...(outcome.codeExample ? { codeExample: outcome.codeExample } : {}),
        ...(outcome.unavailableReason ? { unavailableReason: outcome.unavailableReason } : {}),
        ...(outcome.details ? { details: outcome.details } : {}),
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Formatting helpers shared by the checks                             */
/* ------------------------------------------------------------------ */

/** "1 image" / "4 images" — avoids the "1 images" that makes a tool look cheap. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  const word = count === 1 ? singular : (pluralForm ?? `${singular}s`);
  return `${count} ${word}`;
}

/** Shorten a value for the "what we found" column without hiding what it is. */
export function truncate(value: string, maxLength = 120): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1)}…` : collapsed;
}
