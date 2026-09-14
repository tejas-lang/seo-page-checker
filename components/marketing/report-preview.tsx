import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * A stylised preview of what a finished report looks like.
 *
 * WHY THIS AND NOT A STOCK ILLUSTRATION: the most persuasive thing this
 * product has is the report itself. A generic hero graphic of a person at a
 * laptop says nothing; a miniature of the real output tells a visitor exactly
 * what they are about to get.
 *
 * ON HONESTY: these numbers are illustrative, and the component says so in
 * visible text. That matters — this project's whole argument is that it does
 * not show invented data, so a decorative mock-up must never be mistakable for
 * a real result. It is captioned, it is visually a diagram rather than a
 * screenshot, and it is marked aria-hidden so screen readers skip the
 * decoration and read the caption instead.
 */
export function ReportPreview({ className }: { className?: string }) {
  const categories = [
    { label: "Technical", score: 28, max: 30 },
    { label: "On-Page", score: 30, max: 35 },
    { label: "Content", score: 14, max: 15 },
    { label: "Links", score: 9, max: 10 },
  ];

  const findings = [
    { icon: XCircle, tone: "text-danger", label: "Missing canonical URL" },
    { icon: AlertTriangle, tone: "text-warning", label: "4 images missing alt text" },
    { icon: CheckCircle2, tone: "text-success", label: "HTTPS enabled" },
    { icon: CheckCircle2, tone: "text-success", label: "Title tag · 54 characters" },
  ];

  return (
    <figure className={cn("w-full", className)}>
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-[var(--radius-card)] border border-neutral-border bg-surface shadow-[var(--shadow-raised)]"
      >
        {/* Chrome */}
        <div className="flex items-center gap-2 border-b border-neutral-border bg-surface-muted px-3.5 py-2.5">
          <span className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink-200" />
            <span className="h-2 w-2 rounded-full bg-ink-200" />
            <span className="h-2 w-2 rounded-full bg-ink-200" />
          </span>
          <span className="ml-1 truncate rounded bg-surface px-2 py-1 font-mono text-[10px] text-ink-500 ring-1 ring-neutral-border">
            example.com/pricing
          </span>
        </div>

        <div className="p-4">
          {/* Score row */}
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
                <circle cx="32" cy="32" r="27" fill="none" stroke="var(--color-ink-100)" strokeWidth="6" />
                <circle
                  cx="32"
                  cy="32"
                  r="27"
                  fill="none"
                  stroke="var(--color-success)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 27}
                  strokeDashoffset={2 * Math.PI * 27 * (1 - 0.81)}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center figure text-lg font-semibold text-ink-950">
                81
              </span>
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-950">Good foundation</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Pill tone="danger">1 error</Pill>
                <Pill tone="warning">4 warnings</Pill>
                <Pill tone="success">21 passed</Pill>
              </div>
            </div>
          </div>

          {/* Category bars */}
          <div className="mt-4 space-y-2">
            {categories.map((category) => (
              <div key={category.label} className="flex items-center gap-2.5">
                <span className="w-16 shrink-0 text-[10px] text-ink-500">{category.label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <span
                    className="block h-full rounded-full bg-ink-900"
                    style={{ width: `${(category.score / category.max) * 100}%` }}
                  />
                </span>
                <span className="figure w-9 shrink-0 text-right text-[10px] font-medium text-ink-700">
                  {category.score}/{category.max}
                </span>
              </div>
            ))}
          </div>

          {/* Findings */}
          <div className="mt-4 space-y-1.5 border-t border-neutral-border pt-3">
            {findings.map((finding) => {
              const Icon = finding.icon;
              return (
                <div key={finding.label} className="flex items-center gap-2">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", finding.tone)} />
                  <span className="truncate text-[11px] text-ink-700">{finding.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <figcaption className="mt-3 text-center text-xs text-ink-500">
        An illustration of the report layout. The figures shown are examples, not a real audit.
      </figcaption>
    </figure>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "danger" | "warning" | "success";
  children: React.ReactNode;
}) {
  const tones = {
    danger: "bg-danger-soft text-danger-ink ring-danger-border",
    warning: "bg-warning-soft text-warning-ink ring-warning-border",
    success: "bg-success-soft text-success-ink ring-success-border",
  };

  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
