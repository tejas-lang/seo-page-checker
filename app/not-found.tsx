import type { Metadata } from "next";
import Link from "next/link";

import { AuditForm } from "@/components/audit/audit-form";
import { Container, ButtonLink } from "@/components/ui";
import { guides } from "@/content/guides";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <Container size="narrow" className="py-16 sm:py-24">
      <p className="font-mono text-sm font-medium text-ink-400">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Page not found</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-ink-600">
        This address does not exist here. If you followed a link to an audit report, it may have
        passed its retention period and been deleted — reports do not last forever.
      </p>

      <div className="mt-8">
        <h2 className="text-[15px] font-semibold">Run an SEO check</h2>
        <AuditForm className="mt-3" size="md" />
      </div>

      <div className="mt-12 border-t border-neutral-border pt-8">
        <h2 className="text-[15px] font-semibold">Or start somewhere useful</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {guides.slice(0, 4).map((guide) => (
            <li key={guide.slug}>
              <Link
                href={`/seo-guides/${guide.slug}`}
                className="text-info-ink underline-offset-4 hover:underline"
              >
                {guide.title}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/" variant="secondary" size="md">
            Home
          </ButtonLink>
          <ButtonLink href="/seo-guides" variant="ghost" size="md">
            All guides
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
