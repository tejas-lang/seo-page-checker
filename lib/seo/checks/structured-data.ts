/**
 * Structured data checks.
 *
 * SCOPE, stated honestly in the UI as well: this is BASIC STRUCTURED DATA
 * DETECTION. We confirm that JSON-LD exists, that it parses as valid JSON, and
 * which @type values it declares. We do NOT validate Schema.org properties and
 * we are NOT a rich-results test — doing that properly means implementing
 * Google's eligibility rules, which change and are not published in full.
 * Claiming otherwise would be exactly the kind of false confidence this tool
 * is built to avoid.
 */

import { createCheck, plural } from "./create-check";

/** Types that commonly power a richer search result when a page qualifies. */
const NOTABLE_TYPES = new Set([
  "Article",
  "NewsArticle",
  "BlogPosting",
  "Product",
  "Offer",
  "Organization",
  "LocalBusiness",
  "BreadcrumbList",
  "FAQPage",
  "HowTo",
  "Recipe",
  "Event",
  "Person",
  "WebSite",
  "WebPage",
  "VideoObject",
  "Review",
  "AggregateRating",
  "SoftwareApplication",
  "JobPosting",
  "Course",
]);

export const jsonLdCheck = createCheck(
  {
    key: "json-ld",
    title: "JSON-LD structured data",
    category: "structured-data",
    weight: 7,
    guide: "schema-markup",
    why: "Structured data is a machine-readable description of what a page contains — that this is a recipe, this is its cooking time, this is its rating. Search engines use it to understand the page and, when a page qualifies, to display a richer result. It does not guarantee a rich result, and it is not a ranking factor in itself.",
  },
  ({ page }) => {
    const blocks = page.jsonLd;

    if (blocks.length === 0) {
      const hasOther = page.microdataTypes.length > 0 || page.rdfaTypes.length > 0;

      return {
        status: "INFO",
        severity: "INFO",
        value: "None found",
        message: hasOther
          ? "No JSON-LD was found, though other structured data formats are present on this page."
          : "No JSON-LD structured data was found on this page.",
        recommendation:
          "Structured data is optional. It is most worth adding when the page is a type search engines display specially — an article, a product, a recipe, an event, a local business or a FAQ.",
        codeExample: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your page headline",
  "datePublished": "2026-01-15"
}
</script>`,
        details: { blocks: 0, types: [] },
      };
    }

    const invalid = blocks.filter((block) => !block.valid);
    const types = [...new Set(blocks.flatMap((block) => block.types))];

    if (invalid.length === blocks.length) {
      return {
        status: "ERROR",
        severity: "HIGH",
        value: `${plural(invalid.length, "block")} invalid`,
        message: `This page has ${plural(blocks.length, "JSON-LD block")}, and ${blocks.length === 1 ? "it does" : "none of them"} not contain valid JSON. First error: ${invalid[0]?.error ?? "unknown parse error"}.`,
        recommendation:
          "Fix the JSON syntax. The usual causes are a trailing comma, an unescaped quote inside a value, or template code that ran without a value to insert. Invalid JSON-LD is ignored entirely.",
        details: { blocks: blocks.length, invalid: invalid.length, errors: invalid.map((b) => b.error) },
      };
    }

    if (invalid.length > 0) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: `${plural(invalid.length, "block")} invalid`,
        message: `${invalid.length} of the ${blocks.length} JSON-LD blocks on this page ${invalid.length === 1 ? "contains" : "contain"} invalid JSON. The valid blocks declare: ${types.join(", ") || "no types"}.`,
        recommendation:
          "Fix the syntax in the broken block. Search engines ignore a block they cannot parse, so anything described in it is lost.",
        details: {
          blocks: blocks.length,
          invalid: invalid.length,
          types,
          errors: invalid.map((block) => block.error),
        },
      };
    }

    if (types.length === 0) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: "No @type",
        message: `This page has ${plural(blocks.length, "valid JSON-LD block")}, but no @type is declared in ${blocks.length === 1 ? "it" : "them"}.`,
        recommendation:
          "Add an @type so the markup states what the thing is. Without it, the data has no meaning a search engine can act on.",
        details: { blocks: blocks.length, types: [] },
      };
    }

    const notable = types.filter((type) => NOTABLE_TYPES.has(type));

    return {
      status: "PASS",
      value: types.slice(0, 3).join(", ") + (types.length > 3 ? ` +${types.length - 3}` : ""),
      message: `This page has ${plural(blocks.length, "valid JSON-LD block")} declaring: ${types.join(", ")}.`,
      recommendation:
        notable.length === 0
          ? "The types found are not ones that commonly produce a richer search result. That is not a problem — it depends entirely on what the page is."
          : null,
      details: { blocks: blocks.length, types, notable },
      confidence: "measured",
    };
  },
);

export const otherStructuredDataCheck = createCheck(
  {
    key: "microdata",
    title: "Microdata and RDFa",
    category: "structured-data",
    weight: 3,
    guide: "schema-markup",
    why: "Microdata and RDFa are older ways of marking up the same information as JSON-LD, written as attributes on the HTML elements themselves. Search engines still read them. JSON-LD is generally easier to maintain because it sits in one block rather than being woven through the markup.",
  },
  ({ page }) => {
    const microdata = page.microdataTypes;
    const rdfa = page.rdfaTypes;
    const total = microdata.length + rdfa.length;

    if (total === 0) {
      return {
        status: "INFO",
        severity: "INFO",
        value: "None found",
        message: "No microdata or RDFa markup was found on this page.",
        recommendation: null,
        details: { microdata: [], rdfa: [] },
      };
    }

    const parts: string[] = [];
    if (microdata.length > 0) parts.push(`microdata (${microdata.slice(0, 5).join(", ")})`);
    if (rdfa.length > 0) parts.push(`RDFa (${rdfa.slice(0, 5).join(", ")})`);

    return {
      status: "PASS",
      value: `${plural(total, "type")} found`,
      message: `This page uses ${parts.join(" and ")}.`,
      recommendation:
        page.jsonLd.length > 0
          ? "This page also has JSON-LD. Using both is allowed, but make sure they do not describe the same thing differently."
          : null,
      details: { microdata, rdfa },
    };
  },
);
