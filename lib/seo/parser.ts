/**
 * HTML parsing.
 *
 * WHAT IT IS: turns a raw HTML string into a `PageData` object of plain facts.
 * Every SEO check reads from that object, so parsing happens exactly once.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: run JavaScript. We use Cheerio, an HTML
 * parser, not a browser. Nothing from the audited page is ever executed. That
 * is both a security decision (a hostile page cannot run code on our server)
 * and an honesty one — we report what is in the HTML as served, and the UI
 * says so.
 */

import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type {
  HeadingInfo,
  ImageInfo,
  JsonLdBlock,
  LinkInfo,
  LinkKind,
  PageData,
  TextStats,
} from "./types";
import { registrableDomain } from "@/lib/utils/url";

/** Elements whose text is never visible to a reader. */
const NON_VISIBLE_SELECTOR = "script, style, noscript, template, svg, iframe, head, object, embed";

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function attrOrNull($el: cheerio.Cheerio<never>, name: string): string | null {
  const value = $el.attr(name);
  return value === undefined ? null : value;
}

/**
 * Build a lookup of <meta> tags keyed by lowercased name/property.
 *
 * HTML attribute VALUES are case-sensitive to a CSS selector, but authors write
 * `name="Robots"` and `name="robots"` interchangeably and browsers treat them
 * the same. Normalising once here means every check gets the same leniency.
 */
function buildMetaMap($: CheerioAPI): { byName: Map<string, string>; byProperty: Map<string, string> } {
  const byName = new Map<string, string>();
  const byProperty = new Map<string, string>();

  $("meta").each((_, element) => {
    const $meta = $(element);
    const content = $meta.attr("content");
    if (content === undefined) return;

    const name = $meta.attr("name");
    const property = $meta.attr("property");
    const itemprop = $meta.attr("itemprop");

    // First declaration wins, which is how browsers behave.
    if (name && !byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), content);
    if (property && !byProperty.has(property.toLowerCase())) {
      byProperty.set(property.toLowerCase(), content);
    }
    if (itemprop && !byName.has(itemprop.toLowerCase())) {
      byName.set(itemprop.toLowerCase(), content);
    }
  });

  return { byName, byProperty };
}

/* ------------------------------------------------------------------ */
/* JSON-LD                                                             */
/* ------------------------------------------------------------------ */

/** Walk a parsed JSON-LD value and collect every `@type` it declares. */
export function collectJsonLdTypes(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdTypes(item, found);
    return found;
  }

  if (value === null || typeof value !== "object") return found;

  const record = value as Record<string, unknown>;
  const type = record["@type"];

  if (typeof type === "string") found.add(type);
  else if (Array.isArray(type)) {
    for (const entry of type) if (typeof entry === "string") found.add(entry);
  }

  for (const entry of Object.values(record)) {
    if (entry !== null && typeof entry === "object") collectJsonLdTypes(entry, found);
  }

  return found;
}

function parseJsonLdBlocks($: CheerioAPI): JsonLdBlock[] {
  const blocks: JsonLdBlock[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).text() ?? "";
    const trimmed = raw.trim();

    if (trimmed === "") {
      blocks.push({ valid: false, error: "The script tag is empty.", types: [], size: 0 });
      return;
    }

    // Guard against a pathologically large block before handing it to JSON.parse.
    if (trimmed.length > 2_000_000) {
      blocks.push({
        valid: false,
        error: "The block is too large to parse safely.",
        types: [],
        size: trimmed.length,
      });
      return;
    }

    try {
      const parsed: unknown = JSON.parse(trimmed);
      blocks.push({
        valid: true,
        error: null,
        types: [...collectJsonLdTypes(parsed)],
        size: trimmed.length,
      });
    } catch (error) {
      blocks.push({
        valid: false,
        error: error instanceof Error ? error.message : "The block is not valid JSON.",
        types: [],
        size: trimmed.length,
      });
    }
  });

  return blocks;
}

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */

function classifyLink(href: string, resolved: URL | null, base: URL): LinkKind {
  const trimmed = href.trim();

  if (trimmed === "") return "empty";
  if (trimmed.startsWith("#")) return "fragment";

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("mailto:")) return "mailto";
  if (lower.startsWith("tel:") || lower.startsWith("sms:") || lower.startsWith("callto:")) {
    return "tel";
  }
  if (lower.startsWith("javascript:")) return "javascript";

  if (resolved === null) return "other";
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return "other";

  return registrableDomain(resolved.hostname) === registrableDomain(base.hostname)
    ? "internal"
    : "external";
}

function extractLinks($: CheerioAPI, baseUrl: URL): LinkInfo[] {
  const links: LinkInfo[] = [];

  $("a[href]").each((_, element) => {
    const $link = $(element);
    const href = $link.attr("href") ?? "";

    let resolved: URL | null = null;
    try {
      if (href.trim() !== "" && !href.trim().startsWith("#")) {
        resolved = new URL(href, baseUrl);
      }
    } catch {
      resolved = null;
    }

    const relAttr = $link.attr("rel") ?? "";
    const rel = relAttr
      .split(/\s+/)
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);

    let anchorText = collapseWhitespace($link.text());
    if (anchorText === "") {
      // An image-only link takes its accessible name from the image's alt text.
      const imageAlt = $link.find("img[alt]").first().attr("alt");
      if (imageAlt) anchorText = collapseWhitespace(imageAlt);
    }

    links.push({
      href,
      resolved: resolved?.href ?? null,
      kind: classifyLink(href, resolved, baseUrl),
      anchorText,
      rel,
      isNofollow: rel.includes("nofollow"),
      isSponsored: rel.includes("sponsored"),
      isUgc: rel.includes("ugc"),
      target: $link.attr("target") ?? null,
    });
  });

  return links;
}

/* ------------------------------------------------------------------ */
/* Text statistics                                                     */
/* ------------------------------------------------------------------ */

function extractText($: CheerioAPI, htmlLength: number): TextStats {
  // Work on a clone so removing elements does not disturb the other extractors.
  const $clone = cheerio.load($.html());
  $clone(NON_VISIBLE_SELECTOR).remove();

  const raw = $clone("body").text() || $clone.root().text();
  const text = collapseWhitespace(raw);

  // A "word" must contain at least one letter or digit, so stray punctuation
  // and bullet characters are not counted as content.
  const words = text.split(" ").filter((token) => /[\p{L}\p{N}]/u.test(token));

  const paragraphCount = $clone("p").filter((_, element) => {
    return collapseWhitespace($clone(element).text()).length > 0;
  }).length;

  return {
    wordCount: words.length,
    characterCount: text.length,
    paragraphCount,
    textToHtmlRatio: htmlLength > 0 ? text.length / htmlLength : 0,
    excerpt: text.slice(0, 300),
  };
}

/* ------------------------------------------------------------------ */
/* The parser                                                          */
/* ------------------------------------------------------------------ */

/**
 * Parse an HTML document into the facts the checks need.
 *
 * @param html    the raw HTML exactly as served
 * @param baseUrl the URL the HTML was served from, used to resolve relative
 *                links. A <base href> in the document overrides it, because
 *                that is what a browser would do.
 */
export function parseHtml(html: string, baseUrl: string): PageData {
  const $ = cheerio.load(html);

  let resolvedBase: URL;
  try {
    resolvedBase = new URL(baseUrl);
  } catch {
    resolvedBase = new URL("https://example.invalid/");
  }

  const baseHref = $("base[href]").first().attr("href");
  if (baseHref) {
    try {
      resolvedBase = new URL(baseHref, resolvedBase);
    } catch {
      // A malformed <base> is ignored, exactly as browsers do.
    }
  }

  const { byName, byProperty } = buildMetaMap($);

  /* -- titles -------------------------------------------------------- */
  const titles: string[] = [];
  $("title").each((_, element) => {
    // <title> also exists inside SVG, where it is a tooltip, not a page title.
    if ($(element).parents("svg").length > 0) return;
    titles.push(collapseWhitespace($(element).text()));
  });

  /* -- meta descriptions --------------------------------------------- */
  const metaDescriptions: string[] = [];
  $("meta").each((_, element) => {
    const name = $(element).attr("name");
    if (name && name.toLowerCase() === "description") {
      metaDescriptions.push($(element).attr("content") ?? "");
    }
  });

  /* -- canonical ------------------------------------------------------ */
  const canonicals: string[] = [];
  $("link[rel]").each((_, element) => {
    const rel = ($(element).attr("rel") ?? "").toLowerCase().split(/\s+/);
    if (rel.includes("canonical")) {
      const href = $(element).attr("href");
      if (href !== undefined) canonicals.push(href.trim());
    }
  });

  /* -- favicons ------------------------------------------------------- */
  const favicons: { rel: string; href: string }[] = [];
  $("link[rel]").each((_, element) => {
    const relValue = ($(element).attr("rel") ?? "").toLowerCase();
    const tokens = relValue.split(/\s+/);
    const isIcon =
      tokens.includes("icon") ||
      tokens.includes("shortcut") ||
      relValue.includes("apple-touch-icon") ||
      relValue.includes("mask-icon");
    if (!isIcon) return;
    const href = $(element).attr("href");
    if (href) favicons.push({ rel: relValue, href: href.trim() });
  });

  /* -- hreflang ------------------------------------------------------- */
  const hreflang: { lang: string; href: string }[] = [];
  $("link[rel][hreflang]").each((_, element) => {
    const rel = ($(element).attr("rel") ?? "").toLowerCase().split(/\s+/);
    if (!rel.includes("alternate")) return;
    const lang = $(element).attr("hreflang");
    const href = $(element).attr("href");
    if (lang && href) hreflang.push({ lang, href });
  });

  /* -- headings ------------------------------------------------------- */
  const headings: HeadingInfo[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, element) => {
    const tagName = (element as unknown as { tagName?: string }).tagName ?? "h1";
    const level = Number(tagName.replace(/[^1-6]/g, "")) as HeadingInfo["level"];
    const text = collapseWhitespace($(element).text());
    headings.push({ level, text, isEmpty: text === "" });
  });

  /* -- images --------------------------------------------------------- */
  const images: ImageInfo[] = [];
  $("img").each((_, element) => {
    const $image = $(element) as unknown as cheerio.Cheerio<never>;
    const alt = $image.attr("alt");
    images.push({
      src: attrOrNull($image, "src") ?? attrOrNull($image, "data-src"),
      alt: alt === undefined ? null : alt,
      hasAltAttribute: alt !== undefined,
      width: attrOrNull($image, "width"),
      height: attrOrNull($image, "height"),
      loading: attrOrNull($image, "loading"),
      isLinked: $(element).parents("a").length > 0,
    });
  });

  /* -- open graph and twitter ----------------------------------------- */
  const openGraph: Record<string, string> = {};
  const twitter: Record<string, string> = {};

  for (const [key, value] of byProperty) {
    if (key.startsWith("og:") || key.startsWith("article:") || key.startsWith("product:")) {
      openGraph[key] = value;
    }
    // Some CMSs emit twitter tags with `property` instead of `name`.
    if (key.startsWith("twitter:")) twitter[key] = value;
  }
  for (const [key, value] of byName) {
    if (key.startsWith("twitter:")) twitter[key] = value;
    // ...and some emit og tags with `name` instead of `property`.
    if (key.startsWith("og:") && !(key in openGraph)) openGraph[key] = value;
  }

  /* -- structured data ------------------------------------------------ */
  const microdataTypes = [
    ...new Set(
      $("[itemtype]")
        .map((_, element) => {
          const value = $(element).attr("itemtype") ?? "";
          return value.split("/").filter(Boolean).pop() ?? "";
        })
        .get()
        .filter(Boolean),
    ),
  ];

  const rdfaTypes = [
    ...new Set(
      $("[typeof]")
        .map((_, element) => ($(element).attr("typeof") ?? "").trim())
        .get()
        .filter(Boolean),
    ),
  ];

  /* -- charset -------------------------------------------------------- */
  let charset = $("meta[charset]").first().attr("charset") ?? null;
  if (!charset) {
    const contentType = byName.get("content-type") ?? "";
    const match = contentType.match(/charset=([a-z0-9_:.-]+)/i);
    charset = match?.[1] ?? null;
  }
  if (!charset) {
    const httpEquiv = $('meta[http-equiv]').filter((_, element) => {
      return ($(element).attr("http-equiv") ?? "").toLowerCase() === "content-type";
    });
    const content = httpEquiv.first().attr("content") ?? "";
    const match = content.match(/charset=([a-z0-9_:.-]+)/i);
    charset = match?.[1] ?? null;
  }

  /* -- meta refresh --------------------------------------------------- */
  let metaRefresh: string | null = null;
  $("meta[http-equiv]").each((_, element) => {
    if (($(element).attr("http-equiv") ?? "").toLowerCase() === "refresh") {
      metaRefresh = $(element).attr("content") ?? null;
    }
  });

  return {
    titles,
    metaDescriptions,
    metaRobots: byName.get("robots") ?? null,
    metaGooglebot: byName.get("googlebot") ?? null,
    canonicals,
    htmlLang: $("html").attr("lang")?.trim() || null,
    charset: charset ? charset.trim() : null,
    viewport: byName.get("viewport") ?? null,
    favicons,
    headings,
    images,
    links: extractLinks($, resolvedBase),
    openGraph,
    twitter,
    jsonLd: parseJsonLdBlocks($),
    microdataTypes,
    rdfaTypes,
    hreflang,
    text: extractText($, html.length),
    htmlBytes: Buffer.byteLength(html, "utf8"),
    hasDoctype: /^\s*<!doctype\s+html/i.test(html),
    metaRefresh,
  };
}
