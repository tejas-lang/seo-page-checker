import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card, Container, ButtonLink, SectionLabel, CodeBlock } from "@/components/ui";
import { SectionHeading } from "@/components/marketing/blocks";
import { checkRegistry, CHECK_COUNT } from "@/lib/seo/registry";
import { CATEGORY_LABELS, CHECK_CATEGORIES } from "@/lib/seo/types";
import { CATEGORY_WEIGHTS, SCORE_BANDS, SEVERITY_DEDUCTIONS } from "@/lib/seo/scoring";
import { env } from "@/lib/config/env";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How SEO Page Checker fetches a page, what it checks, exactly how the score is calculated, and what it deliberately does not measure.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  const categoryTable = CHECK_CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    weight: CATEGORY_WEIGHTS[category],
    checks: checkRegistry.filter((check) => check.category === category),
  }));

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <SectionLabel>How it works</SectionLabel>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        What happens when you paste a URL
      </h1>
      <p className="mt-4 text-[17px] leading-relaxed text-ink-600">
        No magic and no black box. This page describes every step, the exact scoring arithmetic,
        and the things this tool cannot tell you.
      </p>

      {/* ---------------------------------------------------------------- */}
      <section className="mt-12" aria-labelledby="pipeline">
        <h2 id="pipeline" className="text-2xl font-semibold">
          The six steps
        </h2>

        <ol className="mt-6 space-y-6">
          <Step
            number="01"
            title="Your URL is validated"
            body="Before anything is fetched, the address is checked: it must use http or https, on a standard port, with no username or password embedded, pointing at a public hostname. Addresses on private networks, loopback addresses and cloud metadata endpoints are refused. This protects our server, and it is why some URLs come back as 'cannot be analyzed for security reasons'."
          />
          <Step
            number="02"
            title="The page is fetched, once"
            body={`We make a single GET request, identifying ourselves honestly as ${env.CRAWLER_USER_AGENT ? "our own crawler" : "SEOPageCheckerBot"} — never as Googlebot. Redirects are followed one at a time, and every hop is re-validated against the same rules. The request gives up after ${Math.round(env.CRAWL_TIMEOUT / 1000)} seconds, follows at most ${env.MAX_REDIRECTS} redirects, and refuses to read more than ${Math.round(env.MAX_CRAWL_SIZE / (1024 * 1024))} MB.`}
          />
          <Step
            number="03"
            title="The HTML is parsed — not executed"
            body="We read the HTML with a parser, the way a document is read, not a browser. No JavaScript from your page ever runs on our server. That is a security decision, and it has a consequence worth knowing: if your content is built in the browser after load, we do not see it. The 'Content rendering' check exists to tell you when that appears to be happening."
          />
          <Step
            number="04"
            title="robots.txt and the sitemap are checked"
            body="Two more requests: /robots.txt for the site, and the first sitemap we can find — either the one robots.txt names, or the conventional paths. That is the complete list of what we request. We do not crawl the rest of your site."
          />
          <Step
            number="05"
            title={`${CHECK_COUNT} checks run against what we found`}
            body="Each check is a small, independent function that looks at the parsed facts and returns one result: a status, a measured value, a plain statement of what was found, and where relevant a recommendation. Facts and advice are kept separate on purpose, so a measurement is never dressed up as an opinion."
          />
          <Step
            number="06"
            title="The score is calculated"
            body="Deterministic arithmetic over those results — described in full below. The same page always produces the same number. No AI writes any part of the audit."
          />
        </ol>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="mt-14 scroll-mt-20" id="scoring" aria-labelledby="scoring-heading">
        <h2 id="scoring-heading" className="text-2xl font-semibold">
          How the score is calculated
        </h2>

        <p className="mt-3 leading-relaxed text-ink-700">
          Each check belongs to one category, and each category is worth a fixed share of the 100
          points:
        </p>

        <Card className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[440px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-border text-left text-xs uppercase tracking-[0.1em] text-ink-500">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Weight
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Checks
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-border">
              {categoryTable.map((row) => (
                <tr key={row.category}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-ink-900">
                    {row.label}
                  </th>
                  <td className="tabular px-4 py-3 text-right">{row.weight}%</td>
                  <td className="tabular px-4 py-3 text-right text-ink-600">{row.checks.length}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink-200 font-semibold">
                <th scope="row" className="px-4 py-3 text-left">
                  Total
                </th>
                <td className="tabular px-4 py-3 text-right">100%</td>
                <td className="tabular px-4 py-3 text-right">{CHECK_COUNT}</td>
              </tr>
            </tfoot>
          </table>
        </Card>

        <h3 className="mt-8 text-lg font-semibold">Inside a category</h3>
        <p className="mt-2 leading-relaxed text-ink-700">
          Not every check counts equally. A missing title tag costs far more than a missing
          favicon. Each check carries a weight within its category, and earns a share of it based
          on how it did:
        </p>

        <Card className="mt-4 px-5 py-4">
          <dl className="space-y-2.5 text-sm">
            {Object.entries(SEVERITY_DEDUCTIONS).map(([severity, deduction]) => (
              <div key={severity} className="flex items-baseline justify-between gap-4">
                <dt className="font-medium text-ink-900">
                  {severity.charAt(0) + severity.slice(1).toLowerCase()}
                </dt>
                <dd className="tabular text-ink-600">
                  {deduction === 0
                    ? "loses nothing"
                    : `loses ${Math.round(deduction * 100)}% of the check's weight`}
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 border-t border-neutral-border pt-2.5">
              <dt className="font-medium text-ink-900">Pass or informational</dt>
              <dd className="text-ink-600">loses nothing</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-medium text-ink-900">Unable to determine</dt>
              <dd className="text-ink-600">removed from the calculation entirely</dd>
            </div>
          </dl>
        </Card>

        <p className="mt-4 leading-relaxed text-ink-700">
          That last rule is the important one. If we cannot retrieve your robots.txt, that check is
          excluded rather than counted against you, and the points it would have carried are shared
          across the categories we could measure. You are never penalised for something we failed
          to measure.
        </p>

        <h3 className="mt-8 text-lg font-semibold">Worked example</h3>
        <p className="mt-2 leading-relaxed text-ink-700">
          On-Page SEO is worth 35 points and holds five checks weighted 10, 8, 8, 5 and 6 — 37
          points in total. Suppose every check passes except the meta description, which is flagged
          as a low-severity warning:
        </p>

        <CodeBlock
          className="mt-4"
          code={`meta description weight    = 8
low severity deduction     = 15%
points earned by that check = 8 × (1 − 0.15) = 6.8

category points earned     = 10 + 6.8 + 8 + 5 + 6 = 35.8
category points available  = 37

On-Page SEO score = round(35 / 37 × 35.8) = 34 out of 35`}
        />

        <h3 className="mt-8 text-lg font-semibold">Score bands</h3>
        <div className="mt-4 space-y-3">
          {SCORE_BANDS.map((band) => (
            <Card key={band.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="tabular font-mono text-sm font-medium text-ink-500">
                  {band.min}–{band.max}
                </span>
                <span className="font-semibold">{band.label}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">{band.summary}</p>
            </Card>
          ))}
        </div>

        <p className="mt-5 rounded-[var(--radius-card)] border border-neutral-border bg-surface px-4 py-3.5 text-sm leading-relaxed text-ink-600">
          {siteConfig.scoreDisclaimer} Two pages with the same score are not equally likely to
          rank — the score measures how well a page follows the conventions this tool checks, and
          nothing else.
        </p>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="mt-14" aria-labelledby="every-check">
        <h2 id="every-check" className="text-2xl font-semibold">
          Every check, and what it weighs
        </h2>
        <p className="mt-2 leading-relaxed text-ink-700">
          Weights are relative within each category. The full definitions live in SEO-CHECKS.md and
          SCORING.md in the project repository.
        </p>

        <div className="mt-6 space-y-6">
          {categoryTable.map((group) => (
            <div key={group.category}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
                {group.label} · {group.weight}%
              </h3>
              <Card className="mt-2.5 overflow-hidden">
                <ul className="divide-y divide-neutral-border text-sm">
                  {group.checks.map((check) => (
                    <li key={check.key} className="flex items-center justify-between gap-4 px-4 py-2.5">
                      <span className="text-ink-900">
                        {check.guide ? (
                          <Link
                            href={`/seo-guides/${check.guide}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {check.title}
                          </Link>
                        ) : (
                          check.title
                        )}
                      </span>
                      <span className="tabular shrink-0 text-ink-500">{check.weight} pts</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="mt-14" aria-labelledby="limits">
        <SectionHeading
          label="Limits"
          title="What we cannot tell you"
          description="These are genuine limits of analysing one page from the outside. No tool that works this way can get round them, and we would rather say so than invent a number."
        />

        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink-700">
          <p>
            <strong className="font-semibold text-ink-950">
              Whether your page is indexed, or where it ranks.
            </strong>{" "}
            We can read what your page asks search engines to do. What they actually do is visible
            only in Google Search Console, connected to your own site.
          </p>
          <p>
            <strong className="font-semibold text-ink-950">Backlinks or authority scores.</strong>{" "}
            We fetch one page. We have no index of the web, so we cannot know who links to you.
            &ldquo;Domain Authority&rdquo; and similar figures are vendor estimates, not numbers any
            search engine publishes.
          </p>
          <p>
            <strong className="font-semibold text-ink-950">
              Core Web Vitals — we do not measure these ourselves.
            </strong>{" "}
            A report can fetch them live from the Google PageSpeed Insights API, but that is
            Google&rsquo;s measurement shown under Google&rsquo;s name, not ours. It sits beside the
            SEO score rather than inside it, for two reasons: the two answer different questions,
            and Lighthouse results vary between runs while our score is fixed arithmetic that must
            give the same answer every time. Our own timing figure is just how long one request
            took from one location, and it is labelled as such.
          </p>
          <p>
            <strong className="font-semibold text-ink-950">
              Whether a title is duplicated across your site.
            </strong>{" "}
            That needs a crawl of every page. This tool checks one page at a time, deliberately.
          </p>
          <p>
            <strong className="font-semibold text-ink-950">
              Whether your structured data will produce a rich result.
            </strong>{" "}
            We confirm your JSON-LD is valid JSON and list its types. Eligibility is decided by
            rules that are not fully published — use Google&rsquo;s Rich Results Test.
          </p>
        </div>
      </section>

      <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-neutral-border pt-8">
        <ButtonLink href="/seo-checker" size="lg">
          Analyze a page
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </ButtonLink>
        <ButtonLink href="/seo-guides" variant="secondary" size="lg">
          Read the guides
        </ButtonLink>
      </div>
    </Container>
  );
}

function Step({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <li className="flex gap-5">
      <span className="tabular shrink-0 font-mono text-sm font-medium text-ink-400">{number}</span>
      <div>
        <h3 className="text-[17px] font-semibold">{title}</h3>
        <p className="mt-1.5 leading-relaxed text-ink-700">{body}</p>
      </div>
    </li>
  );
}
