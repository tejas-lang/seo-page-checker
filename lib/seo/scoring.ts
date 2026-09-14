/**
 * The scoring engine.
 *
 * WHAT IT IS: the one module that turns a list of check results into a number.
 * Nothing else in the application calculates a score — not a component, not the
 * API, not the PDF. If you want to change how scoring works, this is the only
 * file you edit.
 *
 * HOW THE SCORE IS BUILT, in plain language:
 *
 *   1. Every check belongs to a category, and every category is worth a fixed
 *      share of 100 points (see CATEGORY_WEIGHTS).
 *   2. Inside a category, each check has a weight — how much of that category's
 *      points it accounts for. These are relative numbers, not percentages, so
 *      adding a check does not require rebalancing the others.
 *   3. A check earns a fraction of its weight based on how it did. A pass earns
 *      everything; a failure loses an amount set by its severity.
 *   4. A check that could not be determined is REMOVED from the calculation
 *      entirely. It neither earns nor costs points. This is the honesty rule:
 *      we never penalise a page for something we failed to measure.
 *   5. Category scores are rounded, then added. The total is the sum of the
 *      rounded parts, so the breakdown shown to the user always adds up
 *      exactly to the total.
 *
 * The score is deterministic: the same page always produces the same number.
 * There is no randomness and no AI anywhere in this file.
 */

import {
  CATEGORY_LABELS,
  CHECK_CATEGORIES,
  type CategoryScore,
  type CheckCategory,
  type CheckResult,
  type ScoreBand,
  type ScoreResult,
  type SeoCheck,
  type Severity,
} from "./types";

/* ------------------------------------------------------------------ */
/* The configuration — every tunable number lives here                 */
/* ------------------------------------------------------------------ */

/** How the 100 points are divided between categories. Must total 100. */
export const CATEGORY_WEIGHTS: Record<CheckCategory, number> = {
  technical: 30,
  "on-page": 35,
  content: 15,
  links: 10,
  "structured-data": 5,
  social: 5,
};

/**
 * How much of a check's weight is lost when it does not pass.
 *
 * A CRITICAL failure costs the check's entire contribution. An INFO result
 * costs nothing at all — informational findings never reduce a score.
 */
export const SEVERITY_DEDUCTIONS: Record<Severity, number> = {
  CRITICAL: 1.0,
  HIGH: 0.7,
  MEDIUM: 0.4,
  LOW: 0.15,
  INFO: 0,
};

/** Score bands, with the wording used to describe each one. */
export const SCORE_BANDS: readonly ScoreBand[] = [
  {
    id: "excellent",
    label: "Excellent foundation",
    summary:
      "This page passes the large majority of the checks in this tool. The remaining items are refinements rather than problems.",
    min: 90,
    max: 100,
  },
  {
    id: "good",
    label: "Good foundation",
    summary:
      "The essentials are in place. A few improvements would strengthen how clearly this page describes itself.",
    min: 75,
    max: 89,
  },
  {
    id: "needs-improvement",
    label: "Needs improvement",
    summary:
      "Several checks did not pass. Working through the prioritised list below will address the most consequential ones first.",
    min: 50,
    max: 74,
  },
  {
    id: "significant-issues",
    label: "Significant issues found",
    summary:
      "This page has problems that are likely to affect how search engines read it. Start with the critical items at the top.",
    min: 0,
    max: 49,
  },
] as const;

// A configuration error here would silently distort every score, so we check
// it at module load rather than letting it be discovered by a confused user.
const weightTotal = Object.values(CATEGORY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
if (weightTotal !== 100) {
  throw new Error(`CATEGORY_WEIGHTS must total 100, but they total ${weightTotal}.`);
}

/* ------------------------------------------------------------------ */
/* The calculation                                                     */
/* ------------------------------------------------------------------ */

/**
 * What fraction of its weight does a check earn?
 * Returns `null` when the check should be excluded from scoring entirely.
 */
export function earnedFraction(result: CheckResult): number | null {
  switch (result.status) {
    case "UNAVAILABLE":
      // We could not measure it, so it takes no part in the score.
      return null;
    case "PASS":
    case "INFO":
      return 1;
    case "WARNING":
    case "ERROR":
      return 1 - (SEVERITY_DEDUCTIONS[result.severity] ?? 0);
    default:
      return null;
  }
}

export function bandFor(total: number): ScoreBand {
  const band = SCORE_BANDS.find((candidate) => total >= candidate.min && total <= candidate.max);
  // The bands cover 0-100 exhaustively; this fallback exists only to satisfy
  // the type system.
  return band ?? (SCORE_BANDS[SCORE_BANDS.length - 1] as ScoreBand);
}

/**
 * Calculate the score.
 *
 * @param results the outcome of every check that ran
 * @param checks  the registry entries, which carry the weights
 */
export function calculateScore(
  results: readonly CheckResult[],
  checks: readonly SeoCheck[],
): ScoreResult {
  const weightByKey = new Map(checks.map((check) => [check.key, check.weight]));

  interface Accumulator {
    earned: number;
    applicable: number;
    total: number;
    passed: number;
    unavailable: number;
  }

  const accumulators = new Map<CheckCategory, Accumulator>(
    CHECK_CATEGORIES.map((category) => [
      category,
      { earned: 0, applicable: 0, total: 0, passed: 0, unavailable: 0 },
    ]),
  );

  for (const result of results) {
    const accumulator = accumulators.get(result.category);
    if (!accumulator) continue;

    const weight = weightByKey.get(result.key) ?? 0;
    accumulator.total += 1;

    if (result.status === "PASS") accumulator.passed += 1;

    const fraction = earnedFraction(result);
    if (fraction === null) {
      accumulator.unavailable += 1;
      continue;
    }

    accumulator.applicable += weight;
    accumulator.earned += weight * fraction;
  }

  // Which categories could actually be measured this time?
  const measurable = CHECK_CATEGORIES.filter((category) => {
    const accumulator = accumulators.get(category);
    return accumulator !== undefined && accumulator.applicable > 0;
  });

  const measurableWeight = measurable.reduce(
    (sum, category) => sum + CATEGORY_WEIGHTS[category],
    0,
  );
  const weightsRedistributed = measurable.length !== CHECK_CATEGORIES.length;

  const categories: CategoryScore[] = CHECK_CATEGORIES.map((category) => {
    const accumulator = accumulators.get(category) ?? {
      earned: 0,
      applicable: 0,
      total: 0,
      passed: 0,
      unavailable: 0,
    };

    const isMeasurable = accumulator.applicable > 0;

    // When a whole category could not be measured, its points are shared out
    // across the categories that could be, so the total still runs to 100.
    const max =
      isMeasurable && measurableWeight > 0
        ? Math.round((CATEGORY_WEIGHTS[category] / measurableWeight) * 100)
        : 0;

    const ratio = isMeasurable ? accumulator.earned / accumulator.applicable : null;

    return {
      category,
      label: CATEGORY_LABELS[category],
      score: ratio === null ? 0 : Math.round(ratio * max),
      max,
      ratio,
      checksTotal: accumulator.total,
      checksPassed: accumulator.passed,
      checksUnavailable: accumulator.unavailable,
    };
  });

  // Rounding each category can leave the maxima summing to 99 or 101. Nudge the
  // largest category so the totals shown to the user are exactly 100.
  const maxTotal = categories.reduce((sum, category) => sum + category.max, 0);
  if (maxTotal !== 100 && maxTotal > 0) {
    const largest = categories.reduce((best, current) =>
      current.max > best.max ? current : best,
    );
    const correction = 100 - maxTotal;
    largest.max += correction;
    if (largest.ratio !== null) largest.score = Math.round(largest.ratio * largest.max);
  }

  const total = categories.reduce((sum, category) => sum + category.score, 0);
  const clamped = Math.max(0, Math.min(100, total));

  return {
    total: clamped,
    categories,
    band: bandFor(clamped),
    weightsRedistributed,
  };
}

/* ------------------------------------------------------------------ */
/* Prioritising the issues                                             */
/* ------------------------------------------------------------------ */

const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

/**
 * Order the failing checks by how much they matter, so "Fix these first" is a
 * genuine priority list rather than whatever happened to run first.
 *
 * The ranking is: severity, then how many points the fix would recover. That
 * second term is what separates two MEDIUM issues — the one attached to a
 * heavier check is the better use of the reader's time.
 */
export function prioritiseIssues(
  results: readonly CheckResult[],
  checks: readonly SeoCheck[],
  limit = 5,
): CheckResult[] {
  const weightByKey = new Map(checks.map((check) => [check.key, check.weight]));

  return results
    .filter((result) => result.status === "ERROR" || result.status === "WARNING")
    .map((result) => {
      const weight = weightByKey.get(result.key) ?? 0;
      const deduction = SEVERITY_DEDUCTIONS[result.severity] ?? 0;
      const categoryWeight = CATEGORY_WEIGHTS[result.category];
      return { result, impact: weight * deduction * categoryWeight };
    })
    .sort((a, b) => {
      const bySeverity =
        SEVERITY_ORDER[a.result.severity] - SEVERITY_ORDER[b.result.severity];
      if (bySeverity !== 0) return bySeverity;
      return b.impact - a.impact;
    })
    .slice(0, limit)
    .map((entry) => entry.result);
}

/**
 * A plain-language explanation of the scoring rules, served to the UI so the
 * "How is this score calculated?" panel can never drift from the code.
 */
export function scoringExplanation() {
  return {
    categoryWeights: CATEGORY_WEIGHTS,
    severityDeductions: SEVERITY_DEDUCTIONS,
    bands: SCORE_BANDS,
    rules: [
      "Each check belongs to one category, and each category is worth a fixed share of the 100 points.",
      "Within a category, checks carry different weights — a missing title costs far more than a missing favicon.",
      "A passing or informational check loses nothing. A failing check loses a share of its weight based on its severity.",
      "A check we could not determine is excluded from the calculation. It never counts against the page.",
      "Category scores are rounded and then added, so the breakdown always adds up to the total shown.",
    ],
  };
}
