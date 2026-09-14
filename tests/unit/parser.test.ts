import { describe, expect, it } from "vitest";

import { collectJsonLdTypes, parseHtml } from "@/lib/seo/parser";
import { DEFAULT_URL, htmlDocument } from "./helpers";

describe("parseHtml — head elements", () => {
  it("extracts the title, ignoring a title inside SVG", () => {
    const page = parseHtml(
      htmlDocument({ body: "<svg><title>An icon label</title></svg>" }),
      DEFAULT_URL,
    );
    expect(page.titles).toEqual(["An example page about roll forming"]);
  });

  it("records every title when there is more than one", () => {
    const page = parseHtml(
      `<html><head><title>First</title><title>Second</title></head><body></body></html>`,
      DEFAULT_URL,
    );
    expect(page.titles).toEqual(["First", "Second"]);
  });

  it("collapses whitespace inside the title", () => {
    const page = parseHtml(
      `<html><head><title>  Spread   over
      lines  </title></head><body></body></html>`,
      DEFAULT_URL,
    );
    expect(page.titles[0]).toBe("Spread over lines");
  });

  it("reads the meta description", () => {
    const page = parseHtml(htmlDocument(), DEFAULT_URL);
    expect(page.metaDescriptions).toHaveLength(1);
    expect(page.metaDescriptions[0]).toContain("A description of the page");
  });

  it("matches meta names case-insensitively", () => {
    const page = parseHtml(
      `<html><head><meta name="Robots" content="NOINDEX"><meta name="VIEWPORT" content="width=device-width"></head><body></body></html>`,
      DEFAULT_URL,
    );
    expect(page.metaRobots).toBe("NOINDEX");
    expect(page.viewport).toBe("width=device-width");
  });

  it("reads canonical links, including from a multi-value rel", () => {
    const page = parseHtml(
      `<html><head><link rel="canonical shortlink" href="https://example.com/real"></head><body></body></html>`,
      DEFAULT_URL,
    );
    expect(page.canonicals).toEqual(["https://example.com/real"]);
  });

  it("reads the html lang attribute", () => {
    expect(parseHtml(htmlDocument({ lang: "en-GB" }), DEFAULT_URL).htmlLang).toBe("en-GB");
  });

  it("reads charset from either form of declaration", () => {
    expect(parseHtml(htmlDocument(), DEFAULT_URL).charset).toBe("utf-8");

    const legacy = parseHtml(
      `<html><head><meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1"></head><body></body></html>`,
      DEFAULT_URL,
    );
    expect(legacy.charset).toBe("ISO-8859-1");
  });

  it("detects a doctype", () => {
    expect(parseHtml(htmlDocument(), DEFAULT_URL).hasDoctype).toBe(true);
    expect(parseHtml("<html><body></body></html>", DEFAULT_URL).hasDoctype).toBe(false);
  });
});

describe("parseHtml — headings", () => {
  it("records level, text and emptiness in document order", () => {
    const page = parseHtml(
      htmlDocument({ body: "<h2>Second</h2><h3></h3><h2>Another</h2>" }),
      DEFAULT_URL,
    );

    expect(page.headings.map((heading) => heading.level)).toEqual([1, 2, 3, 2]);
    expect(page.headings[2]).toMatchObject({ level: 3, text: "", isEmpty: true });
  });
});

describe("parseHtml — images", () => {
  it("distinguishes a missing alt from an empty one", () => {
    const page = parseHtml(
      htmlDocument({
        body: `<img src="/a.png" alt="Described">
               <img src="/b.png" alt="">
               <img src="/c.png">`,
      }),
      DEFAULT_URL,
    );

    expect(page.images).toHaveLength(3);
    expect(page.images[0]).toMatchObject({ hasAltAttribute: true, alt: "Described" });
    expect(page.images[1]).toMatchObject({ hasAltAttribute: true, alt: "" });
    expect(page.images[2]).toMatchObject({ hasAltAttribute: false, alt: null });
  });

  it("notes when an image is inside a link", () => {
    const page = parseHtml(
      htmlDocument({ body: `<a href="/x"><img src="/a.png"></a><img src="/b.png">` }),
      DEFAULT_URL,
    );
    expect(page.images[0]?.isLinked).toBe(true);
    expect(page.images[1]?.isLinked).toBe(false);
  });
});

describe("parseHtml — links", () => {
  const page = parseHtml(
    htmlDocument({
      body: `
        <a href="/about">Internal</a>
        <a href="https://example.com/other">Absolute internal</a>
        <a href="https://blog.example.com/post">Subdomain</a>
        <a href="https://other-site.com/">External</a>
        <a href="#section">Fragment</a>
        <a href="mailto:hi@example.com">Email</a>
        <a href="tel:+441234567890">Phone</a>
        <a href="javascript:void(0)">Script</a>
        <a href="">Empty</a>
        <a href="https://paid.com/" rel="sponsored nofollow">Sponsored</a>
      `,
    }),
    DEFAULT_URL,
  );

  it("classifies each link kind", () => {
    const kinds = page.links.map((link) => link.kind);
    expect(kinds).toEqual([
      "internal",
      "internal",
      "internal", // a subdomain of the same registrable domain
      "external",
      "fragment",
      "mailto",
      "tel",
      "javascript",
      "empty",
      "external",
    ]);
  });

  it("resolves relative hrefs against the page URL", () => {
    expect(page.links[0]?.resolved).toBe("https://example.com/about");
  });

  it("reads rel tokens", () => {
    const sponsored = page.links[9];
    expect(sponsored?.isSponsored).toBe(true);
    expect(sponsored?.isNofollow).toBe(true);
    expect(sponsored?.isUgc).toBe(false);
  });

  it("honours a base href, as a browser would", () => {
    const withBase = parseHtml(
      `<html><head><base href="https://cdn.example.com/v2/"></head><body><a href="page">Link</a></body></html>`,
      DEFAULT_URL,
    );
    expect(withBase.links[0]?.resolved).toBe("https://cdn.example.com/v2/page");
  });

  it("falls back to image alt text for the accessible name of an image link", () => {
    const imageLink = parseHtml(
      htmlDocument({ body: `<a href="/x"><img src="/a.png" alt="Read the guide"></a>` }),
      DEFAULT_URL,
    );
    expect(imageLink.links[0]?.anchorText).toBe("Read the guide");
  });
});

describe("parseHtml — social metadata", () => {
  it("reads Open Graph from property and Twitter from name", () => {
    const page = parseHtml(
      htmlDocument({
        head: `<meta property="og:title" content="OG title">
               <meta property="og:image" content="https://example.com/i.jpg">
               <meta name="twitter:card" content="summary_large_image">`,
      }),
      DEFAULT_URL,
    );

    expect(page.openGraph["og:title"]).toBe("OG title");
    expect(page.twitter["twitter:card"]).toBe("summary_large_image");
  });

  it("also accepts the attributes the other way round, as CMSs emit them", () => {
    const page = parseHtml(
      htmlDocument({
        head: `<meta name="og:title" content="Via name">
               <meta property="twitter:card" content="summary">`,
      }),
      DEFAULT_URL,
    );

    expect(page.openGraph["og:title"]).toBe("Via name");
    expect(page.twitter["twitter:card"]).toBe("summary");
  });
});

describe("parseHtml — structured data", () => {
  it("parses valid JSON-LD and collects its types", () => {
    const page = parseHtml(
      htmlDocument({
        head: `<script type="application/ld+json">
          {"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"A"}}
        </script>`,
      }),
      DEFAULT_URL,
    );

    expect(page.jsonLd).toHaveLength(1);
    expect(page.jsonLd[0]?.valid).toBe(true);
    expect(page.jsonLd[0]?.types).toEqual(expect.arrayContaining(["Article", "Person"]));
  });

  it("records malformed JSON-LD without throwing", () => {
    const page = parseHtml(
      htmlDocument({
        head: `<script type="application/ld+json">{"@type":"Article",}</script>`,
      }),
      DEFAULT_URL,
    );

    expect(page.jsonLd[0]?.valid).toBe(false);
    expect(page.jsonLd[0]?.error).toBeTruthy();
  });

  it("walks an @graph", () => {
    const types = collectJsonLdTypes({
      "@graph": [{ "@type": "WebSite" }, { "@type": ["Organization", "LocalBusiness"] }],
    });
    expect([...types]).toEqual(["WebSite", "Organization", "LocalBusiness"]);
  });

  it("detects microdata and RDFa", () => {
    const page = parseHtml(
      htmlDocument({
        body: `<div itemscope itemtype="https://schema.org/Product"></div>
               <div typeof="Person"></div>`,
      }),
      DEFAULT_URL,
    );

    expect(page.microdataTypes).toContain("Product");
    expect(page.rdfaTypes).toContain("Person");
  });
});

describe("parseHtml — text statistics", () => {
  it("counts visible words and ignores script and style content", () => {
    const page = parseHtml(
      htmlDocument({
        body: `<p>One two three four five.</p>
               <script>const hidden = "these words must not count at all";</script>
               <style>.x { content: "nor these"; }</style>`,
      }),
      DEFAULT_URL,
    );

    // "An example page" (the H1) plus the five words in the paragraph.
    expect(page.text.wordCount).toBe(8);
    expect(page.text.paragraphCount).toBe(1);
  });

  it("does not count stray punctuation as words", () => {
    const page = parseHtml(
      `<html><body><p>Hello • — world</p></body></html>`,
      DEFAULT_URL,
    );
    expect(page.text.wordCount).toBe(2);
  });

  it("produces a text-to-HTML ratio between 0 and 1", () => {
    const page = parseHtml(htmlDocument(), DEFAULT_URL);
    expect(page.text.textToHtmlRatio).toBeGreaterThan(0);
    expect(page.text.textToHtmlRatio).toBeLessThan(1);
  });
});

describe("parseHtml — robustness", () => {
  it("survives unclosed tags in the body", () => {
    const page = parseHtml(
      `<html><head><title>Fine</title></head><body><p>Text<div><h1>Heading<ul><li>Item`,
      DEFAULT_URL,
    );
    expect(page.titles).toEqual(["Fine"]);
    expect(page.headings.some((heading) => heading.level === 1)).toBe(true);
    expect(page.text.wordCount).toBeGreaterThan(0);
  });

  it("matches browser behaviour when a title is never closed", () => {
    // <title> holds raw text, so an unclosed one swallows the rest of the
    // document. This is what a browser does too — worth pinning down, because
    // it explains the alarming audit such a page produces.
    const page = parseHtml(
      `<html><head><title>Unclosed<body><p>Text<h1>Heading`,
      DEFAULT_URL,
    );
    expect(page.titles).toHaveLength(1);
    expect(page.titles[0]).toContain("Unclosed");
    expect(page.headings).toEqual([]);
  });

  it("survives an empty document", () => {
    const page = parseHtml("", DEFAULT_URL);
    expect(page.titles).toEqual([]);
    expect(page.text.wordCount).toBe(0);
    expect(page.links).toEqual([]);
  });

  it("does not throw on an unparseable base URL", () => {
    expect(() => parseHtml(htmlDocument(), "not a url")).not.toThrow();
  });
});
