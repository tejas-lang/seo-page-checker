import type { ScoreResult } from "@/lib/seo/types";
import { cn } from "@/lib/utils/cn";

/**
 * The score, shown as a composition rather than asserted as a number.
 *
 * WHY THIS FORM: the data's job is part-to-whole — how the 100 available points
 * are divided between categories, and how much of each was actually earned.
 * That is a stacked bar, not six separate gauges: the whole point is seeing the
 * segments sum to the total.
 *
 * It exists because this tool's central claim is that the score is transparent
 * arithmetic. A table proves it; a picture makes it obvious at a glance.
 *
 * ENCODING NOTES
 * - Segment WIDTH is the category's share of the 100 points.
 * - Segment FILL is how much of that share was earned.
 * - A 2px surface gap separates segments so adjacent fills never read as one.
 * - Fill uses a single hue (this is magnitude, not identity); the unearned
 *   remainder is a recessive track, not a second colour competing for meaning.
 * - Every segment is labelled with its numbers, so the bar is never the only
 *   way to read the value.
 */
export function ScoreComposition({ score }: { score: ScoreResult }) {
  const measurable = score.categories.filter((category) => category.max > 0);
  if (measurable.length === 0) return null;

  return (
    <figure className="print-block">
      <figcaption className="sr-only">
        How the {score.total} point score is composed from each category.
      </figcaption>

      {/* The bar */}
      <div className="flex h-12 w-full overflow-hidden rounded-[10px] border border-neutral-border bg-surface">
        {measurable.map((category, index) => {
          const ratio = category.ratio ?? 0;
          const earnedPercent = Math.round(ratio * 100);

          return (
            <div
              key={category.category}
              className={cn(
                "relative flex-shrink-0 bg-ink-100",
                index > 0 && "border-l-2 border-surface",
              )}
              style={{ width: `${category.max}%` }}
              title={`${category.label}: ${category.score} of ${category.max} points`}
            >
              {/* Earned portion, anchored to the baseline of its own segment. */}
              <div
                className="absolute inset-y-0 left-0 bg-ink-900"
                style={{ width: `${earnedPercent}%` }}
                aria-hidden="true"
              />

              {/* The number sits on top, in ink tokens rather than the mark's
                  colour, so identity is never carried by colour alone. */}
              <span className="absolute inset-0 flex items-center justify-center">
                <span
                  className={cn(
                    "figure text-[11px] font-semibold tabular-nums",
                    earnedPercent > 55 ? "text-white" : "text-ink-700",
                  )}
                >
                  {category.score}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Labels, carrying the numbers so the bar is an aid, not the only source */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {measurable.map((category) => (
          <div key={category.category} className="flex items-baseline gap-2 text-xs">
            <span
              className="mt-0.5 h-2 w-2 shrink-0 rounded-[2px] bg-ink-900"
              aria-hidden="true"
            />
            <span className="text-ink-700">{category.label}</span>
            <span className="figure font-medium text-ink-950">
              {category.score}
              <span className="font-normal text-ink-400">/{category.max}</span>
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-500">
        Segment width is each category&rsquo;s share of the 100 points; the filled part is how much
        of that share this page earned. They total {score.total}.
      </p>
    </figure>
  );
}

/**
 * The spread of findings by severity.
 *
 * Status data, so it follows the status rules: colour is never the only cue —
 * each row carries a written label and its own count, and the bar is an aid to
 * comparison rather than the thing being read.
 */
export function SeverityBreakdown({
  counts,
}: {
  counts: { label: string; count: number; tone: "danger" | "warning" | "success" | "info" | "neutral" }[];
}) {
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);
  if (total === 0) return null;

  const fills = {
    danger: "bg-danger",
    warning: "bg-warning",
    success: "bg-success",
    info: "bg-info",
    neutral: "bg-ink-300",
  } as const;

  return (
    <div className="space-y-2.5">
      {counts
        .filter((entry) => entry.count > 0)
        .map((entry) => (
          <div key={entry.label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-xs text-ink-600">{entry.label}</span>

            <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
              <span
                className={cn("block h-full rounded-full", fills[entry.tone])}
                style={{ width: `${Math.max(2, (entry.count / total) * 100)}%` }}
                aria-hidden="true"
              />
            </span>

            <span className="figure w-6 shrink-0 text-right text-xs font-medium text-ink-950">
              {entry.count}
            </span>
          </div>
        ))}
    </div>
  );
}
