/**
 * URL comparison helpers used by the SEO checks.
 *
 * These are about MEANING, not safety — the safety rules live in
 * lib/security/url-guard.ts. Here we answer questions like "is this link
 * internal?" and "do these two URLs point at the same page?".
 */

/**
 * Two-part public suffixes we recognise, so that `example.co.uk` is treated as
 * one site rather than two.
 *
 * LIMITATION, stated plainly: this is a short list, not the full Public Suffix
 * List. It covers the suffixes that show up most often. An unusual suffix may
 * cause a subdomain link to be counted as external. We prefer a small, legible
 * list here to shipping a multi-megabyte dependency for a link-counting
 * heuristic.
 */
const TWO_PART_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "gov.uk",
  "ac.uk",
  "me.uk",
  "net.uk",
  "co.jp",
  "or.jp",
  "ne.jp",
  "ac.jp",
  "co.kr",
  "co.nz",
  "org.nz",
  "govt.nz",
  "co.za",
  "org.za",
  "com.au",
  "net.au",
  "org.au",
  "edu.au",
  "gov.au",
  "com.br",
  "com.mx",
  "com.ar",
  "com.tr",
  "com.cn",
  "com.tw",
  "com.hk",
  "com.sg",
  "com.my",
  "com.ph",
  "co.in",
  "net.in",
  "org.in",
  "gov.in",
  "co.id",
  "co.il",
  "com.es",
  "com.pl",
  "com.ua",
  "com.vn",
  "com.pk",
  "com.sa",
  "com.eg",
  "com.ng",
  "com.co",
  "com.pe",
  "com.ec",
  "com.uy",
]);

/** Strip a leading "www." so www and non-www count as the same site. */
export function stripWww(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

/**
 * Best-effort registrable domain ("example.co.uk" from "blog.example.co.uk").
 * See the LIMITATION note on TWO_PART_SUFFIXES above.
 */
export function registrableDomain(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const labels = host.split(".");
  if (labels.length <= 2) return host;

  const lastTwo = labels.slice(-2).join(".");
  if (TWO_PART_SUFFIXES.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }
  return lastTwo;
}

/** True when both URLs belong to the same site (subdomains included). */
export function isSameSite(a: URL, b: URL): boolean {
  return registrableDomain(a.hostname) === registrableDomain(b.hostname);
}

/** True when scheme, host and port all match. */
export function isSameOrigin(a: URL, b: URL): boolean {
  return a.origin === b.origin;
}

/**
 * Reduce a URL to a comparable form so that trivially different spellings of
 * the same address compare equal.
 *
 * We normalise: scheme case, host case, a leading "www.", the default port,
 * the fragment, and a trailing slash on the path.
 * We deliberately KEEP the query string — `?id=12` is usually a different page.
 */
export function canonicalKey(input: string | URL): string | null {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : new URL(input.href);
  } catch {
    return null;
  }

  const host = stripWww(url.hostname);
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";
  const query = url.search;
  return `${host}${path}${query}`;
}

/** Do these two URLs point at the same page, ignoring cosmetic differences? */
export function isSamePage(a: string | URL, b: string | URL): boolean {
  const keyA = canonicalKey(a);
  const keyB = canonicalKey(b);
  return keyA !== null && keyA === keyB;
}

/** Resolve a possibly relative href against a base. Returns null if unusable. */
export function resolveHref(href: string, base: string | URL): URL | null {
  try {
    return new URL(href, base);
  } catch {
    return null;
  }
}

/** Shorten a URL for display without hiding which page it is. */
export function displayUrl(input: string, maxLength = 60): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return input.length > maxLength ? `${input.slice(0, maxLength - 1)}…` : input;
  }

  const text = `${url.host}${url.pathname === "/" ? "" : url.pathname}${url.search}`;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
