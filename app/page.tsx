import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Braces,
  FileSearch,
  Link2,
  ListChecks,
  Share2,
  Wrench,
} from "lucide-react";

import { AuditForm, FormFootnote } from "@/components/audit/audit-form";
import { Container, Card, SectionLabel, ButtonLink } from "@/components/ui";
import {
  FeatureCard,
  GuideCard,
  LimitationsList,
  SectionHeading,
  StepCard,
  TrustStrip,
} from "@/components/marketing/blocks";
import { ReportPreview } from "@/components/marketing/report-preview";
import { guides } from "@/content/guides";
import { checkRegistry, CHECK_COUNT } from "@/lib/seo/registry";
import { CATEGORY_LABELS, CHECK_CATEGORIES } from "@/lib/seo/types";
import { CATEGORY_WEIGHTS } from "@/lib/seo/scoring";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: `${siteConfig.name} — Free On-Page & Technical SEO Audit`,
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

const TRUST_ITEMS = [
  "On-page SEO checks",
  "Technical SEO checks",
  "Structured data detection",
  "Clear recommendations",
  "Beginner-friendly explanations",
] as const;

const LIMITATIONS = [
  {
    title: "Rankings and search traffic",
    body: "We never see your position in search results or your clicks and impressions. Those come from Google Search Console, connected to your own site.",
  },
  {
    title: "Backlinks and authority scores",
    body: "We do not crawl the web, so we cannot tell you who links to you. Domain Authority and similar figures are vendor-invented metrics, not numbers Google publishes.",
  },
  {
    title: "Page speed — measured by Google, not by us",
    body: "Reports can pull live Core Web Vitals from the Google PageSpeed Insights API. It is shown separately and clearly attributed, and it never feeds into our score: Google's figures vary between runs, and our score is fixed arithmetic.",
  },
  {
    title: "Whether Google will index your page",
    body: "We can tell you what your page asks search engines to do. Whether they do it depends on factors no external tool can observe.",
  },
] as const;

export default function HomePage() {
  const checksByCategory = CHECK_CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    weight: CATEGORY_WEIGHTS[category],
    count: checkRegistry.filter((check) => check.category === category).length,
  }));

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="wash-accent relative overflow-hidden border-b border-neutral-border">
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden="true" />

        <Container className="relative">
          <div className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16">
            {/* Copy + form */}
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-neutral-border bg-surface/80 px-3 py-1 text-xs font-medium text-ink-600 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                {CHECK_COUNT} checks · no signup · results in seconds
              </span>

              <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                Check your webpage&rsquo;s SEO in{" "}
                <span className="bg-gradient-to-r from-accent-700 to-accent-500 bg-clip-text text-transparent">
                  seconds
                </span>
              </h1>

              <p className="mt-5 text-lg leading-relaxed text-ink-600">
                Find technical and on-page SEO issues, understand why they matter, and get
                practical recommendations to improve your page.
              </p>

              {/*
                Deliberately NOT autofocused.

                The homepage is a page people read: it has a heading, a
                description and a skip link. Moving focus into the input on load
                lands a keyboard or screen reader user in the middle of the page,
                past the skip link that exists precisely so they can jump the
                header. /seo-checker does autofocus, because someone who
                navigated there arrived to do one specific thing.
              */}
              <AuditForm className="mt-8" />
              <FormFootnote />
            </div>

            {/* A miniature of the real output, rather than a stock illustration */}
            <ReportPreview className="hidden lg:block" />
          </div>

          <div className="relative border-t border-neutral-border/70 py-6">
            <TrustStrip items={TRUST_ITEMS} />
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* How it works                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 sm:py-20" id="how-it-works">
        <Container>
          <SectionHeading
            label="How it works"
            title="Three steps, no account"
            description="Paste a URL and read the result. There is nothing to install and nothing to configure."
          />

          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            <StepCard step="01" title="Enter a URL">
              Paste any publicly accessible webpage address. It does not have to be your own site.
            </StepCard>
            <StepCard step="02" title="We analyze it">
              Our crawler fetches the page, its robots.txt and its sitemap, then runs {CHECK_COUNT}{" "}
              checks against what it finds.
            </StepCard>
            <StepCard step="03" title="Fix the issues">
              Work down a prioritised list, with the reason each item matters and how to address it.
            </StepCard>
          </div>

          <div className="mt-10">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-info-ink underline-offset-4 hover:underline"
            >
              Read how the audit and score work
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Features                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section className="wash-soft border-y border-neutral-border bg-surface py-16 sm:py-20">
        <Container>
          <SectionHeading
            label="What gets checked"
            title="A complete page-level audit"
            description="Every check reports what it found, why that matters, and what you could do about it — separately, so a measurement is never confused with an opinion."
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard icon={<FileSearch className="h-4.5 w-4.5" />} title="On-page SEO">
              Titles, meta descriptions, heading structure, image alt text and the readable content
              of the page.
            </FeatureCard>
            <FeatureCard icon={<Wrench className="h-4.5 w-4.5" />} title="Technical SEO">
              Status codes, redirect chains, HTTPS, canonical URLs, robots directives, language and
              viewport.
            </FeatureCard>
            <FeatureCard icon={<Braces className="h-4.5 w-4.5" />} title="Structured data">
              JSON-LD detection with JSON validation and the schema types declared, plus microdata
              and RDFa.
            </FeatureCard>
            <FeatureCard icon={<Share2 className="h-4.5 w-4.5" />} title="Social metadata">
              Open Graph and Twitter/X card tags that decide how your page looks when it is shared.
            </FeatureCard>
            <FeatureCard icon={<Link2 className="h-4.5 w-4.5" />} title="Links">
              Internal and external link structure, rel attributes, and link text that describes
              nothing.
            </FeatureCard>
            <FeatureCard icon={<ListChecks className="h-4.5 w-4.5" />} title="Prioritised fixes">
              Issues ordered by how much they actually matter, so you know what to do first.
            </FeatureCard>
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Scoring transparency                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionHeading
                label="Transparent scoring"
                title="You can see exactly how the score is calculated"
                description="The score is deterministic arithmetic, not a judgement. The same page always produces the same number, every weight is published, and a check we could not measure is excluded rather than counted against you."
              />

              <p className="mt-5 text-sm leading-relaxed text-ink-600">
                {siteConfig.scoreDisclaimer}
              </p>

              <ButtonLink href="/how-it-works#scoring" variant="secondary" size="md" className="mt-6">
                See the full scoring rules
              </ButtonLink>
            </div>

            <Card className="overflow-hidden">
              <div className="border-b border-neutral-border bg-surface-muted px-5 py-3.5">
                <SectionLabel>Category weights</SectionLabel>
              </div>
              <ul className="divide-y divide-neutral-border">
                {checksByCategory.map((item) => (
                  <li
                    key={item.category}
                    className="flex items-center gap-4 px-5 py-3.5 text-sm"
                  >
                    <span className="w-36 shrink-0 font-medium text-ink-900">{item.label}</span>
                    <span
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100"
                      aria-hidden="true"
                    >
                      <span
                        className="block h-full rounded-full bg-ink-950"
                        style={{ width: `${(item.weight / 35) * 100}%` }}
                      />
                    </span>
                    <span className="tabular w-10 shrink-0 text-right font-medium text-ink-900">
                      {item.weight}%
                    </span>
                    <span className="tabular w-20 shrink-0 text-right text-xs text-ink-500">
                      {item.count} checks
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Guides                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-neutral-border bg-surface py-16 sm:py-20">
        <Container>
          <SectionHeading
            label="SEO guides"
            title="Learn what each SEO check means"
            description="Plain explanations of the elements this tool measures, written for someone who has just seen the result and wants to know what to do about it."
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {guides.map((guide) => (
              <GuideCard
                key={guide.slug}
                href={`/seo-guides/${guide.slug}`}
                title={guide.title.replace(/^What is (a|an) /, "").replace(/\?$/, "")}
                description={guide.definition.split(".")[0] + "."}
              />
            ))}
          </div>

          <Link
            href="/seo-guides"
            className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-info-ink underline-offset-4 hover:underline"
          >
            Browse all guides
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Honest limitations                                               */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 sm:py-20">
        <Container>
          <SectionHeading
            label="What this tool does not do"
            title="The things we will not pretend to measure"
            description="An audit is only useful if you can trust it. These are real limits of analysing a single page from the outside, and no tool that works this way can get round them."
          />

          <div className="mt-10">
            <LimitationsList items={LIMITATIONS} />
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Final CTA                                                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="pb-4">
        <Container>
          <Card className="bg-ink-950 px-6 py-12 text-center sm:px-12">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">
              Analyze your page now
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-ink-300">
              Free, no signup, and the full report stays available at its own link so you can share
              it or come back to it.
            </p>
            <div className="mt-7 flex justify-center">
              <ButtonLink href="/seo-checker" variant="secondary" size="lg">
                Analyze my page
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            </div>
          </Card>
        </Container>
      </section>
    </>
  );
}
