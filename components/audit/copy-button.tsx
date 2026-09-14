"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * Copy-to-clipboard with visible confirmation.
 *
 * The confirmation is announced to screen readers as well as shown, because
 * "did that work?" is exactly the question a copy button has to answer and a
 * silent icon swap does not answer it for everyone.
 */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  className,
  variant = "ghost",
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  variant?: "ghost" | "outline";
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
    } catch {
      // Clipboard access can be refused (insecure context, permissions).
      // Say so rather than pretending it worked.
      setFailed(true);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
        variant === "ghost"
          ? "text-ink-600 hover:bg-ink-100 hover:text-ink-950"
          : "border border-neutral-border bg-surface text-ink-700 hover:bg-ink-50",
        className,
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span aria-live="polite">
        {failed ? "Press Ctrl+C" : copied ? copiedLabel : label}
      </span>
    </button>
  );
}
