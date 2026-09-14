import type { Metadata } from "next";

import { Container, SectionLabel, ButtonLink } from "@/components/ui";
import { GuideCard } from "@/components/marketing/blocks";
import { guides } from "@/content/guides";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "SEO guides",
  description:
    "Plain-language guides to the SEO elements this tool checks: title tags, meta descriptions, H1s, canonical URLs, robots.txt, sitemaps, schema markup and image alt text.",
  alternates: { canonical: "/seo-guides" },
};

export default function GuidesIndexPage() {
  return (
    <Container className="relative py-12 sm:py-16">
      <div className="wash-soft pointer-events-none absolute inset-x-0 top-0 h-80" aria-hidden="true" />
      <div className="relative max-w-2xl">
        <SectionLabel>SEO guides</SectionLabel>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Learn what each SEO check means
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-600">
          One guide per element this tool measures. Each explains what it is, why it matters, the
          mistakes people actually make, and how to fix them — without the ranking promises.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((guide) => (
          <GuideCard
            key={guide.slug}
            href={`/seo-guides/${guide.slug}`}
            title={guide.title}
            description={guide.summary}
          />
        ))}
      </div>

      <div className="mt-12 rounded-[var(--radius-card)] border border-neutral-border bg-surface px-6 py-8 text-center">
        <h2 className="text-xl font-semibold">See these checks on your own page</h2>
        <p className="mx-auto mt-2 max-w-lg text-[15px] leading-relaxed text-ink-600">
          Every guide corresponds to a check in the audit. Run one and each result links back to
          the guide that explains it.
        </p>
        <ButtonLink href="/seo-checker" size="lg" className="mt-6">
          Analyze my page
        </ButtonLink>
      </div>

      <p className="mt-8 text-center text-xs text-ink-500">{siteConfig.disclaimer}</p>
    </Container>
  );
}
