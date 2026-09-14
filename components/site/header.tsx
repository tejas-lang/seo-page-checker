"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { Logo } from "./logo";
import { Container, ButtonLink } from "@/components/ui";
import { mainNav } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";

/**
 * The site header.
 *
 * A client component only because of the mobile menu toggle. The navigation
 * itself is plain links, so it works before JavaScript loads and the menu
 * button is simply inert until it does.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Close the menu on navigation — otherwise it stays open over the new page.
  //
  // This adjusts state during render rather than in an effect. That is React's
  // documented pattern for "reset some state when a prop changes": it runs
  // before the browser paints, so the menu never flashes on the new page, and
  // it avoids the cascading re-render an effect would cause.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }

  // Let Escape close the menu, as a keyboard user expects.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-border bg-surface/85 backdrop-blur-sm no-print">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Logo />

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-ink-100 text-ink-950"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-950",
                )}
              >
                {item.title}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ButtonLink href="/seo-checker" size="sm" className="hidden sm:inline-flex">
              Check a URL
            </ButtonLink>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-700 hover:bg-ink-100 md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </Container>

      {menuOpen ? (
        <div id="mobile-menu" className="border-t border-neutral-border bg-surface md:hidden">
          <Container>
            <nav aria-label="Mobile" className="flex flex-col py-3">
              {mainNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-[15px] font-medium",
                    isActive(item.href)
                      ? "bg-ink-100 text-ink-950"
                      : "text-ink-700 hover:bg-ink-50",
                  )}
                >
                  {item.title}
                </Link>
              ))}
              <ButtonLink href="/seo-checker" size="md" className="mt-3">
                Check a URL
              </ButtonLink>
            </nav>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
