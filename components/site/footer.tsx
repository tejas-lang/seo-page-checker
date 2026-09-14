import Link from "next/link";
import { Container } from "@/components/ui";
import { LogoMark } from "./logo";
import { footerNav, siteConfig } from "@/lib/config/site";
import { CHECK_COUNT } from "@/lib/seo/registry";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-neutral-border bg-surface no-print">
      <Container>
        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:pr-8">
            <div className="flex items-center gap-2.5">
              <LogoMark className="h-7 w-7" />
              <span className="text-[15px] font-semibold tracking-tight text-ink-950">
                {siteConfig.name}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-600">
              {CHECK_COUNT} technical and on-page SEO checks on any public webpage, with plain
              explanations of what each one means.
            </p>
          </div>

          <FooterColumn title="Product" links={footerNav.product} />
          <FooterColumn title="Company" links={footerNav.company} />
          <FooterColumn title="Legal" links={footerNav.legal} />
        </div>

        <div className="border-t border-neutral-border py-6">
          <p className="text-xs leading-relaxed text-ink-500">{siteConfig.disclaimer}</p>
          <p className="mt-3 text-xs text-ink-500">
            © {year} {siteConfig.name}.
          </p>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly { title: string; href: string }[];
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-ink-700 underline-offset-4 hover:text-ink-950 hover:underline"
            >
              {link.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
