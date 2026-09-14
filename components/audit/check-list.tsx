"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";

import { STATUS_META, SEVERITY_META, CONFIDENCE_META, StatusIcon } from "./status";
import { CopyButton } from "./copy-button";
import { Badge, CodeBlock } from "@/components/ui";
import { CATEGORY_LABELS, type CheckResult, type CheckStatus } from "@/lib/seo/types";
import { cn } from "@/lib/utils/cn";

/**
 * The full list of check results, with filters and search.
 *
 * Everything here is client-side over data already on the page — no extra
 * requests when you filter or search. Each row is a native <details> element,
 * so expanding works with a keyboard, and the browser's own find-in-page can
 * still reach collapsed content in most browsers.
 */

type Filter = "all" | "errors" | "warnings" | "passed" | "info" | "unavailable";

const FILTERS: { id: Filter; label: string; matches: (status: CheckStatus) => boolean }[] = [
  { id: "all", label: "All", matches: () => true },
  { id: "errors", label: "Errors", matches: (status) => status === "ERROR" },
  { id: "warnings", label: "Warnings", matches: (status) => status === "WARNING" },
  { id: "passed", label: "Passed", matches: (status) => status === "PASS" },
  { id: "info", label: "Informational", matches: (status) => status === "INFO" },
  { id: "unavailable", label: "Unavailable", matches: (status) => status === "UNAVAILABLE" },
];

export function CheckList({ checks }: { checks: CheckResult[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const map: Record<Filter, number> = {
      all: checks.length,
      errors: 0,
      warnings: 0,
      passed: 0,
      info: 0,
      unavailable: 0,
    };
    for (const check of checks) {
      if (check.status === "ERROR") map.errors += 1;
      if (check.status === "WARNING") map.warnings += 1;
      if (check.status === "PASS") map.passed += 1;
      if (check.status === "INFO") map.info += 1;
      if (check.status === "UNAVAILABLE") map.unavailable += 1;
    }
    return map;
  }, [checks]);

  const visible = useMemo(() => {
    const active = FILTERS.find((entry) => entry.id === filter) ?? FILTERS[0]!;
    const needle = query.trim().toLowerCase();

    return checks.filter((check) => {
      if (!active.matches(check.status)) return false;
      if (needle === "") return true;

      return [
        check.title,
        check.key,
        check.value ?? "",
        check.message,
        check.recommendation ?? "",
        CATEGORY_LABELS[check.category],
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [checks, filter, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CheckResult[]>();
    for (const check of visible) {
      const list = map.get(check.category) ?? [];
      list.push(check);
      map.set(check.category, list);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <section aria-labelledby="all-checks-heading">
      <div className="flex flex-col gap-4 border-b border-neutral-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="all-checks-heading" className="text-xl font-semibold">
            All checks
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Every check that ran, grouped by category. Select one to see the detail.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <label htmlFor="check-search" className="sr-only">
            Search audit results
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            aria-hidden="true"
          />
          <input
            id="check-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search results…"
            className="h-10 w-full rounded-[var(--radius-input)] border border-neutral-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-ink-400 focus:border-ink-400"
          />
        </div>
      </div>

      {/* Filters */}
      <div
        className="mt-4 flex flex-wrap items-center gap-2 no-print"
        role="group"
        aria-label="Filter checks by status"
      >
        <SlidersHorizontal className="h-4 w-4 text-ink-400" aria-hidden="true" />
        {FILTERS.map((entry) => {
          const count = counts[entry.id];
          const isActive = filter === entry.id;

          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setFilter(entry.id)}
              aria-pressed={isActive}
              disabled={count === 0 && entry.id !== "all"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                isActive
                  ? "border-ink-950 bg-ink-950 text-white"
                  : "border-neutral-border bg-surface text-ink-700 hover:bg-ink-50",
              )}
            >
              {entry.label}
              <span className={cn("tabular", isActive ? "text-ink-300" : "text-ink-400")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Results */}
      {visible.length === 0 ? (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-neutral-border bg-surface px-5 py-10 text-center text-sm text-ink-600">
          No checks match {query.trim() ? `“${query.trim()}”` : "this filter"}.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
                {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
              </h3>

              <ul className="mt-3 divide-y divide-neutral-border overflow-hidden rounded-[var(--radius-card)] border border-neutral-border bg-surface">
                {items.map((check) => (
                  // The id is the target of the "View check" links in the
                  // priority list above, so scroll-margin keeps the row clear
                  // of the sticky header when jumped to.
                  <li key={check.key} id={`check-${check.key}`} className="scroll-mt-20">
                    <CheckRow check={check} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function CheckRow({ check, defaultOpen = false }: { check: CheckResult; defaultOpen?: boolean }) {
  const statusMeta = STATUS_META[check.status];
  const severityMeta = SEVERITY_META[check.severity];
  const confidenceMeta = CONFIDENCE_META[check.confidence];

  const showSeverity = check.status === "ERROR" || check.status === "WARNING";

  return (
    <details className="group print-block" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted">
        <StatusIcon status={check.status} />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-[15px] font-medium text-ink-950">{check.title}</span>
            {showSeverity ? (
              <Badge tone={severityMeta.tone}>{severityMeta.label}</Badge>
            ) : null}
          </span>
          {check.value ? (
            <span className="mt-0.5 block truncate font-mono text-[13px] text-ink-600">
              {check.value}
            </span>
          ) : null}
        </span>

        <ChevronDown
          className="h-4 w-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="space-y-4 border-t border-neutral-border bg-surface-muted px-4 py-4 text-sm sm:px-[52px]">
        {/* WHAT WE FOUND — a fact, stated separately from any advice. */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">
            What we found
          </p>
          <p className="mt-1.5 leading-relaxed text-ink-800">{check.message}</p>
        </div>

        {check.status === "UNAVAILABLE" && check.unavailableReason ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Reason</p>
            <p className="mt-1.5 leading-relaxed text-ink-700">{check.unavailableReason}</p>
          </div>
        ) : null}

        {/* WHY IT MATTERS — education, no ranking promises. */}
        {check.why ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">
              Why it matters
            </p>
            <p className="mt-1.5 leading-relaxed text-ink-700">{check.why}</p>
          </div>
        ) : null}

        {/* RECOMMENDATION — advice, clearly labelled as such. */}
        {check.recommendation ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">
              Recommendation
            </p>
            <p className="mt-1.5 leading-relaxed text-ink-800">{check.recommendation}</p>
          </div>
        ) : null}

        {check.codeExample ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">
                Example
              </p>
              <CopyButton value={check.codeExample} label="Copy code" className="no-print" />
            </div>
            <CodeBlock code={check.codeExample} className="mt-1.5" />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-border pt-3">
          <span className="flex items-center gap-2 text-xs text-ink-500">
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
            <span title={confidenceMeta?.explanation}>{confidenceMeta?.label}</span>
          </span>

          <span className="flex items-center gap-1 no-print">
            <CopyButton
              value={`${check.title}\n\nWhat we found: ${check.message}${
                check.recommendation ? `\n\nRecommendation: ${check.recommendation}` : ""
              }`}
              label="Copy details"
            />
            {check.guide ? (
              <Link
                href={`/seo-guides/${check.guide}`}
                className="rounded-md px-2 py-1 text-xs font-medium text-info-ink hover:bg-info-soft"
              >
                Learn more
              </Link>
            ) : null}
          </span>
        </div>
      </div>
    </details>
  );
}
