import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PrintTrigger } from "./print-trigger";
import { STATUS_META, SEVERITY_META } from "./status";
import { LogoMark } from "@/components/site/logo";
import { CATEGORY_LABELS, type AuditReport, type CheckResult } from "@/lib/seo/types";
import { siteConfig } from "@/lib/config/site";
import { CHECK_CATEGORIES } from "@/lib/seo/types";

/**
 * The printable version of a report.
 *
 * Laid out as a document rather than an app: a header block, the score, the
 * priority list, the category table, then every check in full with nothing
 * collapsed. The on-screen chrome is marked `no-print` so the printed page
 * starts with the report itself.
 */
export function PrintReport({ report, shareUrl }: { report: AuditReport; shareUrl: string }) {
  const completed = new Date(report.completedAt);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      {/* On-screen controls, never printed. */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-neutral-border bg-surface px-4 py-3 no-print">
        <Link
          href={`/audit/${report.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-950"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the interactive report
        </Link>
        <PrintTrigger />
      </div>

      {/* -------------------------------------------------------------- */}
      {/* Document header                                                */}
      {/* -------------------------------------------------------------- */}
      <header className="border-b-2 border-ink-950 pb-5">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">{siteConfig.name}</span>
        </div>

        <h1 className="mt-5 text-2xl font-semibold">SEO audit report</h1>

        <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-500">URL</dt>
            <dd className="break-all font-mono text-[13px] text-ink-900">{report.finalUrl}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-500">Generated</dt>
            <dd className="text-ink-900">
              <time dateTime={report.completedAt}>{completed.toLocaleString("en-GB")}</time>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-500">HTTP status</dt>
            <dd className="text-ink-900">
              {report.http.finalStatus}
              {report.http.redirectCount > 0
                ? ` (after ${report.http.redirectCount} redirect${report.http.redirectCount === 1 ? "" : "s"})`
                : ""}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-500">Report link</dt>
            <dd className="break-all font-mono text-[13px] text-ink-900">{shareUrl}</dd>
          </div>
        </dl>
      </header>

      {/* -------------------------------------------------------------- */}
      {/* Score                                                          */}
      {/* -------------------------------------------------------------- */}
      <section className="print-block flex flex-wrap items-center gap-8 border-b border-neutral-border py-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
            SEO score
          </p>
          <p className="tabular mt-1 text-5xl font-semibold leading-none">
            {report.score.total}
            <span className="text-2xl font-normal text-ink-500">/100</span>
          </p>
          <p className="mt-2 font-semibold">{report.score.band.label}</p>
        </div>

        <div className="min-w-[240px] flex-1">
          <p className="text-sm leading-relaxed text-ink-700">{report.score.band.summary}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
            {siteConfig.scoreDisclaimer}
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* Category scores                                                */}
      {/* -------------------------------------------------------------- */}
      <section className="print-block border-b border-neutral-border py-6">
        <h2 className="text-lg font-semibold">Category scores</h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-border text-left text-xs uppercase tracking-[0.1em] text-ink-500">
              <th scope="col" className="py-2 font-semibold">
                Category
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Score
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Checks passed
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-border">
            {report.score.categories.map((category) => (
              <tr key={category.category}>
                <th scope="row" className="py-2 font-medium">
                  {category.label}
                </th>
                <td className="tabular py-2 text-right">
                  {category.score}/{category.max}
                </td>
                <td className="tabular py-2 text-right text-ink-600">
                  {category.checksPassed}/{category.checksTotal}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink-200 font-semibold">
              <th scope="row" className="py-2 text-left">
                Total
              </th>
              <td className="tabular py-2 text-right">{report.score.total}/100</td>
              <td className="tabular py-2 text-right">
                {report.summary.passed}/{report.checks.length}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* Priority issues                                                */}
      {/* -------------------------------------------------------------- */}
      {report.priorityIssues.length > 0 ? (
        <section className="border-b border-neutral-border py-6">
          <h2 className="text-lg font-semibold">Fix these first</h2>
          <ol className="mt-3 space-y-4">
            {report.priorityIssues.map((issue, index) => (
              <li key={issue.key} className="print-block">
                <p className="font-semibold">
                  {index + 1}. {issue.title} — {SEVERITY_META[issue.severity].label}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-700">{issue.message}</p>
                {issue.recommendation ? (
                  <p className="mt-1.5 text-sm leading-relaxed">
                    <span className="font-medium">How to fix: </span>
                    {issue.recommendation}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* -------------------------------------------------------------- */}
      {/* Every check                                                    */}
      {/* -------------------------------------------------------------- */}
      <section className="py-6">
        <h2 className="text-lg font-semibold">All checks</h2>

        {CHECK_CATEGORIES.map((category) => {
          const checks = report.checks.filter((check) => check.category === category);
          if (checks.length === 0) return null;

          return (
            <div key={category} className="mt-5">
              <h3 className="border-b border-neutral-border pb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
                {CATEGORY_LABELS[category]}
              </h3>
              <ul className="divide-y divide-neutral-border">
                {checks.map((check) => (
                  <PrintCheck key={check.key} check={check} />
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {/* -------------------------------------------------------------- */}
      {/* Footer                                                         */}
      {/* -------------------------------------------------------------- */}
      <footer className="border-t-2 border-ink-950 pt-4 text-[12px] leading-relaxed text-ink-500">
        <p>{siteConfig.disclaimer}</p>
        <p className="mt-1.5">
          Generated by {siteConfig.name} on {completed.toLocaleString("en-GB")}. JavaScript was not
          executed, so content rendered in the browser after load is not included in this report.
        </p>
      </footer>
    </div>
  );
}

function PrintCheck({ check }: { check: CheckResult }) {
  const statusMeta = STATUS_META[check.status];

  return (
    <li className="print-block py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-semibold">
          [{statusMeta.label.toUpperCase()}] {check.title}
        </span>
        {check.value ? (
          <span className="font-mono text-[12px] text-ink-600">{check.value}</span>
        ) : null}
        {check.status === "ERROR" || check.status === "WARNING" ? (
          <span className="text-[12px] text-ink-500">
            {SEVERITY_META[check.severity].label}
          </span>
        ) : null}
      </div>

      <p className="mt-1 text-sm leading-relaxed text-ink-700">{check.message}</p>

      {check.status === "UNAVAILABLE" && check.unavailableReason ? (
        <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
          Reason: {check.unavailableReason}
        </p>
      ) : null}

      {check.recommendation ? (
        <p className="mt-1 text-[13px] leading-relaxed text-ink-800">
          <span className="font-medium">Recommendation: </span>
          {check.recommendation}
        </p>
      ) : null}
    </li>
  );
}
