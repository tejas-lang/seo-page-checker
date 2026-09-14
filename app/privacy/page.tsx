import type { Metadata } from "next";
import Link from "next/link";

import { Alert, Container, SectionLabel } from "@/components/ui";
import { env } from "@/lib/config/env";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What SEO Page Checker stores when you run an audit, how long it keeps it, and who can see a report.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "14 September 2026";

export default function PrivacyPage() {
  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <SectionLabel>Legal</SectionLabel>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Privacy policy</h1>
      <p className="mt-2 text-sm text-ink-500">Last updated {LAST_UPDATED}</p>

      <Alert tone="info" className="mt-8" title="The short version">
        <p className="mt-1 leading-relaxed">
          We store the URL you submitted and the report we produced. We do not store your IP
          address, we do not use tracking cookies, and we do not keep a copy of the page&rsquo;s
          HTML. Reports are deleted automatically after {env.AUDIT_RETENTION_DAYS} days.
        </p>
      </Alert>

      <div className="prose-custom mt-10 space-y-8">
        <Section title="What this service does with a URL">
          <p>
            When you submit a URL, our server requests that page from the web, along with the
            site&rsquo;s <code className="font-mono text-[0.9em]">/robots.txt</code> and its
            sitemap if it has one. We read the HTML, run our checks against it, and produce a
            report.
          </p>
          <p>
            The website you audit will see this request in its own server logs, including our
            crawler&rsquo;s user agent and the IP address of our server — not yours. Your address
            is never passed on to the site being audited.
          </p>
        </Section>

        <Section title="What we store">
          <ul>
            <li>The URL you submitted, and the final URL after any redirects.</li>
            <li>
              The report: the score, every check result, and a small set of measured facts about
              the page such as its title, meta description, word count and link counts.
            </li>
            <li>The date and time of the audit, and how long it took.</li>
          </ul>
          <p>
            We do <strong>not</strong> store a copy of the page&rsquo;s HTML, its images, or any
            content beyond the specific values named in the report.
          </p>
        </Section>

        <Section title="What we do not store">
          <ul>
            <li>
              <strong>Your IP address.</strong> It is used in memory to enforce the rate limit
              ({env.RATE_LIMIT_MAX} audits per hour) and is never written to a database or a log
              file.
            </li>
            <li>
              <strong>Cookies.</strong> This site sets none. There is no analytics tag, no
              advertising pixel and no third-party script that could set one.
            </li>
            <li>
              <strong>Accounts or personal details.</strong> There is nothing to sign up for, so
              there is nothing to collect.
            </li>
          </ul>
        </Section>

        <Section title="Who can see a report">
          <p>
            Each report has its own address, of the form{" "}
            <code className="font-mono text-[0.9em]">/audit/&lt;id&gt;</code>. The id is 120 bits
            of randomness, so a report cannot be found by guessing, by incrementing a number, or by
            browsing.
          </p>
          <p>
            <strong>Anyone who has the link can open the report.</strong> That is what makes a
            report shareable, and it is the trade-off to be aware of: treat the link as you would
            any other unlisted URL. Reports carry a noindex directive, so search engines are
            instructed not to list them.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Reports are deleted automatically {env.AUDIT_RETENTION_DAYS} days after they are
            created. After that the link stops working, permanently. If you need a report for
            longer, use the print view to save a PDF copy.
          </p>
        </Section>

        <Section title="Server logs">
          <p>
            Our servers write operational logs: the time of a request, which audit id it belonged
            to, the host that was audited, the resulting status and how long it took. These are for
            diagnosing faults and spotting abuse.
          </p>
          <p>
            Logs never contain cookies, authorisation headers, tokens or page content. Our hosting
            provider keeps its own infrastructure logs under its own policy.
          </p>
        </Section>

        <Section title="Auditing a page that is not yours">
          <p>
            This tool analyses publicly reachable pages, which anyone with a browser can already
            view. It makes a small number of ordinary GET requests and never submits a form,
            attempts to log in, or tries to reach anything behind authentication.
          </p>
          <p>
            If you own a site and would rather we did not fetch it, the{" "}
            <Link href="/about#bot" className="text-info-ink underline-offset-4 hover:underline">
              information for site owners
            </Link>{" "}
            explains how to block our crawler in robots.txt.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Because we do not collect personal data, there is normally nothing about you for us to
            provide or delete. If you believe a report contains information that should not be
            public, send us the report link and we will remove it.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If this policy changes, the date at the top of this page changes with it. Material
            changes will be described on this page rather than made quietly.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy can be sent through the{" "}
            <Link href="/contact" className="text-info-ink underline-offset-4 hover:underline">
              contact page
            </Link>
            .
          </p>
        </Section>
      </div>

      <p className="mt-10 border-t border-neutral-border pt-6 text-xs leading-relaxed text-ink-500">
        This policy describes how {siteConfig.name} operates. It is written to be read, not to be
        legally exhaustive, and it is not legal advice. If you are deploying your own copy of this
        software, review it against the law that applies to you.
      </p>
    </Container>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink-700 [&_li]:leading-relaxed [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
