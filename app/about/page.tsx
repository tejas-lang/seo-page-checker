import type { Metadata } from "next";
import Link from "next/link";

import { Card, Container, SectionLabel, ButtonLink, CodeBlock } from "@/components/ui";
import { CHECK_COUNT } from "@/lib/seo/registry";
import { crawlerUserAgent, env } from "@/lib/config/env";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "What SEO Page Checker is, the principles it is built on, and information for site owners about the crawler that fetches their pages.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <SectionLabel>About</SectionLabel>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        About {siteConfig.name}
      </h1>

      <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-ink-700">
        <p>
          {siteConfig.name} runs {CHECK_COUNT} technical and on-page SEO checks against a single
          webpage and explains what it found in plain language. It is free, needs no account, and
          works on any publicly reachable page — yours or anyone else&rsquo;s.
        </p>
        <p>
          It exists because most free SEO checkers do one of two unhelpful things. They either
          produce a score with no explanation of where it came from, or they invent metrics that
          sound authoritative and are not measurable from outside a site at all.
        </p>
      </div>

      {/* ---------------------------------------------------------------- */}
      <section className="mt-12" aria-labelledby="principles">
        <h2 id="principles" className="text-2xl font-semibold">
          The principles this is built on
        </h2>

        <div className="mt-6 space-y-6">
          <Principle title="No invented data">
            If something cannot be determined reliably, the report says &ldquo;unable to
            determine&rdquo; and gives the reason. It never shows a zero where it means
            &ldquo;unknown&rdquo;, and a check we could not run is removed from the score rather
            than counted against the page.
          </Principle>

          <Principle title="Facts and advice are kept apart">
            Every result states what was measured, then separately what you might do about it.
            &ldquo;Title length: 74 characters&rdquo; is a fact. &ldquo;Consider shortening
            it&rdquo; is advice. Conflating the two is how tools end up asserting rules that do not
            exist.
          </Principle>

          <Principle title="No ranking promises">
            No check claims that fixing it will improve your position in search. Nobody outside a
            search engine can make that claim honestly. The wording throughout is about how search
            engines may understand or display your page — which is what these elements actually
            control.
          </Principle>

          <Principle title="The score is arithmetic, not judgement">
            Every weight is published, the calculation is shown on each report, and the same page
            always produces the same number. No AI writes any part of an audit.
          </Principle>

          <Principle title="We say what we cannot do">
            No rankings, no backlinks, no authority score, no Core Web Vitals, no indexing status.
            Those need data sources this tool does not have, and inventing them would make
            everything else less trustworthy.
          </Principle>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="mt-12 scroll-mt-20" id="bot" aria-labelledby="bot-heading">
        <h2 id="bot-heading" className="text-2xl font-semibold">
          Information for site owners
        </h2>
        <p className="mt-3 leading-relaxed text-ink-700">
          If you see our crawler in your logs, this is what it is and what it does.
        </p>

        <Card className="mt-5 overflow-hidden">
          <dl className="divide-y divide-neutral-border text-sm">
            <BotRow label="User-Agent" value={crawlerUserAgent} mono />
            <BotRow label="Triggered by" value="A person pasting a URL into this website. Never scheduled or automatic." />
            <BotRow
              label="Requests per audit"
              value="Three at most: the page itself, /robots.txt, and one sitemap."
            />
            <BotRow label="Request method" value="GET only. We never POST, and we never submit forms." />
            <BotRow
              label="JavaScript"
              value="Never executed. We use an HTML parser, not a browser."
            />
            <BotRow
              label="Timeout"
              value={`${Math.round(env.CRAWL_TIMEOUT / 1000)} seconds, then we give up.`}
            />
            <BotRow
              label="Maximum download"
              value={`${Math.round(env.MAX_CRAWL_SIZE / (1024 * 1024))} MB per response.`}
            />
            <BotRow label="Crawl depth" value="One page. We do not follow links into your site." />
          </dl>
        </Card>

        <h3 className="mt-8 text-lg font-semibold">If you want to block it</h3>
        <p className="mt-2 leading-relaxed text-ink-700">
          Add this to your robots.txt. We identify ourselves honestly and never impersonate
          Googlebot, so blocking us works.
        </p>
        <CodeBlock
          className="mt-3"
          code={`User-agent: SEOPageCheckerBot
Disallow: /`}
        />
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          One caveat worth being straight about: a person can still ask us to audit a page you have
          blocked, and the audit will report that robots.txt disallows it. We do not fetch pages
          you have disallowed in order to analyse their content.
        </p>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="mt-12" aria-labelledby="tech">
        <h2 id="tech" className="text-2xl font-semibold">
          How it is built
        </h2>
        <p className="mt-3 leading-relaxed text-ink-700">
          Next.js and TypeScript, with Cheerio for HTML parsing and PostgreSQL for stored reports.
          The crawler validates every URL and every redirect hop against a set of rules that block
          private networks and cloud metadata endpoints — the protection against an attack called
          SSRF, described in{" "}
          <Link href="/privacy" className="text-info-ink underline-offset-4 hover:underline">
            the privacy policy
          </Link>{" "}
          and in SECURITY.md in the project repository.
        </p>
      </section>

      <div className="mt-12 flex flex-wrap gap-3 border-t border-neutral-border pt-8">
        <ButtonLink href="/seo-checker" size="lg">
          Analyze a page
        </ButtonLink>
        <ButtonLink href="/contact" variant="secondary" size="lg">
          Get in touch
        </ButtonLink>
      </div>
    </Container>
  );
}

function Principle({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-neutral-border pl-5">
      <h3 className="text-[17px] font-semibold">{title}</h3>
      <p className="mt-1.5 leading-relaxed text-ink-700">{children}</p>
    </div>
  );
}

function BotRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[170px_1fr] sm:gap-4">
      <dt className="text-ink-500">{label}</dt>
      <dd className={`break-words text-ink-900 ${mono ? "font-mono text-[13px]" : ""}`}>{value}</dd>
    </div>
  );
}
