import type { Metadata } from "next";
import Link from "next/link";

import { Alert, Container, SectionLabel } from "@/components/ui";
import { env } from "@/lib/config/env";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The terms for using SEO Page Checker, including the disclaimer that it provides automated analysis and does not guarantee search rankings.",
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "14 September 2026";

export default function TermsPage() {
  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <SectionLabel>Legal</SectionLabel>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Terms of service</h1>
      <p className="mt-2 text-sm text-ink-500">Last updated {LAST_UPDATED}</p>

      <Alert tone="warning" className="mt-8" title="Disclaimer">
        <p className="mt-1 leading-relaxed">{siteConfig.disclaimer}</p>
      </Alert>

      <div className="mt-10 space-y-8">
        <Section title="1. What this service is">
          <p>
            {siteConfig.name} performs an automated technical and on-page analysis of a single
            webpage and returns a report. It is provided free of charge and without any account.
          </p>
        </Section>

        <Section title="2. No guarantee of results">
          <p>
            The report describes what was found in a page&rsquo;s HTML and HTTP response at one
            moment in time. It does not guarantee, and cannot guarantee:
          </p>
          <ul>
            <li>that a page will be crawled, indexed or shown in any search engine;</li>
            <li>any position in search results, before or after acting on a recommendation;</li>
            <li>
              that a recommendation is correct for your particular site, business or audience.
            </li>
          </ul>
          <p>
            The score is this tool&rsquo;s own measurement against its own published checks. It is
            not produced or endorsed by Google or any other search engine, and it should not be
            presented to anyone as if it were.
          </p>
        </Section>

        <Section title="3. Acceptable use">
          <p>You agree not to:</p>
          <ul>
            <li>
              use the service to place load on a website you do not own or have permission to test;
            </li>
            <li>
              attempt to circumvent the rate limit of {env.RATE_LIMIT_MAX} audits per hour, or
              automate submissions at volume;
            </li>
            <li>
              submit URLs designed to make our server reach systems it should not — private
              addresses, internal services or cloud metadata endpoints. These are blocked, and
              attempting it repeatedly may result in access being withdrawn;
            </li>
            <li>attempt to disrupt, overload or reverse-engineer the service.</li>
          </ul>
        </Section>

        <Section title="4. URLs you submit">
          <p>
            You are responsible for the URLs you submit. By submitting one you confirm you believe
            it is publicly accessible and that analysing it does not breach anyone&rsquo;s rights
            or terms.
          </p>
          <p>
            What we store and for how long is set out in the{" "}
            <Link href="/privacy" className="text-info-ink underline-offset-4 hover:underline">
              privacy policy
            </Link>
            . In short: the report, for {env.AUDIT_RETENTION_DAYS} days, with no personal data
            attached.
          </p>
        </Section>

        <Section title="5. Availability">
          <p>
            The service is provided as-is and as-available. It may be unavailable, slow, or change
            without notice. Audits depend on third-party websites responding, and many sites block
            automated requests — a failed audit is often a decision made by the site being
            audited rather than a fault here.
          </p>
        </Section>

        <Section title="6. Liability">
          <p>
            To the extent permitted by law, {siteConfig.name} is not liable for any loss arising
            from use of this service or from decisions made on the basis of a report. Changes to
            your website are made at your own risk; test them as you would any other change.
          </p>
        </Section>

        <Section title="7. Changes to these terms">
          <p>
            These terms may change. The date at the top of this page shows when they last did.
            Continuing to use the service after a change means accepting the revised terms.
          </p>
        </Section>

        <Section title="8. Contact">
          <p>
            Questions about these terms can be sent through the{" "}
            <Link href="/contact" className="text-info-ink underline-offset-4 hover:underline">
              contact page
            </Link>
            .
          </p>
        </Section>
      </div>

      <p className="mt-10 border-t border-neutral-border pt-6 text-xs leading-relaxed text-ink-500">
        These terms are a plain-language starting point, not legal advice and not a substitute for
        it. If you are deploying your own copy of this software, have them reviewed against the law
        that applies to you.
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
