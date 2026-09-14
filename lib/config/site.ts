/**
 * Brand + site configuration.
 *
 * Everything that identifies the product lives here so the whole application
 * can be re-branded by editing ONE file. Nothing else should hardcode the
 * product name, domain, or contact address.
 */

export const siteConfig = {
  /** Product name shown in the header, titles, reports and documents. */
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "SEO Page Checker",

  /** Short tagline used under the logo and in metadata. */
  tagline: "Page-level SEO auditing you can actually act on",

  /** One-sentence description used as the default meta description. */
  description:
    "Analyze any public webpage for technical and on-page SEO issues. Get a transparent score, clear explanations, and prioritised fixes — free, no signup.",

  /** Canonical production URL. Overridden per environment. */
  url: (process.env.NEXT_PUBLIC_APP_URL || "https://yourdomain.com").replace(/\/$/, ""),

  /**
   * Support/contact address. Deliberately NOT a made-up address: if the env var
   * is unset the UI says so instead of printing a fake inbox.
   */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || null,

  /** Twitter/X handle for social cards. Optional. */
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE || null,

  /**
   * Legal / honesty disclaimer. Shown in the footer and on every report.
   * This wording matters: the tool must never imply ranking guarantees.
   */
  disclaimer:
    "SEO Page Checker provides automated analysis for informational purposes. It does not guarantee search engine rankings or indexing.",

  /** Shown next to every score so the number is never mistaken for Google's. */
  scoreDisclaimer:
    "This score is based on the checks performed by SEO Page Checker. It is not a Google ranking score.",
} as const;

export type SiteConfig = typeof siteConfig;

/** Primary navigation, shared by the header, footer and sitemap. */
export const mainNav = [
  { title: "SEO Checker", href: "/seo-checker" },
  { title: "How It Works", href: "/how-it-works" },
  { title: "SEO Guide", href: "/seo-guides" },
  { title: "About", href: "/about" },
] as const;

export const footerNav = {
  product: [
    { title: "SEO Checker", href: "/seo-checker" },
    { title: "How It Works", href: "/how-it-works" },
    { title: "SEO Guides", href: "/seo-guides" },
  ],
  company: [
    { title: "About", href: "/about" },
    { title: "Contact", href: "/contact" },
  ],
  legal: [
    { title: "Privacy Policy", href: "/privacy" },
    { title: "Terms", href: "/terms" },
  ],
} as const;
