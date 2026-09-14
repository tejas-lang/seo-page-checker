import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { siteConfig } from "@/lib/config/site";

/**
 * The wordmark.
 *
 * The glyph is a magnifier whose lens holds two measurement bars — inspection
 * plus measurement, which is what the product does. Drawn inline as SVG so it
 * is crisp at any size, needs no network request, and inherits the text colour.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
    >
      <rect width="32" height="32" rx="8" className="fill-ink-950" />
      <circle cx="14.5" cy="14.5" r="7" className="stroke-white" strokeWidth="2" />
      <path
        d="M19.8 19.8 24 24"
        className="stroke-white"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M12 17v-3.2M15 17v-6M18 17v-4.4"
        className="stroke-white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  showTagline = false,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label={`${siteConfig.name} home`}
    >
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-ink-950">
          {siteConfig.name}
        </span>
        {showTagline ? (
          <span className="mt-1 text-xs text-ink-500">{siteConfig.tagline}</span>
        ) : null}
      </span>
    </Link>
  );
}
