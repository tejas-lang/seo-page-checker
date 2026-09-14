import { AlertTriangle, CheckCircle2, HelpCircle, Info, XCircle } from "lucide-react";

import type { CheckStatus, Severity } from "@/lib/seo/types";
import type { BadgeTone } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

/**
 * How each status and severity is presented.
 *
 * ACCESSIBILITY NOTE: status is never communicated by colour alone. Every
 * status has a distinct ICON SHAPE (tick, triangle, cross, circle) and a
 * written LABEL alongside it, so the interface works for someone who cannot
 * distinguish the colours, and in print.
 */

export const STATUS_META: Record<
  CheckStatus,
  { label: string; tone: BadgeTone; icon: typeof CheckCircle2; iconClass: string }
> = {
  PASS: {
    label: "Pass",
    tone: "success",
    icon: CheckCircle2,
    iconClass: "text-success",
  },
  WARNING: {
    label: "Warning",
    tone: "warning",
    icon: AlertTriangle,
    iconClass: "text-warning",
  },
  ERROR: {
    label: "Error",
    tone: "danger",
    icon: XCircle,
    iconClass: "text-danger",
  },
  INFO: {
    label: "Info",
    tone: "info",
    icon: Info,
    iconClass: "text-info",
  },
  UNAVAILABLE: {
    label: "Unavailable",
    tone: "neutral",
    icon: HelpCircle,
    iconClass: "text-ink-400",
  },
};

export const SEVERITY_META: Record<Severity, { label: string; tone: BadgeTone }> = {
  CRITICAL: { label: "Critical", tone: "danger" },
  HIGH: { label: "High priority", tone: "danger" },
  MEDIUM: { label: "Medium", tone: "warning" },
  LOW: { label: "Low", tone: "warning" },
  INFO: { label: "Informational", tone: "neutral" },
};

export const CONFIDENCE_META: Record<string, { label: string; explanation: string }> = {
  measured: {
    label: "Measured",
    explanation: "Read directly from the page or the server's response.",
  },
  inferred: {
    label: "Inferred",
    explanation: "Worked out from rules that can be wrong in unusual cases.",
  },
  unavailable: {
    label: "Unable to determine",
    explanation: "We could not measure this, so it does not affect the score.",
  },
};

export function StatusIcon({
  status,
  className,
}: {
  status: CheckStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <>
      <Icon className={cn("h-5 w-5 shrink-0", meta.iconClass, className)} aria-hidden="true" />
      {/* The label is read aloud even when the icon is the only visible cue. */}
      <span className="sr-only">{meta.label}:</span>
    </>
  );
}
