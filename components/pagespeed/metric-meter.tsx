import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from "lucide-react";

import { positionOnTrack, thresholdFor } from "@/lib/pagespeed/thresholds";
import type { PageSpeedMetric } from "@/lib/pagespeed/types";
import { cn } from "@/lib/utils/cn";

/**
 * A metric shown as a meter against Google's own thresholds.
 *
 * WHY A METER RATHER THAN A CHART: this is one value measured against a limit.
 * That is the textbook case for a meter — a bar chart of five unrelated
 * metrics on one axis would be meaningless, because seconds and a unitless
 * layout score do not share a scale.
 *
 * WHY THE ZONES ARE DRAWN: "poor" tells you the verdict. Seeing the marker sit
 * just past the line, or far past it, tells you how much work it is. The zone
 * boundaries are Google's published thresholds, not ours.
 *
 * ACCESSIBILITY: status is never colour alone. Every meter carries an icon
 * whose SHAPE differs per state (tick, triangle, cross), a written label, and
 * the numeric value. It reads correctly in greyscale and to a screen reader.
 */

const STATUS_STYLES = {
  GOOD: {
    label: "Good",
    icon: CheckCircle2,
    text: "text-success-ink",
    marker: "bg-success",
    ring: "ring-success-border",
  },
  NEEDS_IMPROVEMENT: {
    label: "Needs improvement",
    icon: AlertTriangle,
    text: "text-warning-ink",
    marker: "bg-warning",
    ring: "ring-warning-border",
  },
  POOR: {
    label: "Poor",
    icon: XCircle,
    text: "text-danger-ink",
    marker: "bg-danger",
    ring: "ring-danger-border",
  },
  UNKNOWN: {
    label: "No rating",
    icon: HelpCircle,
    text: "text-ink-500",
    marker: "bg-ink-400",
    ring: "ring-neutral-border",
  },
} as const;

export function MetricMeter({ metric }: { metric: PageSpeedMetric }) {
  const style = STATUS_STYLES[metric.category];
  const Icon = style.icon;
  const threshold = thresholdFor(metric.id);

  // Zone widths as percentages of the track.
  const goodWidth = threshold ? (threshold.good / threshold.scaleMax) * 100 : 0;
  const niWidth = threshold
    ? ((threshold.needsImprovement - threshold.good) / threshold.scaleMax) * 100
    : 0;
  const poorWidth = Math.max(0, 100 - goodWidth - niWidth);

  const position =
    threshold && metric.numericValue !== null
      ? positionOnTrack(metric.numericValue, threshold) * 100
      : null;

  return (
    <div className="rounded-[var(--radius-card)] border border-neutral-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-ink-950">
            {metric.label}
            {threshold?.isCoreWebVital ? (
              <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-ink-600">
                Core Web Vital
              </span>
            ) : null}
          </h4>
        </div>

        <span className={cn("flex shrink-0 items-center gap-1.5 text-xs font-medium", style.text)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
          {style.label}
        </span>
      </div>

      <p className="tabular mt-2 text-2xl font-semibold leading-none text-ink-950">
        {metric.displayValue}
      </p>

      {/* The meter. Zones are recessive; the marker is the only strong mark. */}
      {threshold && position !== null ? (
        <div className="mt-3.5">
          <div
            className="relative h-2 w-full overflow-hidden rounded-full"
            role="img"
            aria-label={`${metric.label}: ${metric.displayValue}, rated ${style.label} by Google.`}
          >
            {/* Threshold zones, in muted tints so the marker stays dominant. */}
            <div className="absolute inset-0 flex">
              <div className="h-full bg-success-soft" style={{ width: `${goodWidth}%` }} />
              {/* 2px surface gaps keep adjacent fills from reading as one block. */}
              <div className="h-full w-[2px] bg-surface" />
              <div className="h-full bg-warning-soft" style={{ width: `${niWidth}%` }} />
              <div className="h-full w-[2px] bg-surface" />
              <div className="h-full bg-danger-soft" style={{ width: `${poorWidth}%` }} />
            </div>

            {/* The value marker, ringed in the surface colour so it stays
                legible wherever on the track it lands. */}
            <div
              className={cn(
                "absolute top-1/2 h-3.5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface",
                style.marker,
              )}
              style={{ left: `${Math.max(1, Math.min(99, position))}%` }}
            />
          </div>

          <div className="tabular mt-1.5 flex justify-between text-[11px] text-ink-400">
            <span>0</span>
            <span>
              good ≤{" "}
              {threshold.unit === "unitless"
                ? (threshold.good / 100).toFixed(2)
                : threshold.good >= 1000
                  ? `${threshold.good / 1000}s`
                  : `${threshold.good}ms`}
            </span>
            <span>
              {threshold.unit === "unitless"
                ? (threshold.scaleMax / 100).toFixed(2)
                : `${threshold.scaleMax / 1000}s`}
              +
            </span>
          </div>
        </div>
      ) : null}

      {metric.explanation ? (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-600">{metric.explanation}</p>
      ) : null}
    </div>
  );
}

/**
 * The Lighthouse performance score.
 *
 * A single headline number, so it gets a hero treatment rather than a chart.
 * The ring mirrors the SEO score gauge elsewhere in the report, which makes
 * the two immediately comparable as "scores" — while the labelling keeps clear
 * that this one is Google's measurement, not ours.
 */
export function PerformanceScoreRing({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="flex h-[128px] w-[128px] items-center justify-center rounded-full border border-dashed border-neutral-border text-sm text-ink-500">
        No score
      </div>
    );
  }

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);

  // Google's own banding for the Lighthouse performance score.
  const colour =
    score >= 90 ? "var(--color-success)" : score >= 50 ? "var(--color-warning)" : "var(--color-danger)";
  const band = score >= 90 ? "Good" : score >= 50 ? "Needs improvement" : "Poor";

  return (
    <div className="relative h-[128px] w-[128px] shrink-0">
      <svg
        viewBox="0 0 128 128"
        className="h-full w-full -rotate-90"
        role="img"
        aria-label={`Google performance score ${score} out of 100. ${band}.`}
      >
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="var(--color-ink-100)"
          strokeWidth="10"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="animate-score-in"
          style={
            {
              "--dash-total": circumference,
              "--dash-offset": offset,
            } as React.CSSProperties
          }
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-3xl font-semibold leading-none text-ink-950">{score}</span>
        <span className="mt-0.5 text-[11px] text-ink-500">/ 100</span>
      </div>
    </div>
  );
}
