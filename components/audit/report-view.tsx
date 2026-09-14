import Link from "next/link";
import { ArrowUpRight, CircleCheck, Clock, ExternalLink, Globe, Printer } from "lucide-react";

import { ScoreGauge, ScoreBar, toneForRatio } from "./score-gauge";
import { CheckList } from "./check-list";
import { CopyButton } from "./copy-button";
import { SEVERITY_META, StatusIcon } from "./status";
import { Badge, Card, Container, ButtonLink, Mono } from "@/components/ui";
import { CATEGORY_DESCRIPTIONS, type AuditReport } from "@/lib/seo/types";
import { CATEGORY_WEIGHTS, SEVERITY_DEDUCTIONS, scoringExplanation } from "@/lib/seo/scoring";
import { siteConfig } from "@/lib/config/site";
import { displayUrl } from "@/lib/utils/url";
import { cn } from "@/lib/utils/cn";

/**
 * The audit report.
 *
 * Reading order is the priority order, on every screen size: what was
 * analysed, the score, the issues worth fixing first, the category breakdown,
 * then every check in full. On mobile the same sequence simply stacks.
 *
 * This is a server component. The only client-side pieces are the filter and
 * search controls and the copy buttons, so the report itself renders and
 * prints without JavaScript.
 */

export function ReportView({
  report,
  shareUrl,
}: {
  report: AuditReport;
  shareUrl: string;
}) {
  const completed = new Date(report.completedAt);

  return (
    <Container className="py-8 sm:py-12">
      {/* ------------------------------------------------------------- */}
      {/* What was analysed                                             */}
      {/* ------------------------------------------------------------- */}
      <header className="border-b border-neutral-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
              Audited page
            </p>
            <h1 className="mt-2 break-words font-mono text-lg font-medium text-ink-950 sm:text-xl">
              {report.finalUrl}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-600">
              <span className="flex items-center gap-1.5">
                <StatusMarker status={report.http.finalStatus} />
                HTTP {report.http.finalStatus}
              </span>

              {report.http.redirectCount > 0 ? (
                <span className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-ink-400" aria-hidden="true" />
                  {report.http.redirectCount} redirect
                  {report.http.redirectCount === 1 ? "" : "s"}
                </span>
              ) : null}

              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-ink-400" aria-hidden="true" />
                <time dateTime={report.completedAt}>
                  {completed.toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </span>

              <a
                href={report.finalUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex items-center gap-1.5 text-info-ink underline-offset-4 hover:underline no-print"
              >
                Open page
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>

            {report.requestedUrl !== report.finalUrl ? (
              <p className="mt-2 text-sm text-ink-500">
                You entered <Mono>{displayUrl(report.requestedUrl, 70)}</Mono>, which redirected
                here.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            <CopyButton value={shareUrl} label="Copy report link" variant="outline" />
            <CopyButton value={report.finalUrl} label="Copy URL" variant="outline" />
            <Link
              href={`/audit/${report.id}/print`}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-border bg-surface px-2 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Print / save as PDF
            </Link>
            <ButtonLink href="/seo-checker" size="sm" variant="secondary">
              New audit
            </ButtonLink>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* Score                                                         */}
      {/* ------------------------------------------------------------- */}
      <section aria-labelledby="score-heading" className="py-8 print-block">
        <h2 id="score-heading" className="sr-only">
          SEO score
        </h2>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,300px)_1fr] lg:items-center">
          <div className="flex flex-col items-center">
            <ScoreGauge score={report.score.total} band={report.score.band} />
            <p className="mt-4 text-center text-lg font-semibold text-ink-950">
              {report.score.band.label}
            </p>
          </div>

          <div>
            <p className="text-[17px] leading-relaxed text-ink-700">{report.score.band.summary}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <SummaryChip tone="danger" count={report.summary.errors} label="errors" />
              <SummaryChip tone="warning" count={report.summary.warnings} label="warnings" />
              <SummaryChip tone="success" count={report.summary.passed} label="passed" />
              <SummaryChip tone="info" count={report.summary.info} label="informational" />
              {report.summary.unavailable > 0 ? (
                <SummaryChip
                  tone="neutral"
                  count={report.summary.unavailable}
                  label="unable to determine"
                />
              ) : null}
            </div>

            <p className="mt-5 rounded-[var(--radius-card)] border border-neutral-border bg-surface px-4 py-3 text-sm leading-relaxed text-ink-600">
              {siteConfig.scoreDisclaimer}
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* Fix these first                                               */}
      {/* ------------------------------------------------------------- */}
      {report.priorityIssues.length > 0 ? (
        <section aria-labelledby="priority-heading" className="py-8">
          <h2 id="priority-heading" className="text-xl font-semibold">
            Fix these first
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Ordered by severity, then by how much each one affects the score.
          </p>

          <ul className="mt-5 space-y-3">
            {report.priorityIssues.map((issue, index) => (
              <li key={issue.key}>
                <Card className="print-block">
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    <span
                      className="tabular mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-100 text-xs font-semibold text-ink-700"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <StatusIcon status={issue.status} className="h-4 w-4" />
                        <span className="text-[15px] font-semibold text-ink-950">
                          {issue.title}
                        </span>
                        <Badge tone={SEVERITY_META[issue.severity].tone}>
                          {SEVERITY_META[issue.severity].label}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{issue.message}</p>
                      {issue.recommendation ? (
                        <p className="mt-2 text-sm leading-relaxed text-ink-800">
                          <span className="font-medium">How to fix: </span>
                          {issue.recommendation}
                        </p>
                      ) : null}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1 no-print">
                        <a
                          href={`#check-${issue.key}`}
                          className="rounded-md px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-950"
                        >
                          View check
                        </a>
                        {issue.guide ? (
                          <Link
                            href={`/seo-guides/${issue.guide}`}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-info-ink hover:bg-info-soft"
                          >
                            Learn more
                            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="py-8">
          <Card className="flex items-start gap-3 px-5 py-5">
            <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            <div>
              <h2 className="text-[15px] font-semibold">No errors or warnings found</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">
                Every check that could be measured passed or returned informational notes. That
                covers the checks in this tool, not everything that affects a page in search.
              </p>
            </div>
          </Card>
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Category scores                                               */}
      {/* ------------------------------------------------------------- */}
      <section aria-labelledby="categories-heading" className="py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="categories-heading" className="text-xl font-semibold">
              Category scores
            </h2>
            <p className="mt-1 text-sm text-ink-600">
              These add up to the total score above, exactly.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {report.score.categories.map((category) => (
            <Card key={category.category} className="px-4 py-4 print-block">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[15px] font-semibold text-ink-950">{category.label}</h3>
                <p className="tabular shrink-0 text-sm font-semibold text-ink-950">
                  {category.max === 0 ? (
                    <span className="text-ink-400">n/a</span>
                  ) : (
                    <>
                      {category.score}
                      <span className="font-normal text-ink-500">/{category.max}</span>
                    </>
                  )}
                </p>
              </div>

              <ScoreBar
                score={category.score}
                max={category.max}
                tone={toneForRatio(category.ratio)}
                className="mt-3"
              />

              <p className="mt-3 text-xs leading-relaxed text-ink-500">
                {category.checksPassed} of {category.checksTotal} checks passed
                {category.checksUnavailable > 0
                  ? ` · ${category.checksUnavailable} could not be determined`
                  : ""}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink-500">
                {CATEGORY_DESCRIPTIONS[category.category]}
              </p>
            </Card>
          ))}
        </div>

        <ScoreExplainer report={report} />
      </section>

      {/* ------------------------------------------------------------- */}
      {/* All checks                                                    */}
      {/* ------------------------------------------------------------- */}
      <div className="py-8">
        <CheckList checks={report.checks} />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Page details                                                  */}
      {/* ------------------------------------------------------------- */}
      <section aria-labelledby="details-heading" className="py-8">
        <h2 id="details-heading" className="text-xl font-semibold">
          Page details
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          The raw measurements this report is built from.
        </p>

        <Card className="mt-5 overflow-hidden">
          <dl className="divide-y divide-neutral-border text-sm">
            <DetailRow label="Requested URL" value={report.requestedUrl} mono />
            <DetailRow label="Final URL" value={report.finalUrl} mono />
            <DetailRow label="HTTP status" value={String(report.http.finalStatus)} />
            <DetailRow
              label="Redirects"
              value={
                report.http.redirectCount === 0
                  ? "None"
                  : report.http.redirects
                      .map((hop) => `${hop.status} → ${hop.location ?? "?"}`)
                      .join("  ·  ")
              }
            />
            <DetailRow label="Content type" value={report.http.contentType ?? "Not declared"} />
            <DetailRow
              label="Response size"
              value={`${(report.http.responseBytes / 1024).toFixed(1)} KB`}
            />
            <DetailRow label="Title" value={report.metadata.title ?? "Not present"} />
            <DetailRow
              label="Meta description"
              value={report.metadata.metaDescription ?? "Not present"}
            />
            <DetailRow label="Canonical" value={report.metadata.canonical ?? "Not present"} mono />
            <DetailRow label="Language" value={report.metadata.lang ?? "Not declared"} />
            <DetailRow label="Word count" value={String(report.metadata.wordCount)} />
            <DetailRow
              label="Links"
              value={`${report.metadata.internalLinks} internal · ${report.metadata.externalLinks} external`}
            />
            <DetailRow
              label="Images"
              value={`${report.metadata.imageCount} total · ${report.metadata.imagesMissingAlt} missing alt`}
            />
            <DetailRow
              label="Schema types"
              value={
                report.metadata.schemaTypes.length > 0
                  ? report.metadata.schemaTypes.join(", ")
                  : "None detected"
              }
            />
            <DetailRow
              label="Analysis time"
              value={`${(report.durationMs / 1000).toFixed(2)} seconds`}
            />
          </dl>
        </Card>
      </section>

      <footer className="border-t border-neutral-border pt-6 text-sm leading-relaxed text-ink-500">
        <p>{siteConfig.disclaimer}</p>
        <p className="mt-2">
          This report reflects the HTML as the server returned it at{" "}
          <time dateTime={report.completedAt}>{completed.toLocaleString("en-GB")}</time>. JavaScript
          was not executed, so content rendered in the browser after load is not included.
        </p>
      </footer>
    </Container>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function StatusMarker({ status }: { status: number }) {
  const tone =
    status >= 200 && status < 300
      ? "bg-success"
      : status >= 300 && status < 400
        ? "bg-info"
        : "bg-danger";

  return <span className={cn("h-2 w-2 rounded-full", tone)} aria-hidden="true" />;
}

function SummaryChip({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: "danger" | "warning" | "success" | "info" | "neutral";
}) {
  const tones = {
    danger: "border-danger-border bg-danger-soft text-danger-ink",
    warning: "border-warning-border bg-warning-soft text-warning-ink",
    success: "border-success-border bg-success-soft text-success-ink",
    info: "border-info-border bg-info-soft text-info-ink",
    neutral: "border-neutral-border bg-neutral-soft text-ink-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium",
        tones[tone],
      )}
    >
      <span className="tabular">{count}</span>
      <span className="font-normal">{label}</span>
    </span>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-ink-500">{label}</dt>
      <dd className={cn("break-words text-ink-900", mono && "font-mono text-[13px]")}>{value}</dd>
    </div>
  );
}

/**
 * "How is this score calculated?"
 *
 * A native <details> so it needs no JavaScript, and it prints expanded.
 * The numbers come from the scoring module itself, so this explanation can
 * never describe a formula the code is not actually using.
 */
function ScoreExplainer({ report }: { report: AuditReport }) {
  const explanation = scoringExplanation();

  return (
    <details className="group mt-5 rounded-[var(--radius-card)] border border-neutral-border bg-surface print-block">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <span className="text-[15px] font-medium text-ink-950">
          How is this score calculated?
        </span>
        <span className="text-sm text-ink-500 group-open:hidden">Show</span>
        <span className="hidden text-sm text-ink-500 group-open:inline">Hide</span>
      </summary>

      <div className="space-y-5 border-t border-neutral-border px-5 py-5 text-sm">
        <ol className="space-y-2 text-ink-700">
          {explanation.rules.map((rule) => (
            <li key={rule} className="flex gap-2.5">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-400" aria-hidden="true" />
              <span className="leading-relaxed">{rule}</span>
            </li>
          ))}
        </ol>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left">
            <caption className="sr-only">
              Score breakdown by category for this audit
            </caption>
            <thead>
              <tr className="border-b border-neutral-border text-xs uppercase tracking-[0.1em] text-ink-500">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Category
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">
                  Base weight
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">
                  This audit
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-border">
              {report.score.categories.map((category) => (
                <tr key={category.category}>
                  <th scope="row" className="py-2.5 pr-4 font-medium text-ink-900">
                    {category.label}
                  </th>
                  <td className="tabular py-2.5 pr-4 text-right text-ink-600">
                    {CATEGORY_WEIGHTS[category.category]}
                  </td>
                  <td className="tabular py-2.5 pr-4 text-right text-ink-600">{category.max}</td>
                  <td className="tabular py-2.5 text-right font-medium text-ink-950">
                    {category.score}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink-200">
                <th scope="row" className="py-2.5 pr-4 font-semibold">
                  Total
                </th>
                <td className="tabular py-2.5 pr-4 text-right text-ink-600">100</td>
                <td className="tabular py-2.5 pr-4 text-right text-ink-600">100</td>
                <td className="tabular py-2.5 text-right font-semibold">{report.score.total}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {report.score.weightsRedistributed ? (
          <p className="rounded-md border border-info-border bg-info-soft px-3 py-2.5 leading-relaxed text-info-ink">
            One or more categories could not be measured for this page. Their weight was shared
            across the categories that could be, which is why the &ldquo;this audit&rdquo; column
            differs from the base weights.
          </p>
        ) : null}

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">
            Severity deductions
          </p>
          <p className="mt-1.5 leading-relaxed text-ink-700">
            A failing check loses this share of its own weight:{" "}
            {Object.entries(SEVERITY_DEDUCTIONS)
              .filter(([, value]) => value > 0)
              .map(([key, value]) => `${key.toLowerCase()} ${Math.round(value * 100)}%`)
              .join(", ")}
            . Informational results and checks we could not determine lose nothing.
          </p>
        </div>

        <p className="leading-relaxed text-ink-600">
          The full rules, including every check&rsquo;s weight, are documented in SCORING.md in the
          project repository.
        </p>
      </div>
    </details>
  );
}
