"use client";

import { useState } from "react";
import { AlertCircle, Gauge, Loader2, Monitor, Smartphone, Zap } from "lucide-react";

import { MetricMeter, PerformanceScoreRing } from "./metric-meter";
import { Button, Card } from "@/components/ui";
import type { PageSpeedStrategy, PageSpeedSuccess } from "@/lib/pagespeed/types";
import { cn } from "@/lib/utils/cn";

/**
 * The PageSpeed section of a report.
 *
 * Loaded on demand rather than with the audit, because Google takes ten to
 * thirty seconds to answer and most readers want the SEO findings first.
 *
 * The section is scrupulous about provenance. Everything here is measured by
 * Google, and the wording says so — it is presented beside this tool's score,
 * never blended into it. Two distinct datasets are shown separately and never
 * conflated:
 *
 *   FIELD — what real Chrome users actually experienced over 28 days. The
 *           meaningful one, and the one Google uses as a ranking signal. Absent
 *           for low-traffic pages, which is not a fault.
 *   LAB   — one simulated load on Google's hardware. Reproducible and good for
 *           diagnosis, but not a measurement of your visitors.
 */

type State =
  | { kind: "idle" }
  | { kind: "loading"; strategy: PageSpeedStrategy }
  | { kind: "ready"; data: PageSpeedSuccess }
  | { kind: "error"; message: string; code?: string };

export function PageSpeedPanel({ url }: { url: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [strategy, setStrategy] = useState<PageSpeedStrategy>("mobile");

  async function run(nextStrategy: PageSpeedStrategy) {
    setStrategy(nextStrategy);
    setState({ kind: "loading", strategy: nextStrategy });

    try {
      const response = await fetch("/api/pagespeed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, strategy: nextStrategy }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setState({
          kind: "error",
          message:
            payload?.error?.message ?? "We could not fetch the speed data. Please try again.",
          code: payload?.error?.code,
        });
        return;
      }

      setState({ kind: "ready", data: payload as PageSpeedSuccess });
    } catch {
      setState({
        kind: "error",
        message: "We could not reach the speed service. Please check your connection and try again.",
      });
    }
  }

  return (
    <section aria-labelledby="pagespeed-heading" className="py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-border pb-5">
        <div>
          <h2 id="pagespeed-heading" className="flex items-center gap-2 text-xl font-semibold">
            <Zap className="h-5 w-5 text-ink-400" aria-hidden="true" />
            Page speed
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">
            Measured by <strong className="font-medium text-ink-900">Google PageSpeed
            Insights</strong>, not by this tool. It is shown alongside the SEO score rather than
            inside it — they answer different questions, and mixing them would obscure both.
          </p>
        </div>

        {state.kind !== "idle" ? (
          <div
            className="flex shrink-0 overflow-hidden rounded-[var(--radius-btn)] border border-neutral-border no-print"
            role="group"
            aria-label="Device to test"
          >
            {(["mobile", "desktop"] as const).map((option) => {
              const Icon = option === "mobile" ? Smartphone : Monitor;
              const active = strategy === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => run(option)}
                  disabled={state.kind === "loading"}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium capitalize transition-colors disabled:opacity-50",
                    active
                      ? "bg-ink-950 text-white"
                      : "bg-surface text-ink-700 hover:bg-ink-50",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {option}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {state.kind === "idle" ? (
        <Card className="mt-5 flex flex-col items-start gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Gauge className="mt-0.5 h-5 w-5 shrink-0 text-ink-400" aria-hidden="true" />
            <div>
              <p className="text-[15px] font-medium text-ink-950">
                Check how fast this page loads
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">
                Runs a live Google PageSpeed test. It takes 10&ndash;30 seconds, which is why it is
                not part of the main audit.
              </p>
            </div>
          </div>

          <Button type="button" size="md" onClick={() => run("mobile")} className="shrink-0">
            Run speed test
          </Button>
        </Card>
      ) : null}

      {state.kind === "loading" ? (
        <Card className="mt-5 px-5 py-8">
          <div className="flex items-center justify-center gap-3 text-sm text-ink-600">
            <Loader2 className="h-5 w-5 animate-spin text-info" aria-hidden="true" />
            <span aria-live="polite">
              Google is loading this page on a simulated {state.strategy} device. This usually takes
              10&ndash;30 seconds.
            </span>
          </div>
        </Card>
      ) : null}

      {state.kind === "error" ? (
        <Card className="mt-5 px-5 py-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="text-[15px] font-medium text-ink-950">
                {state.code === "NOT_CONFIGURED"
                  ? "Speed testing is not enabled here"
                  : "We could not get the speed data"}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">{state.message}</p>
              {state.code !== "NOT_CONFIGURED" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => run(strategy)}
                >
                  Try again
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {state.kind === "ready" ? <PageSpeedResults data={state.data} /> : null}
    </section>
  );
}

function PageSpeedResults({ data }: { data: PageSpeedSuccess }) {
  const analysed = new Date(data.analysedAt);

  return (
    <div className="mt-5 space-y-6">
      {/* Headline: Google's own performance score. */}
      <Card className="flex flex-col items-center gap-6 px-5 py-6 sm:flex-row sm:items-center">
        <PerformanceScoreRing score={data.lab.score} />

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
            Google performance score
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-700">
            A simulated load on a {data.strategy === "mobile" ? "mid-range mobile device over a slow 4G connection" : "desktop connection"}.
            It is a diagnostic, reproducible figure — not a measurement of your real visitors.
          </p>
          <p className="mt-3 text-xs text-ink-500">
            Analysed by Google on{" "}
            <time dateTime={data.analysedAt}>{analysed.toLocaleString("en-GB")}</time>
            {data.lighthouseVersion ? ` · Lighthouse ${data.lighthouseVersion}` : ""}
          </p>
        </div>
      </Card>

      {/* FIELD DATA — the meaningful dataset, so it comes first. */}
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-[15px] font-semibold text-ink-950">
            What real visitors experienced
          </h3>
          <span className="text-xs text-ink-500">
            Chrome User Experience Report · last 28 days
          </span>
        </div>

        {data.field.available ? (
          <>
            {data.field.isOriginFallback ? (
              <p className="mt-2 rounded-md border border-info-border bg-info-soft px-3 py-2 text-[13px] leading-relaxed text-info-ink">
                This page alone does not have enough traffic for its own data, so these figures
                describe the whole site rather than this specific page.
              </p>
            ) : null}

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.field.metrics.map((metric) => (
                <MetricMeter key={metric.id} metric={metric} />
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 rounded-[var(--radius-card)] border border-dashed border-neutral-border bg-surface px-5 py-6 text-sm leading-relaxed text-ink-600">
            Google has no real-user data for this page. That happens when a page does not yet have
            enough Chrome traffic to report on anonymously — it is not a fault, and it says nothing
            about how fast the page is. The simulated results below still apply.
          </p>
        )}
      </div>

      {/* LAB DATA — clearly separated and labelled as simulated. */}
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-[15px] font-semibold text-ink-950">Simulated test results</h3>
          <span className="text-xs text-ink-500">One load, on Google&rsquo;s hardware</span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.lab.metrics.map((metric) => (
            <MetricMeter key={metric.id} metric={metric} />
          ))}
        </div>
      </div>

      {/* OPPORTUNITIES — magnitude comparison, so a bar, one hue, sorted. */}
      {data.opportunities.length > 0 ? (
        <div>
          <h3 className="text-[15px] font-semibold text-ink-950">
            What Google suggests fixing
          </h3>
          <p className="mt-1 text-sm text-ink-600">
            Estimated time each change could save on this simulated load, largest first.
          </p>

          <Card className="mt-3 divide-y divide-neutral-border">
            {data.opportunities.map((opportunity) => {
              const largest = data.opportunities[0]?.savingsMs ?? 1;
              const width = Math.max(
                4,
                Math.round(((opportunity.savingsMs ?? 0) / largest) * 100),
              );

              return (
                <div key={opportunity.id} className="px-4 py-3.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-sm font-medium text-ink-900">{opportunity.title}</p>
                    <p className="tabular shrink-0 text-sm font-medium text-ink-950">
                      {opportunity.displayValue || `${Math.round(opportunity.savingsMs ?? 0)} ms`}
                    </p>
                  </div>

                  {/* Single hue: this is magnitude, not identity. Thin mark,
                      rounded end, anchored to the baseline. */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-ink-800"
                      style={{ width: `${width}%` }}
                      aria-hidden="true"
                    />
                  </div>

                  {opportunity.description ? (
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
                      {opportunity.description}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </Card>
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-ink-500">
        Speed data is provided by the Google PageSpeed Insights API and reflects Google&rsquo;s own
        measurements. It does not affect the SEO score on this page, which is calculated only from
        the checks this tool performs itself.
      </p>
    </div>
  );
}
