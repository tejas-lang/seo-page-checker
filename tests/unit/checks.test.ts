import { describe, expect, it } from "vitest";

import {
  titleCheck,
  metaDescriptionCheck,
  h1Check,
  headingStructureCheck,
  imageAltCheck,
} from "@/lib/seo/checks/on-page";
import {
  canonicalCheck,
  charsetCheck,
  httpStatusCheck,
  httpsCheck,
  languageCheck,
  redirectCheck,
  robotsMetaCheck,
  robotsTxtCheck,
  sitemapCheck,
  viewportCheck,
} from "@/lib/seo/checks/technical";
import { renderingCheck, wordCountCheck } from "@/lib/seo/checks/content";
import { internalLinksCheck, linkQualityCheck } from "@/lib/seo/checks/links";
import { jsonLdCheck } from "@/lib/seo/checks/structured-data";
import { openGraphCheck, twitterCardCheck } from "@/lib/seo/checks/social";
import { checkRegistry } from "@/lib/seo/registry";
import { buildContext, DEFAULT_URL, htmlDocument } from "./helpers";

describe("title check", () => {
  it("passes a reasonable title", () => {
    const result = titleCheck.run(buildContext(htmlDocument()));
    expect(result.status).toBe("PASS");
    expect(result.value).toBe("34 characters");
  });

  it("is critical when the title is missing", () => {
    const result = titleCheck.run(
      buildContext(`<html><head></head><body><h1>Hi</h1></body></html>`),
    );
    expect(result.status).toBe("ERROR");
    expect(result.severity).toBe("CRITICAL");
    expect(result.recommendation).toBeTruthy();
  });

  it("is critical when the title is empty", () => {
    const result = titleCheck.run(buildContext(`<html><head><title>  </title></head><body></body></html>`));
    expect(result.status).toBe("ERROR");
    expect(result.severity).toBe("CRITICAL");
  });

  it("warns about a very long title but does not call it an error", () => {
    const result = titleCheck.run(
      buildContext(`<html><head><title>${"A very descriptive title ".repeat(5)}</title></head><body></body></html>`),
    );
    expect(result.status).toBe("WARNING");
    expect(result.severity).toBe("MEDIUM");
  });

  it("warns about duplicate title elements", () => {
    const result = titleCheck.run(
      buildContext(`<html><head><title>One</title><title>Two</title></head><body></body></html>`),
    );
    expect(result.status).toBe("WARNING");
    expect(result.value).toContain("2 title tags");
  });

  it("reports length as a fact, separate from the advice", () => {
    const result = titleCheck.run(buildContext(htmlDocument()));
    expect(result.message).toContain("An example page about roll forming");
    expect(result.recommendation).toBeNull();
  });
});

describe("meta description check", () => {
  it("passes a description of a normal length", () => {
    expect(metaDescriptionCheck.run(buildContext(htmlDocument())).status).toBe("PASS");
  });

  it("warns when missing, but never calls it critical", () => {
    const result = metaDescriptionCheck.run(
      buildContext(`<html><head><title>T</title></head><body></body></html>`),
    );
    expect(result.status).toBe("WARNING");
    expect(result.severity).toBe("MEDIUM");
  });

  it("does not claim search engines always use it", () => {
    const result = metaDescriptionCheck.run(buildContext(htmlDocument()));
    expect(result.why.toLowerCase()).toContain("may");
  });
});

describe("h1 check", () => {
  it("passes a single H1", () => {
    const result = h1Check.run(buildContext(htmlDocument()));
    expect(result.status).toBe("PASS");
  });

  it("warns when there is no H1", () => {
    const result = h1Check.run(buildContext(htmlDocument({ body: "<p>No heading</p>" }).replace(/<h1>.*<\/h1>/, "")));
    expect(result.status).toBe("WARNING");
    expect(result.severity).toBe("HIGH");
  });

  it("treats multiple H1s as low severity, not a failure", () => {
    const result = h1Check.run(buildContext(htmlDocument({ body: "<h1>Another</h1>" })));
    expect(result.status).toBe("WARNING");
    expect(result.severity).toBe("LOW");
    expect(result.recommendation).toContain("not automatically a problem");
  });
});

describe("heading structure check", () => {
  it("flags empty headings", () => {
    const result = headingStructureCheck.run(buildContext(htmlDocument({ body: "<h2></h2>" })));
    expect(result.status).toBe("WARNING");
    expect(result.value).toContain("empty heading");
  });

  it("flags a skipped level", () => {
    const result = headingStructureCheck.run(
      buildContext(htmlDocument({ body: "<h2>Two</h2><h4>Four</h4>" })),
    );
    expect(result.status).toBe("WARNING");
    expect(result.message).toContain("H2 → H4");
  });

  it("passes a well-ordered outline", () => {
    const result = headingStructureCheck.run(
      buildContext(htmlDocument({ body: "<h2>Two</h2><h3>Three</h3><h2>Two again</h2>" })),
    );
    expect(result.status).toBe("PASS");
  });
});

describe("image alt check", () => {
  it("does not penalise an intentionally empty alt on a decorative image", () => {
    const result = imageAltCheck.run(
      buildContext(htmlDocument({ body: `<img src="/divider.png" alt="">` })),
    );
    expect(result.status).toBe("PASS");
    expect(result.message).toContain("correct for decorative images");
  });

  it("flags images with no alt attribute at all", () => {
    const result = imageAltCheck.run(
      buildContext(htmlDocument({ body: `<img src="/a.png"><img src="/b.png" alt="Described">` })),
    );
    expect(result.status).toBe("WARNING");
    expect(result.details?.missing).toBe(1);
  });

  it("raises severity when an image inside a link has no alt", () => {
    const linked = imageAltCheck.run(
      buildContext(htmlDocument({ body: `<a href="/x"><img src="/a.png"></a>` })),
    );
    expect(linked.severity).toBe("MEDIUM");
    expect(linked.message).toContain("inside a link");
  });

  it("is informational when a page has no images", () => {
    const result = imageAltCheck.run(buildContext(htmlDocument()));
    expect(result.status).toBe("INFO");
  });
});

describe("canonical check", () => {
  it("passes a self-referencing absolute canonical", () => {
    expect(canonicalCheck.run(buildContext(htmlDocument())).status).toBe("PASS");
  });

  it("warns when missing", () => {
    const result = canonicalCheck.run(
      buildContext(`<html><head><title>T</title></head><body></body></html>`),
    );
    expect(result.status).toBe("WARNING");
    expect(result.codeExample).toContain("rel=\"canonical\"");
  });

  it("treats multiple canonicals as a high-severity error", () => {
    const result = canonicalCheck.run(
      buildContext(
        `<html><head><link rel="canonical" href="https://example.com/a"><link rel="canonical" href="https://example.com/b"></head><body></body></html>`,
      ),
    );
    expect(result.status).toBe("ERROR");
    expect(result.severity).toBe("HIGH");
  });

  it("errors on an unparseable canonical", () => {
    const result = canonicalCheck.run(
      buildContext(`<html><head><link rel="canonical" href="ht!tp://%%%"></head><body></body></html>`),
    );
    expect(result.status).toBe("ERROR");
  });

  it("escalates a cross-site canonical above a same-site one", () => {
    const sameSite = canonicalCheck.run(
      buildContext(
        `<html><head><link rel="canonical" href="https://example.com/elsewhere"></head><body></body></html>`,
      ),
    );
    const crossSite = canonicalCheck.run(
      buildContext(
        `<html><head><link rel="canonical" href="https://someone-else.com/page"></head><body></body></html>`,
      ),
    );

    expect(sameSite.severity).toBe("MEDIUM");
    expect(crossSite.severity).toBe("HIGH");
  });

  it("accepts a relative canonical but suggests an absolute one", () => {
    const result = canonicalCheck.run(
      buildContext(`<html><head><link rel="canonical" href="/page"></head><body></body></html>`),
    );
    expect(result.status).toBe("WARNING");
    expect(result.severity).toBe("LOW");
  });
});

describe("robots directives check", () => {
  it("passes a page with no directives", () => {
    const result = robotsMetaCheck.run(buildContext(htmlDocument()));
    expect(result.status).toBe("PASS");
  });

  it("treats noindex as critical and words it carefully", () => {
    const result = robotsMetaCheck.run(
      buildContext(htmlDocument({ head: `<meta name="robots" content="noindex, follow">` })),
    );
    expect(result.status).toBe("ERROR");
    expect(result.severity).toBe("CRITICAL");
    expect(result.message).toContain("may be instructed not to index");
    // Must never assert what Google will actually do.
    expect(result.message).not.toContain("will not be indexed");
  });

  it("detects noindex delivered by the X-Robots-Tag header", () => {
    const result = robotsMetaCheck.run(
      buildContext(htmlDocument(), {
        fetchResult: { headers: { "x-robots-tag": "noindex" } },
      }),
    );
    expect(result.severity).toBe("CRITICAL");
  });

  it("treats 'none' as both noindex and nofollow", () => {
    const result = robotsMetaCheck.run(
      buildContext(htmlDocument({ head: `<meta name="robots" content="none">` })),
    );
    expect(result.details?.noindex).toBe(true);
    expect(result.details?.nofollow).toBe(true);
  });

  it("reports display directives as informational", () => {
    const result = robotsMetaCheck.run(
      buildContext(htmlDocument({ head: `<meta name="robots" content="max-snippet:-1, noarchive">` })),
    );
    expect(result.status).toBe("INFO");
  });
});

describe("http status and redirects", () => {
  it("passes a 200", () => {
    expect(httpStatusCheck.run(buildContext(htmlDocument())).status).toBe("PASS");
  });

  it("treats a 404 as critical", () => {
    const result = httpStatusCheck.run(
      buildContext(htmlDocument(), { fetchResult: { finalStatus: 404 } }),
    );
    expect(result.severity).toBe("CRITICAL");
  });

  it("explains a 403 as possible bot blocking", () => {
    const result = httpStatusCheck.run(
      buildContext(htmlDocument(), { fetchResult: { finalStatus: 403 } }),
    );
    expect(result.recommendation).toContain("automated requests");
  });

  it("does not penalise a plain HTTP-to-HTTPS upgrade", () => {
    const result = redirectCheck.run(
      buildContext(htmlDocument(), {
        url: "https://example.com/page",
        fetchResult: {
          requestedUrl: "http://example.com/page",
          redirects: [{ url: "http://example.com/page", status: 301, location: DEFAULT_URL }],
        },
      }),
    );
    expect(result.status).toBe("PASS");
    expect(result.message).toContain("HTTP to HTTPS");
  });

  it("warns about a long chain", () => {
    const result = redirectCheck.run(
      buildContext(htmlDocument(), {
        fetchResult: {
          redirects: [
            { url: "https://a.com/", status: 301, location: "https://b.com/" },
            { url: "https://b.com/", status: 301, location: "https://c.com/" },
            { url: "https://c.com/", status: 302, location: DEFAULT_URL },
          ],
        },
      }),
    );
    expect(result.status).toBe("WARNING");
    expect(result.value).toBe("3 redirects");
  });
});

describe("https check", () => {
  it("flags a page served over plain HTTP", () => {
    const result = httpsCheck.run(
      buildContext(htmlDocument(), { url: "http://example.com/page" }),
    );
    expect(result.status).toBe("ERROR");
    expect(result.severity).toBe("CRITICAL");
  });

  it("does not penalise an HTTP address that redirects to HTTPS", () => {
    const result = httpsCheck.run(
      buildContext(htmlDocument(), {
        url: DEFAULT_URL,
        fetchResult: { requestedUrl: "http://example.com/page" },
      }),
    );
    expect(result.status).toBe("PASS");
    expect(result.value).toBe("HTTPS (redirected)");
  });
});

describe("robots.txt check", () => {
  it("is UNAVAILABLE rather than a failure when it cannot be retrieved", () => {
    const result = robotsTxtCheck.run(
      buildContext(htmlDocument(), {
        robotsTxt: { retrieved: false, error: "Connection refused", pathVerdict: "unknown" },
      }),
    );
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.value).toBe("Unable to determine");
    expect(result.unavailableReason).toBeTruthy();
  });

  it("treats a missing robots.txt as valid, not a problem", () => {
    const result = robotsTxtCheck.run(
      buildContext(htmlDocument(), { robotsTxt: { status: 404, pathVerdict: "allowed" } }),
    );
    expect(result.status).toBe("PASS");
  });

  it("says 'potentially blocked' when the rules are too complex to be sure", () => {
    const result = robotsTxtCheck.run(
      buildContext(htmlDocument(), {
        robotsTxt: {
          pathVerdict: "unknown",
          matchedRule: "Disallow: /*?",
          hasComplexRules: true,
        },
      }),
    );
    expect(result.status).toBe("WARNING");
    expect(result.value).toBe("Potentially blocked");
    expect(result.confidence).toBe("inferred");
  });

  it("is critical when a path is definitely disallowed", () => {
    const result = robotsTxtCheck.run(
      buildContext(htmlDocument(), {
        robotsTxt: { pathVerdict: "disallowed", matchedRule: "Disallow: /page" },
      }),
    );
    expect(result.severity).toBe("CRITICAL");
  });
});

describe("sitemap check", () => {
  it("does not claim a sitemap is missing when none was found", () => {
    const result = sitemapCheck.run(
      buildContext(htmlDocument(), {
        sitemap: { retrieved: false, foundUrl: null, error: "HTTP 404" },
      }),
    );
    expect(result.status).toBe("WARNING");
    expect(result.severity).toBe("LOW");
    expect(result.recommendation).toContain("does not prove one is missing");
  });

  it("does not guess whether a page is in a sitemap index", () => {
    const result = sitemapCheck.run(
      buildContext(htmlDocument(), {
        sitemap: { kind: "sitemapindex", containsAuditedUrl: "unknown", urlCount: 4 },
      }),
    );
    expect(result.status).toBe("PASS");
    expect(result.recommendation).toContain("cannot confirm");
  });
});

describe("language, viewport, charset", () => {
  it("warns when lang is missing", () => {
    const result = languageCheck.run(
      buildContext(`<html><head><title>T</title></head><body></body></html>`),
    );
    expect(result.status).toBe("WARNING");
  });

  it("flags a lang value that is not a language tag", () => {
    const result = languageCheck.run(buildContext(htmlDocument({ lang: "English" })));
    expect(result.status).toBe("WARNING");
  });

  it("treats a missing viewport as high severity", () => {
    const result = viewportCheck.run(
      buildContext(`<html lang="en"><head><title>T</title></head><body></body></html>`),
    );
    expect(result.severity).toBe("HIGH");
  });

  it("flags a viewport that blocks zooming", () => {
    const result = viewportCheck.run(
      buildContext(
        `<html lang="en"><head><meta name="viewport" content="width=device-width, user-scalable=no"></head><body></body></html>`,
      ),
    );
    expect(result.value).toBe("Zoom disabled");
  });

  it("accepts a non-UTF-8 charset as informational, not an error", () => {
    const result = charsetCheck.run(
      buildContext(
        `<html lang="en"><head><meta charset="iso-8859-1"><title>T</title></head><body></body></html>`,
      ),
    );
    expect(result.status).toBe("INFO");
  });
});

describe("content checks", () => {
  it("does not prescribe a word count", () => {
    const result = wordCountCheck.run(
      buildContext(htmlDocument({ body: `<p>${"word ".repeat(500)}</p>` })),
    );
    expect(result.status).toBe("PASS");
    expect(result.recommendation).toBeNull();
    expect(result.why).toContain("no required length");
  });

  it("flags a page with almost no text", () => {
    const result = wordCountCheck.run(buildContext(`<html lang="en"><body><p>Hi</p></body></html>`));
    expect(result.status).toBe("WARNING");
    expect(result.severity).toBe("MEDIUM");
  });

  it("recognises the signature of client-side rendering", () => {
    const heavyMarkup = `<html lang="en"><head><title>App</title></head><body><div id="root"></div>${"<div class='x'></div>".repeat(1200)}</body></html>`;
    const result = renderingCheck.run(buildContext(heavyMarkup));

    expect(result.status).toBe("WARNING");
    expect(result.confidence).toBe("inferred");
    expect(result.recommendation).toContain("rendered in the browser");
  });
});

describe("link checks", () => {
  it("warns when a page has no internal links", () => {
    const result = internalLinksCheck.run(
      buildContext(htmlDocument({ body: `<a href="https://other.com/">Out</a>` })),
    );
    expect(result.status).toBe("WARNING");
  });

  it("flags non-descriptive link text", () => {
    const result = linkQualityCheck.run(
      buildContext(
        htmlDocument({ body: `<a href="/a">Click here</a><a href="/b">Read more</a>` }),
      ),
    );
    expect(result.status).toBe("WARNING");
    expect(result.details?.uninformativeAnchorText).toBe(2);
  });

  it("flags empty and javascript hrefs", () => {
    const result = linkQualityCheck.run(
      buildContext(
        htmlDocument({ body: `<a href="">Nothing</a><a href="javascript:void(0)">Script</a>` }),
      ),
    );
    expect(result.details?.empty).toBe(1);
    expect(result.details?.javascript).toBe(1);
  });

  it("never claims a link is broken", () => {
    const result = linkQualityCheck.run(buildContext(htmlDocument({ body: `<a href="/a">A page</a>` })));
    expect(result.message.toLowerCase()).not.toContain("broken");
  });
});

describe("structured data check", () => {
  it("reports absence as informational, not a failure", () => {
    const result = jsonLdCheck.run(buildContext(htmlDocument()));
    expect(result.status).toBe("INFO");
  });

  it("errors when every block is invalid JSON", () => {
    const result = jsonLdCheck.run(
      buildContext(htmlDocument({ head: `<script type="application/ld+json">{bad json}</script>` })),
    );
    expect(result.status).toBe("ERROR");
    expect(result.severity).toBe("HIGH");
  });

  it("lists the detected types when valid", () => {
    const result = jsonLdCheck.run(
      buildContext(
        htmlDocument({
          head: `<script type="application/ld+json">{"@type":"Article"}</script>`,
        }),
      ),
    );
    expect(result.status).toBe("PASS");
    expect(result.details?.types).toEqual(["Article"]);
  });

  it("does not claim structured data guarantees a rich result", () => {
    const result = jsonLdCheck.run(buildContext(htmlDocument()));
    expect(result.why).toContain("does not guarantee a rich result");
  });
});

describe("social checks", () => {
  it("flags completely missing Open Graph", () => {
    const result = openGraphCheck.run(buildContext(htmlDocument()));
    expect(result.status).toBe("WARNING");
    expect(result.severity).toBe("MEDIUM");
  });

  it("passes when the three that matter are present", () => {
    const result = openGraphCheck.run(
      buildContext(
        htmlDocument({
          head: `<meta property="og:title" content="T">
                 <meta property="og:description" content="D">
                 <meta property="og:image" content="https://example.com/i.jpg">`,
        }),
      ),
    );
    expect(result.status).toBe("PASS");
  });

  it("treats missing Twitter tags as informational when Open Graph exists", () => {
    const result = twitterCardCheck.run(
      buildContext(htmlDocument({ head: `<meta property="og:title" content="T">` })),
    );
    expect(result.status).toBe("INFO");
    expect(result.message).toContain("fall back");
  });
});

/* ------------------------------------------------------------------ */
/* Rules that must hold for EVERY check                                */
/* ------------------------------------------------------------------ */

describe("registry-wide invariants", () => {
  const context = buildContext(htmlDocument());
  const results = checkRegistry.map((check) => check.run(context));

  it("every check has a unique key", () => {
    const keys = results.map((result) => result.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every check returns a non-empty message", () => {
    for (const result of results) {
      expect(result.message.length, `${result.key} has an empty message`).toBeGreaterThan(0);
    }
  });

  it("every check explains why the element matters", () => {
    for (const result of results) {
      expect(result.why.length, `${result.key} has no 'why'`).toBeGreaterThan(20);
    }
  });

  it("a passing check never carries a severity that would deduct points", () => {
    for (const result of results) {
      if (result.status === "PASS" || result.status === "INFO") {
        expect(result.severity, `${result.key}`).toBe("INFO");
      }
    }
  });

  it("an UNAVAILABLE result always says why", () => {
    for (const result of results) {
      if (result.status === "UNAVAILABLE") {
        expect(result.unavailableReason, `${result.key}`).toBeTruthy();
      }
    }
  });

  it("no check promises a ranking improvement", () => {
    const forbidden = [
      "will improve your ranking",
      "improves your ranking",
      "will rank higher",
      "rank higher in",
      "boost your ranking",
      "will be indexed",
      "will get you",
      "guarantees",
      "guaranteed to",
      "100% optimized",
      "dominate",
    ];

    for (const result of results) {
      const text = `${result.message} ${result.recommendation ?? ""} ${result.why}`.toLowerCase();
      for (const phrase of forbidden) {
        expect(text, `${result.key} contains "${phrase}"`).not.toContain(phrase);
      }
    }
  });

  it("only ever uses the word 'guarantee' to deny one", () => {
    // "does not guarantee a rich result" is exactly the wording we want.
    // "guarantees a rich result" is exactly what must never appear. This test
    // separates the two rather than banning the word outright.
    const permittedNegations = [
      "does not guarantee",
      "do not guarantee",
      "cannot guarantee",
      "no guarantee",
      "not guarantee",
    ];

    for (const result of results) {
      const text = `${result.message} ${result.recommendation ?? ""} ${result.why}`.toLowerCase();
      let index = text.indexOf("guarantee");

      while (index !== -1) {
        const window = text.slice(Math.max(0, index - 20), index + 9);
        expect(
          permittedNegations.some((phrase) => window.includes(phrase)),
          `${result.key} uses "guarantee" without negating it: "…${window}…"`,
        ).toBe(true);
        index = text.indexOf("guarantee", index + 1);
      }
    }
  });

  it("weights are positive numbers", () => {
    for (const check of checkRegistry) {
      expect(check.weight, check.key).toBeGreaterThan(0);
    }
  });
});
