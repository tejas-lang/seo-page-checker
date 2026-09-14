"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Check, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

/**
 * The URL input and the loading experience.
 *
 * Two things here are worth explaining.
 *
 * 1. VALIDATION runs twice on purpose. A light check in the browser catches
 *    typos instantly; the real check runs on the server, because anything the
 *    browser decides can be bypassed. The browser check is a convenience, not
 *    a control.
 *
 * 2. PROGRESS IS REAL. The server streams an event each time it finishes a
 *    stage, and this component ticks that stage off. There is no timer
 *    counting to 100%, because we genuinely do not know in advance how long
 *    somebody else's website will take to answer.
 */

interface StageItem {
  stage: string;
  label: string;
}

type FormState =
  | { kind: "idle" }
  | { kind: "running"; stages: StageItem[]; completed: string[]; current: string | null }
  | { kind: "error"; message: string; code?: string };

/** A permissive browser-side sanity check. The server decides for real. */
function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  if (/\s/.test(trimmed)) return false;

  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    // Needs a dot to be a public domain: "example.com", not "localhost".
    return url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function AuditForm({
  autoFocus = false,
  size = "lg",
  className,
}: {
  autoFocus?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });

  const running = state.kind === "running";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running) return;

    const url = value.trim();

    if (!looksLikeUrl(url)) {
      setState({
        kind: "error",
        message:
          "Please enter a valid public web address, for example https://example.com/page.",
      });
      inputRef.current?.focus();
      return;
    }

    setState({ kind: "running", stages: [], completed: [], current: null });

    try {
      const response = await fetch("/api/audit/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.body) {
        throw new Error("The server did not return a readable response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;

        buffer += decoder.decode(chunk, { stream: true });

        // SSE messages are separated by a blank line.
        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";

        for (const message of messages) {
          const line = message.split("\n").find((part) => part.startsWith("data:"));
          if (!line) continue;

          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (payload.type === "start") {
            const stages = (payload.stages as StageItem[] | undefined) ?? [];
            setState({ kind: "running", stages, completed: [], current: null });
          }

          if (payload.type === "stage") {
            const stage = String(payload.stage);
            setState((previous) => {
              if (previous.kind !== "running") return previous;
              const completed = previous.current
                ? [...new Set([...previous.completed, previous.current])]
                : previous.completed;
              return { ...previous, completed, current: stage };
            });
          }

          if (payload.type === "result") {
            if (payload.status === "completed" && typeof payload.reportUrl === "string") {
              router.push(payload.reportUrl);
              return;
            }

            const error = payload.error as { message?: string; code?: string } | undefined;
            setState({
              kind: "error",
              message:
                error?.message ??
                "We could not complete this audit. Please check the URL and try again.",
              code: error?.code,
            });
            return;
          }
        }
      }

      // The stream ended without a result event, which should not happen.
      setState({
        kind: "error",
        message: "The connection ended before the audit finished. Please try again.",
      });
    } catch {
      setState({
        kind: "error",
        message:
          "We could not reach the audit service. Please check your connection and try again.",
      });
    }
  }

  const inputHeight = size === "lg" ? "h-14" : "h-12";

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="audit-url" className="sr-only">
          Webpage URL to analyze
        </label>

        <div
          className={cn(
            "flex flex-col gap-2 rounded-[var(--radius-input)] border bg-surface p-2 shadow-[var(--shadow-raised)] transition-colors sm:flex-row sm:items-center",
            state.kind === "error" ? "border-danger-border" : "border-neutral-border",
          )}
        >
          <div className="flex flex-1 items-center gap-2.5 pl-2.5">
            <Search className="h-5 w-5 shrink-0 text-ink-400" aria-hidden="true" />
            <input
              ref={inputRef}
              id="audit-url"
              name="url"
              type="text"
              inputMode="url"
              autoComplete="url"
              autoFocus={autoFocus}
              spellCheck={false}
              disabled={running}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (state.kind === "error") setState({ kind: "idle" });
              }}
              onPaste={(event) => {
                // Paste often carries stray whitespace or a newline from an
                // email. Clean it here so the user never sees the error.
                const pasted = event.clipboardData.getData("text");
                if (/\s/.test(pasted)) {
                  event.preventDefault();
                  setValue(pasted.trim().replace(/\s+/g, ""));
                }
              }}
              placeholder="https://example.com/page"
              aria-invalid={state.kind === "error"}
              aria-describedby={state.kind === "error" ? "audit-url-error" : undefined}
              className={cn(
                "w-full min-w-0 bg-transparent font-mono text-[15px] text-ink-950 outline-none placeholder:font-sans placeholder:text-ink-400 disabled:opacity-60",
                inputHeight,
              )}
            />
          </div>

          <Button
            type="submit"
            size={size === "lg" ? "lg" : "md"}
            disabled={running}
            className="w-full sm:w-auto"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Analyzing
              </>
            ) : (
              <>
                Analyze SEO
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Status messages are announced to screen readers as they change. */}
      <div aria-live="polite" className="mt-3">
        {state.kind === "error" ? (
          <p
            id="audit-url-error"
            className="flex items-start gap-2 text-sm text-danger-ink"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{state.message}</span>
          </p>
        ) : null}

        {running ? <ProgressList state={state} /> : null}
      </div>
    </div>
  );
}

/**
 * The stage checklist.
 *
 * Each row is ticked when the server reports that stage finished. Stages that
 * have not been reached stay grey. No stage shows a percentage, because the
 * server does not know one.
 */
function ProgressList({
  state,
}: {
  state: Extract<FormState, { kind: "running" }>;
}) {
  if (state.stages.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-600">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Starting the audit…
      </p>
    );
  }

  return (
    <ol className="space-y-1.5 rounded-[var(--radius-card)] border border-neutral-border bg-surface px-4 py-3.5 text-sm">
      {state.stages.map((item) => {
        const isDone = state.completed.includes(item.stage);
        const isCurrent = state.current === item.stage;

        return (
          <li
            key={item.stage}
            className={cn(
              "flex items-center gap-2.5",
              isDone && "text-ink-600",
              isCurrent && "font-medium text-ink-950",
              !isDone && !isCurrent && "text-ink-400",
            )}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {isDone ? (
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
              ) : isCurrent ? (
                <Loader2 className="h-4 w-4 animate-spin text-info" aria-hidden="true" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-ink-200" aria-hidden="true" />
              )}
            </span>
            {item.label}
          </li>
        );
      })}
    </ol>
  );
}

/** The reassurance line under the form on the homepage. */
export function FormFootnote() {
  return (
    <p className="mt-4 text-sm text-ink-500">
      Free • No signup required • Analyzes one page at a time
    </p>
  );
}
