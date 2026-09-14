"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

export function ContactForm({ fallbackEmail }: { fallbackEmail: string | null }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind === "sending") return;

    const form = new FormData(event.currentTarget);
    setState({ kind: "sending" });

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          message: String(form.get("message") ?? ""),
          website: String(form.get("website") ?? ""),
        }),
      });

      if (response.ok) {
        setState({ kind: "sent" });
        return;
      }

      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      setState({
        kind: "error",
        message:
          payload?.error?.message ??
          "We could not send that message. Please try again in a moment.",
      });
    } catch {
      setState({
        kind: "error",
        message: "We could not reach the server. Please check your connection and try again.",
      });
    }
  }

  if (state.kind === "sent") {
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-success-border bg-success-soft px-5 py-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
        <div>
          <p className="font-semibold text-success-ink">Message sent</p>
          <p className="mt-1 text-sm leading-relaxed text-success-ink">
            Thanks — we have it. We read everything, though we cannot promise a reply to every
            message.
          </p>
        </div>
      </div>
    );
  }

  const sending = state.kind === "sending";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" name="name" autoComplete="name" required />
        <Field label="Email address" name="email" type="email" autoComplete="email" required />
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-ink-900">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={6}
          required
          minLength={10}
          maxLength={5000}
          disabled={sending}
          className="mt-1.5 w-full rounded-[var(--radius-input)] border border-neutral-border bg-surface px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-ink-400 focus:border-ink-400 disabled:opacity-60"
          placeholder="What would you like to tell us?"
        />
      </div>

      {/*
        Honeypot: hidden from people, irresistible to naive bots. It is hidden
        with a wrapper rather than `display:none` on the input so that screen
        readers skip it via aria-hidden, and it is never required.
      */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-website">Leave this field empty</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div aria-live="polite">
        {state.kind === "error" ? (
          <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning-ink">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p>{state.message}</p>
              {fallbackEmail ? (
                <p className="mt-1">
                  You can email us directly at{" "}
                  <a href={`mailto:${fallbackEmail}`} className="font-medium underline">
                    {fallbackEmail}
                  </a>
                  .
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <Button type="submit" size="md" disabled={sending} className={cn(sending && "opacity-70")}>
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Sending
          </>
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden="true" />
            Send message
          </>
        )}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={`contact-${name}`} className="block text-sm font-medium text-ink-900">
        {label}
      </label>
      <input
        id={`contact-${name}`}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="mt-1.5 h-11 w-full rounded-[var(--radius-input)] border border-neutral-border bg-surface px-3.5 text-[15px] outline-none transition-colors placeholder:text-ink-400 focus:border-ink-400 disabled:opacity-60"
      />
    </div>
  );
}
