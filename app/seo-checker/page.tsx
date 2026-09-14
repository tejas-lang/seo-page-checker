import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lock, Timer, Zap } from "lucide-react";

import { AuditForm } from "@/components/audit/audit-form";
import { Alert, Card, Container, SectionLabel } from "@/components/ui";
import { isDatabaseConfigured } from "@/lib/db/client";
import { checkRegistry, CHECK_COUNT } from "@/lib/seo/registry";
import { CATEGORY_LABELS, CHECK_CATEGORIES } from "@/lib/seo/types";
import { siteConfig } from "@/lib/config/site";
import { env } from "@/lib/config/env";

export const metadata: Metadata = {
  title: "SEO Checker — analyze any page",
  description:
    "Paste a URL and get a page-level SEO audit: titles, headings, canonical, robots directives, structured data, links and more. Free, no signup.",
  alternates: { canonical: "/seo-checker" },
};

export default function SeoCheckerPage() {
  const byCategory = CHECK_CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    checks: checkRegistry.filter((check) => check.category === category),
  }));

  return (
    <Container className="relative py-12 sm:py-16">
      <div className="wash-accent pointer-events-none absolute inset-x-0 top-0 h-72" aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl text-center">
        <SectionLabel>SEO Checker</SectionLabel>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Analyze a page
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-ink-600">
          Enter any publicly accessible webpage. We fetch it once, read the HTML exactly as the
          server sent it, and report what we find.
        </p>
      </div>

      {/*
        A development-only notice. Shown here rather than site-wide because
        this is the page where a developer is about to create a report that
        will not survive a restart. It never appears in production.
      */}
      {!isDatabaseConfigured() && env.NODE_ENV !== "production" ? (
        <Alert
          tone="warning"
          className="mx-auto mt-8 max-w-2xl"
          title="No database configured"
        >
          <p className="mt-1 leading-relaxed">
            Reports are being kept in memory and will be lost when the server
            restarts. Set <code className="font-mono">DATABASE_URL</code> in your{" "}
            <code className="font-mono">.env</code> file to store them properly. See README.md.
          </p>
        </Alert>
      ) : null}

      <AuditForm className="mx-auto mt-9 max-w-2xl" autoFocus />

      <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-500">
        <span className="flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-ink-400" aria-hidden="true" />
          {CHECK_COUNT} checks
        </span>
        <span className="flex items-center gap-1.5">
          <Timer className="h-4 w-4 text-ink-400" aria-hidden="true" />
          Usually under 10 seconds
        </span>
        <span className="flex items-center gap-1.5">
          <Lock className="h-4 w-4 text-ink-400" aria-hidden="true" />
          {env.RATE_LIMIT_MAX} audits per hour, free
        </span>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Empty state: what will happen                                    */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="what-we-check" className="mt-16">
        <div className="text-center">
          <h2 id="what-we-check" className="text-xl font-semibold">
            What we will check
          </h2>
          <p className="mt-1.5 text-sm text-ink-600">
            No audit yet. Enter a public webpage URL above to start your first SEO check.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {byCategory.map((group) => (
            <Card key={group.category} className="px-4 py-4">
              <h3 className="text-[15px] font-semibold">{group.label}</h3>
              <ul className="mt-3 space-y-1.5">
                {group.checks.map((check) => (
                  <li key={check.key} className="flex items-center gap-2 text-sm text-ink-600">
                    <span
                      className="h-1 w-1 shrink-0 rounded-full bg-ink-300"
                      aria-hidden="true"
                    />
                    {check.title}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Honest notes                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto mt-16 max-w-3xl">
        <Card className="px-5 py-5">
          <h2 className="text-[15px] font-semibold">Before you run it, two things worth knowing</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-600">
            <p>
              <span className="font-medium text-ink-900">We do not run JavaScript.</span> We read
              the HTML as your server sends it. If your page builds its content in the browser,
              this report describes the initial HTML, not what you see on screen. The
              &ldquo;Content rendering&rdquo; check will tell you when that looks likely.
            </p>
            <p>
              <span className="font-medium text-ink-900">
                We check one page, not a whole site.
              </span>{" "}
              That means we cannot tell you whether a title is duplicated elsewhere, or which pages
              link to this one. We fetch the page you give us plus its robots.txt and sitemap —
              nothing else.
            </p>
          </div>

          <Link
            href="/how-it-works"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-info-ink underline-offset-4 hover:underline"
          >
            How the audit works in detail
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Card>

        <p className="mt-5 text-center text-xs leading-relaxed text-ink-500">
          {siteConfig.disclaimer}
        </p>
      </section>
    </Container>
  );
}
