import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";

import { Card, SectionLabel } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

export function SectionHeading({
  label,
  title,
  description,
  align = "left",
  className,
}: {
  label?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      <h2 className={cn("text-2xl font-semibold sm:text-3xl", label && "mt-3")}>{title}</h2>
      {description ? (
        <p className="mt-3 text-[17px] leading-relaxed text-ink-600">{description}</p>
      ) : null}
    </div>
  );
}

export function TrustStrip({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2 text-sm text-ink-600">
          <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function FeatureCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-ink-950 text-white"
        aria-hidden="true"
      >
        {icon}
      </div>
      <h3 className="mt-4 text-[15px] font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{children}</p>
    </Card>
  );
}

export function StepCard({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative border-t-2 border-ink-950 pt-5">
      <span className="font-mono text-sm font-medium tabular text-ink-400">{step}</span>
      <h3 className="mt-2 text-[17px] font-semibold">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{children}</p>
    </div>
  );
}

export function GuideCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-[var(--radius-card)] border border-neutral-border bg-surface p-4 shadow-[var(--shadow-card)] transition-colors hover:border-ink-300 hover:bg-surface-muted"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-[15px] font-semibold text-ink-950">{title}</span>
        <ArrowUpRight
          className="mt-0.5 h-4 w-4 shrink-0 text-ink-400 transition-colors group-hover:text-ink-900"
          aria-hidden="true"
        />
      </span>
      <span className="mt-1.5 text-sm leading-relaxed text-ink-600">{description}</span>
    </Link>
  );
}

/**
 * A statement of what the tool deliberately does NOT measure.
 *
 * This block exists because trust in an audit tool is built by what it refuses
 * to claim. Plenty of tools show a "Domain Authority" number they invented.
 * Saying clearly that we do not measure rankings or backlinks is more useful
 * to a beginner than a made-up figure.
 */
export function LimitationsList({ items }: { items: readonly { title: string; body: string }[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.title}>
          <dt className="text-[15px] font-semibold text-ink-950">{item.title}</dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-ink-600">{item.body}</dd>
        </div>
      ))}
    </dl>
  );
}
