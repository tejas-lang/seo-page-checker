import type { Metadata } from "next";
import Link from "next/link";

import { Alert, Card, Container, SectionLabel } from "@/components/ui";
import { ContactForm } from "@/components/site/contact-form";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with ${siteConfig.name} about a bug, a check that looks wrong, or a question about a report.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const email = siteConfig.contactEmail;
  const formConfigured = Boolean(process.env.CONTACT_WEBHOOK_URL);

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <SectionLabel>Contact</SectionLabel>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Get in touch</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-ink-600">
        Found a check that reports something wrong? Disagree with a recommendation? Both are worth
        telling us about — a check that gives bad advice is a bug.
      </p>

      {/* Only claim the form works when it is actually wired to something. */}
      {!formConfigured ? (
        <Alert tone="warning" className="mt-8" title="This form is not connected yet">
          <p className="mt-1 leading-relaxed">
            {email ? (
              <>
                Messages sent from here will not reach anyone until a delivery endpoint is
                configured. Please email{" "}
                <a href={`mailto:${email}`} className="font-medium underline">
                  {email}
                </a>{" "}
                instead.
              </>
            ) : (
              <>
                No contact address or delivery endpoint has been configured for this deployment. If
                you run this site, set <code className="font-mono">CONTACT_WEBHOOK_URL</code> and{" "}
                <code className="font-mono">NEXT_PUBLIC_CONTACT_EMAIL</code> in your environment.
              </>
            )}
          </p>
        </Alert>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_260px] lg:items-start">
        <Card className="px-5 py-6">
          <ContactForm fallbackEmail={email} />
        </Card>

        <aside className="space-y-6">
          {email ? (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
                Email
              </h2>
              <a
                href={`mailto:${email}`}
                className="mt-2 block break-words text-sm text-info-ink underline-offset-4 hover:underline"
              >
                {email}
              </a>
            </div>
          ) : null}

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
              Before you write
            </h2>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-ink-600">
              <li>
                <Link href="/how-it-works" className="text-info-ink underline-offset-4 hover:underline">
                  How it works
                </Link>{" "}
                covers the scoring rules and what the tool cannot measure.
              </li>
              <li>
                <Link href="/seo-guides" className="text-info-ink underline-offset-4 hover:underline">
                  The guides
                </Link>{" "}
                explain each check in detail.
              </li>
              <li>
                If a page failed to audit, including the report link helps enormously.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
              Site owners
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              To block our crawler, see the{" "}
              <Link href="/about#bot" className="text-info-ink underline-offset-4 hover:underline">
                information for site owners
              </Link>
              .
            </p>
          </div>
        </aside>
      </div>

      <p className="mt-10 border-t border-neutral-border pt-6 text-xs leading-relaxed text-ink-500">
        What happens to the details you send is covered in the{" "}
        <Link href="/privacy" className="underline-offset-4 hover:underline">
          privacy policy
        </Link>
        .
      </p>
    </Container>
  );
}
