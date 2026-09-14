/**
 * Google's published Core Web Vitals thresholds.
 *
 * WHY THESE ARE HERE: knowing a metric is "poor" is much less useful than
 * seeing how far past the line it sits. A meter needs the boundaries to draw,
 * and those boundaries are Google's, not ours — so they live in one place,
 * with a source, rather than being scattered as magic numbers in a component.
 *
 * Source: https://web.dev/articles/defining-core-web-vitals-thresholds
 * A metric is rated on the 75th percentile of real page loads.
 */

export interface MetricThreshold {
  /** At or below this is GOOD. */
  good: number;
  /** At or below this is NEEDS IMPROVEMENT; above it is POOR. */
  needsImprovement: number;
  /** Where to stop drawing the meter track. */
  scaleMax: number;
  unit: "ms" | "unitless";
  /** True for the three metrics Google treats as Core Web Vitals. */
  isCoreWebVital: boolean;
}

export const METRIC_THRESHOLDS: Record<string, MetricThreshold> = {
  "largest-contentful-paint": {
    good: 2500,
    needsImprovement: 4000,
    scaleMax: 6000,
    unit: "ms",
    isCoreWebVital: true,
  },
  "cumulative-layout-shift": {
    // Stored by the API multiplied by 100, so 0.1 arrives as 10.
    good: 10,
    needsImprovement: 25,
    scaleMax: 50,
    unit: "unitless",
    isCoreWebVital: true,
  },
  "interaction-to-next-paint": {
    good: 200,
    needsImprovement: 500,
    scaleMax: 1000,
    unit: "ms",
    isCoreWebVital: true,
  },
  "first-contentful-paint": {
    good: 1800,
    needsImprovement: 3000,
    scaleMax: 5000,
    unit: "ms",
    isCoreWebVital: false,
  },
  "total-blocking-time": {
    good: 200,
    needsImprovement: 600,
    scaleMax: 1500,
    unit: "ms",
    isCoreWebVital: false,
  },
  "speed-index": {
    good: 3400,
    needsImprovement: 5800,
    scaleMax: 9000,
    unit: "ms",
    isCoreWebVital: false,
  },
  "experimental-time-to-first-byte": {
    good: 800,
    needsImprovement: 1800,
    scaleMax: 3000,
    unit: "ms",
    isCoreWebVital: false,
  },
};

export function thresholdFor(metricId: string): MetricThreshold | null {
  return METRIC_THRESHOLDS[metricId] ?? null;
}

/**
 * Where a value sits along the meter track, as a 0-1 fraction.
 *
 * Values beyond the scale are clamped to the end rather than overflowing the
 * track — the status label already says it is poor, and a bar running off the
 * card communicates nothing extra.
 */
export function positionOnTrack(value: number, threshold: MetricThreshold): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(1, value / threshold.scaleMax);
}
