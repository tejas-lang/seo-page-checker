import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight } from "lucide-react";

import { Card, CodeBlock, Container, ButtonLink } from "@/components/ui";
import { AuditForm } from "@/components/audit/audit-form";
import { getGuide, guides } from "@/content/guides";
import { getCheck } from "@/lib/seo/registry";
import { siteConfig } from "@/lib/config/site";

/**
 * A single guide.
 *
 * Statically generated at build time — the content does not change per request,
 * so there is no reason to render it on demand.
 *
 * Each page carries Article and BreadcrumbList structured data. Only those two:
 * the content genuinely is an article with a breadcrumb trail. We do not add
 * FAQPage markup to pages that are not FAQs, which is exactly the kind of
 * over-claiming this tool warns other people about.
 */

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) return { title: "Guide not found" };

  return {
    title: guide.title,
    description: guide.summary,
    alternates: { canonical: `/seo-guides/${guide.slug}` },
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.summary,
      url: `${siteConfig.url}/seo-guides/${guide.slug}`,
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) notFound();

  const relatedGuides = guide.related
    .map((relatedSlug) => getGuide(relatedSlug))
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  const relatedChecks = guide.checkKeys
    .map((key) => getCheck(key))
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.title,
        description: guide.summary,
        dateModified: guide.updated,
        mainEntityOfPage: `${siteConfig.url}/seo-guides/${guide.slug}`,
        publisher: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
          {
            "@type": "ListItem",
            position: 2,
            name: "SEO guides",
            item: `${siteConfig.url}/seo-guides`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: guide.title,
            item: `${siteConfig.url}/seo-guides/${guide.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <Container size="narrow" className="py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink-500">
          <li>
            <Link href="/" className="hover:text-ink-900">
              Home
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <li>
            <Link href="/seo-guides" className="hover:text-ink-900">
              SEO guides
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <li aria-current="page" className="text-ink-900">
            {guide.title}
          </li>
        </ol>
      </nav>

      <article className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{guide.title}</h1>

        {/* The short answer, up front. */}
        <div className="mt-6 rounded-[var(--radius-card)] border-l-4 border-ink-950 bg-surface px-5 py-4">
          <p className="text-[17px] leading-relaxed text-ink-900">{guide.definition}</p>
        </div>

        <div className="mt-10 space-y-10">
          {guide.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold">{section.heading}</h2>

              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-3 leading-relaxed text-ink-700">
                  {paragraph}
                </p>
              ))}

              {section.bullets ? (
                <ul className="mt-3 space-y-2">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3 leading-relaxed text-ink-700">
                      <span
                        className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-ink-400"
                        aria-hidden="true"
                      />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {section.code ? (
                <figure className="mt-4">
                  <CodeBlock code={section.code.snippet} />
                  {section.code.caption ? (
                    <figcaption className="mt-2 text-sm text-ink-500">
                      {section.code.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ) : null}
            </section>
          ))}
        </div>
      </article>

      {/* ---------------------------------------------------------------- */}
      {/* Try it                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-12 rounded-[var(--radius-card)] border border-neutral-border bg-surface px-5 py-6">
        <h2 className="text-xl font-semibold">Check this on your own page</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
          {relatedChecks.length > 0 ? (
            <>
              This guide explains the{" "}
              <strong className="font-medium text-ink-900">
                {relatedChecks.map((check) => check.title).join(" and ")}
              </strong>{" "}
              {relatedChecks.length === 1 ? "check" : "checks"} in the audit. Run one to see what
              your page does.
            </>
          ) : (
            "Run an audit to see how your page handles this and everything else in the checklist."
          )}
        </p>
        <AuditForm className="mt-4" size="md" />
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Related                                                          */}
      {/* ---------------------------------------------------------------- */}
      {relatedGuides.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Related guides</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {relatedGuides.map((related) => (
              <Card key={related.slug} className="p-0">
                <Link
                  href={`/seo-guides/${related.slug}`}
                  className="block px-4 py-3.5 transition-colors hover:bg-surface-muted"
                >
                  <span className="text-[15px] font-semibold text-ink-950">{related.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-600">
                    {related.summary}
                  </span>
                </Link>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/seo-guides" variant="secondary" size="md">
              All guides
            </ButtonLink>
            <ButtonLink href="/how-it-works" variant="ghost" size="md">
              How the audit works
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          </div>
        </section>
      ) : null}

      <p className="mt-10 border-t border-neutral-border pt-6 text-xs leading-relaxed text-ink-500">
        Last reviewed{" "}
        <time dateTime={guide.updated}>
          {new Date(guide.updated).toLocaleDateString("en-GB", {
            year: "numeric",
            month: "long",
          })}
        </time>
        . {siteConfig.disclaimer}
      </p>
    </Container>
  );
}
