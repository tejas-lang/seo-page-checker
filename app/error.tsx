"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button, ButtonLink, Container } from "@/components/ui";

/**
 * The error boundary.
 *
 * Users see an explanation and a way forward. They never see a stack trace or
 * an internal message — `error.digest` is an opaque id Next.js also writes to
 * the server log, so support can find the real error without exposing it here.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The detail is already in the server log; this records that the reader
    // actually hit the boundary, in their browser.
    console.error("An unexpected error occurred", error.digest ?? "");
  }, [error]);

  return (
    <Container size="narrow" className="py-16 sm:py-24">
      <div className="flex items-start gap-4">
        <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-warning" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Something went wrong
          </h1>
          <p className="mt-3 text-[17px] leading-relaxed text-ink-600">
            An unexpected error stopped this page from loading. This one is ours, not yours.
          </p>
          <p className="mt-3 leading-relaxed text-ink-600">
            Please try again. If it keeps happening, the contact page has a link for reporting it —
            quoting the reference below helps us find it in the logs.
          </p>

          {error.digest ? (
            <p className="mt-4 font-mono text-sm text-ink-500">Reference: {error.digest}</p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="button" onClick={reset} size="md">
              Try again
            </Button>
            <ButtonLink href="/seo-checker" variant="secondary" size="md">
              Back to the checker
            </ButtonLink>
            <ButtonLink href="/contact" variant="ghost" size="md">
              Report this
            </ButtonLink>
          </div>
        </div>
      </div>
    </Container>
  );
}
