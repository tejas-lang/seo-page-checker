import type { ScoreResult } from "@/lib/seo/types";
import { cn } from "@/lib/utils/cn";

/**
 * The score indicator.
 *
 * A half-circle arc with the number written large in the middle. Deliberately
 * restrained — this is a measurement, not a game score, so there is no glow,
 * no badge and no celebration.
 *
 * It is a server component: the arc is plain SVG, and the fill animation is a
 * CSS keyframe on the stroke offset. No JavaScript is shipped for it.
 */

const BAND_COLOR: Record<ScoreResult["band"]["id"], string> = {
  excellent: "var(--color-success)",
  good: "var(--color-success)",
  "needs-improvement": "var(--color-warning)",
  "significant-issues": "var(--color-danger)",
};

const RADIUS = 82;
const ARC_LENGTH = Math.PI * RADIUS;

export function ScoreGauge({
  score,
  band,
  className,
}: {
  score: number;
  band: ScoreResult["band"];
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const offset = ARC_LENGTH * (1 - clamped / 100);
  const color = BAND_COLOR[band.id];

  return (
    <div className={cn("relative w-full max-w-[240px]", className)}>
      <svg viewBox="0 0 200 116" className="w-full" role="img" aria-label={`SEO score ${clamped} out of 100. ${band.label}.`}>
        {/* Track */}
        <path
          d={`M ${100 - RADIUS} 100 A ${RADIUS} ${RADIUS} 0 0 1 ${100 + RADIUS} 100`}
          fill="none"
          stroke="var(--color-ink-100)"
          strokeWidth="13"
          strokeLinecap="round"
        />
        {/* Value */}
        <path
          d={`M ${100 - RADIUS} 100 A ${RADIUS} ${RADIUS} 0 0 1 ${100 + RADIUS} 100`}
          fill="none"
          stroke={color}
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={ARC_LENGTH}
          strokeDashoffset={offset}
          className="animate-score-in"
          style={
            {
              "--dash-total": ARC_LENGTH,
              "--dash-offset": offset,
            } as React.CSSProperties
          }
        />
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="tabular text-[52px] font-semibold leading-none tracking-tight text-ink-950">
          {clamped}
        </span>
        <span className="mt-1 text-sm text-ink-500">out of 100</span>
      </div>
    </div>
  );
}

/**
 * A compact horizontal bar used for the per-category scores.
 * The ratio is written as text next to it, so the bar is a visual aid rather
 * than the only way to read the number.
 */
export function ScoreBar({
  score,
  max,
  tone = "neutral",
  className,
}: {
  score: number;
  max: number;
  tone?: "neutral" | "good" | "warn" | "bad";
  className?: string;
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, score / max)) : 0;

  const colors = {
    neutral: "bg-ink-950",
    good: "bg-success",
    warn: "bg-warning",
    bad: "bg-danger",
  };

  return (
    <span
      className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-ink-100", className)}
      aria-hidden="true"
    >
      <span
        className={cn("block h-full rounded-full transition-[width]", colors[tone])}
        style={{ width: `${ratio * 100}%` }}
      />
    </span>
  );
}

/** Pick a bar colour from how much of a category was earned. */
export function toneForRatio(ratio: number | null): "neutral" | "good" | "warn" | "bad" {
  if (ratio === null) return "neutral";
  if (ratio >= 0.85) return "good";
  if (ratio >= 0.6) return "warn";
  return "bad";
}
