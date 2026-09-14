/**
 * The UI primitives.
 *
 * A small, deliberately boring component set: button, input, card, badge,
 * alert, and a couple of layout helpers. They exist so that spacing, radii and
 * focus styles are decided once rather than re-improvised in every file.
 *
 * Every interactive element here renders a real HTML control (button, input,
 * a) so keyboard navigation, form submission and screen readers work without
 * any extra scripting.
 */

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function Container({
  className,
  children,
  size = "default",
}: {
  className?: string;
  children: React.ReactNode;
  size?: "default" | "narrow" | "wide";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-6 lg:px-8",
        size === "narrow" && "max-w-3xl",
        size === "default" && "max-w-6xl",
        size === "wide" && "max-w-7xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.14em] text-ink-500",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-btn)] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 whitespace-nowrap";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-ink-950 text-white hover:bg-ink-800 active:bg-ink-900",
  secondary:
    "bg-white text-ink-900 ring-1 ring-inset ring-neutral-border hover:bg-ink-50 active:bg-ink-100",
  ghost: "text-ink-700 hover:bg-ink-100 hover:text-ink-950",
  danger: "bg-danger text-white hover:bg-danger-ink",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[15px]",
  lg: "h-12 px-6 text-base",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  external = false,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href: string;
  external?: boolean;
}) {
  if (external) {
    return (
      <a
        href={href}
        className={buttonClasses(variant, size, className)}
        rel="noopener noreferrer"
        target="_blank"
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({
  className,
  children,
  as: Component = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
}) {
  return (
    <Component
      className={cn(
        "rounded-[var(--radius-card)] border border-neutral-border bg-surface shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("border-b border-neutral-border px-5 py-4", className)}>{children}</div>;
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 py-5", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-neutral-soft text-ink-700 ring-neutral-border",
  success: "bg-success-soft text-success-ink ring-success-border",
  warning: "bg-warning-soft text-warning-ink ring-warning-border",
  danger: "bg-danger-soft text-danger-ink ring-danger-border",
  info: "bg-info-soft text-info-ink ring-info-border",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Alert                                                               */
/* ------------------------------------------------------------------ */

export function Alert({
  tone = "info",
  title,
  children,
  icon,
  className,
}: {
  tone?: BadgeTone;
  title?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: "border-neutral-border bg-neutral-soft text-ink-800",
    success: "border-success-border bg-success-soft text-success-ink",
    warning: "border-warning-border bg-warning-soft text-warning-ink",
    danger: "border-danger-border bg-danger-soft text-danger-ink",
    info: "border-info-border bg-info-soft text-info-ink",
  };

  return (
    <div
      className={cn("rounded-[var(--radius-card)] border px-4 py-3 text-sm", tones[tone], className)}
    >
      <div className="flex gap-3">
        {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
        <div className="min-w-0">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className={cn(title && "mt-1")}>{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

/** Monospace treatment for URLs, codes and measured values. */
export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[0.925em] tracking-tight", className)}>{children}</span>
  );
}

/** A code block with a copy-friendly presentation. */
export function CodeBlock({ code, className }: { code: string; className?: string }) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-[10px] border border-ink-200 bg-ink-50 px-3.5 py-3 text-[13px] leading-relaxed text-ink-900",
        className,
      )}
    >
      <code className="font-mono">{code}</code>
    </pre>
  );
}
