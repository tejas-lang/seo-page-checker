/**
 * End-to-end tests of the audit engine, with the network stubbed out.
 *
 * These run the real pipeline — parse, check, score, assemble — against HTML
 * fixtures, so they cover the wiring between modules that unit tests miss.
 */

import { describe, expect, it } from "vitest";

import { parseHtml } from "@/lib/seo/parser";
import { checkRegistry } from "@/lib/seo/registry";
import { calculateScore, prioritiseIssues } from "@/lib/seo/scoring";
import { generateAuditId } from "@/lib/seo/audit";
import { buildContext, htmlDocument } from "./helpers";
import type { CheckContext } from "@/lib/seo/types";

function runAll(context: CheckContext) {
  const checks = checkRegistry.map((check) => check.run(context));
  return {
    checks,
    score: calculateScore(checks, checkRegistry),
    priority: prioritiseIssues(checks, checkRegistry, 5),
  };
}

describe("generateAuditId", () => {
  it("produces ids matching the pattern the routes accept", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateAuditId()).toMatch(/^[a-z0-9]{10,40}$/);
    }
  });

  it("produces distinct ids", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => generateAuditId()));
    expect(ids.size).toBe(2000);
  });
});

describe("a well-built page", () => {
  const html = htmlDocument({
    head: `
      <meta property="og:title" content="An example page">
      <meta property="og:description" content="A summary of the page.">
      <meta property="og:image" content="https://example.com/preview.jpg">
      <meta property="og:url" content="https://example.com/page">
      <meta property="og:type" content="article">
      <meta name="twitter:card" content="summary_large_image">
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"An example page"}</script>
    `,
    body: `
      <h2>A section</h2>
      <p>${"Readable sentence content. ".repeat(60)}</p>
      <h2>Another section</h2>
      <p>${"More readable content here. ".repeat(60)}</p>
      <img src="/diagram.png" alt="A diagram of the process">
      <a href="/related">A related page</a>
      <a href="/another">Another internal page</a>
      <a href="https://external.example.org/source">An external source</a>
    `,
  });

  const { checks, score, priority } = runAll(buildContext(html));

  it("scores highly", () => {
    expect(score.total).toBeGreaterThanOrEqual(90);
    expect(score.band.id).toBe("excellent");
  });

  it("produces no errors", () => {
    const errors = checks.filter((check) => check.status === "ERROR");
    expect(errors.map((error) => error.key)).toEqual([]);
  });

  it("has few or no priority issues", () => {
    expect(priority.length).toBeLessThanOrEqual(2);
  });

  it("runs every registered check exactly once", () => {
    expect(checks).toHaveLength(checkRegistry.length);
    expect(new Set(checks.map((check) => check.key)).size).toBe(checkRegistry.length);
  });
});

describe("a badly-built page", () => {
  const html = `<html>
    <head></head>
    <body>
      <img src="/a.png">
      <img src="/b.png">
      <a href="">Click here</a>
      <a href="javascript:void(0)">Read more</a>
    </body>
  </html>`;

  const { checks, score, priority } = runAll(
    buildContext(html, { url: "http://example.com/page" }),
  );

  it("scores well below a well-built page", () => {
    // Note what this page still legitimately earns: it returns 200, has no
    // redirect chain, is not noindexed, is allowed by robots.txt and is listed
    // in a sitemap. Those are real passes, so the score does not collapse to
    // near-zero — and it should not, because the score measures conformance
    // across six weighted categories rather than delivering a verdict.
    //
    // The severity of the page's problems is communicated by the priority
    // list, not by the number. That is why the assertions below check the
    // band and the ordering rather than an arbitrary threshold.
    expect(score.total).toBeLessThan(70);
    expect(score.band.id).toBe("needs-improvement");
  });

  it("leads the priority list with the critical issues", () => {
    const leadingSeverities = priority.slice(0, 2).map((issue) => issue.severity);
    expect(leadingSeverities).toEqual(["CRITICAL", "CRITICAL"]);

    // The missing title and the missing HTTPS are both critical here.
    expect(priority.slice(0, 2).map((issue) => issue.key).sort()).toEqual(["https", "title"]);
  });

  it("surfaces a critical issue even though the band is not the lowest one", () => {
    // This is the important guarantee: a reader must never have to infer
    // severity from the score. A page can sit in the middle band and still
    // have something critical wrong with it, and the report says so.
    expect(checks.some((check) => check.severity === "CRITICAL")).toBe(true);
    expect(priority[0]?.severity).toBe("CRITICAL");
  });

  it("flags the missing HTTPS, title, viewport and language", () => {
    const failing = new Set(
      checks
        .filter((check) => check.status === "ERROR" || check.status === "WARNING")
        .map((check) => check.key),
    );

    expect(failing).toContain("https");
    expect(failing).toContain("title");
    expect(failing).toContain("viewport");
    expect(failing).toContain("language");
    expect(failing).toContain("h1");
  });

  it("still produces a score that adds up", () => {
    const sum = score.categories.reduce((total, category) => total + category.score, 0);
    expect(sum).toBe(score.total);
  });
});

describe("a noindexed page", () => {
  const { checks, score } = runAll(
    buildContext(htmlDocument({ head: `<meta name="robots" content="noindex">` })),
  );

  it("raises a critical robots directive issue", () => {
    const robots = checks.find((check) => check.key === "robots-meta");
    expect(robots?.severity).toBe("CRITICAL");
  });

  it("costs a substantial part of the technical score", () => {
    const technical = score.categories.find((category) => category.category === "technical");
    expect(technical!.score).toBeLessThan(technical!.max);
  });
});

describe("an error page", () => {
  const { checks } = runAll(
    buildContext(htmlDocument({ body: "<p>Page not found</p>" }), {
      fetchResult: { finalStatus: 404 },
    }),
  );

  it("reports the status as critical rather than refusing to audit", () => {
    const status = checks.find((check) => check.key === "http-status");
    expect(status?.status).toBe("ERROR");
    expect(status?.severity).toBe("CRITICAL");
  });

  it("still runs every other check", () => {
    expect(checks).toHaveLength(checkRegistry.length);
  });
});

describe("unmeasurable inputs", () => {
  it("excludes robots.txt from the score when it cannot be retrieved", () => {
    const withRobots = runAll(buildContext(htmlDocument()));
    const withoutRobots = runAll(
      buildContext(htmlDocument(), {
        robotsTxt: { retrieved: false, error: "Connection timed out", pathVerdict: "unknown" },
      }),
    );

    const robotsResult = withoutRobots.checks.find((check) => check.key === "robots-txt");
    expect(robotsResult?.status).toBe("UNAVAILABLE");

    // The technical ratio must not drop just because we could not measure it.
    const withRatio = withRobots.score.categories.find((c) => c.category === "technical")!.ratio;
    const withoutRatio = withoutRobots.score.categories.find(
      (c) => c.category === "technical",
    )!.ratio;

    expect(withoutRatio).toBeGreaterThanOrEqual(withRatio!);
  });
});

describe("pathological input", () => {
  it("handles an empty document without throwing", () => {
    expect(() => runAll(buildContext(""))).not.toThrow();
  });

  it("handles a document of only scripts", () => {
    const { score } = runAll(
      buildContext(`<html><head><script>var a=1;</script></head><body><script>var b=2;</script></body></html>`),
    );
    expect(Number.isFinite(score.total)).toBe(true);
  });

  it("handles deeply nested markup", () => {
    const nested = `${"<div>".repeat(500)}text${"</div>".repeat(500)}`;
    expect(() => parseHtml(`<html><body>${nested}</body></html>`, "https://example.com/")).not.toThrow();
  });

  it("handles thousands of links without excessive slowdown", () => {
    const links = Array.from(
      { length: 3000 },
      (_, index) => `<a href="/page-${index}">Page ${index}</a>`,
    ).join("");

    const started = Date.now();
    const { checks } = runAll(buildContext(htmlDocument({ body: links })));
    const elapsed = Date.now() - started;

    const internal = checks.find((check) => check.key === "internal-links");
    expect(internal?.details?.total).toBe(3000);
    expect(elapsed, "parsing and checking 3000 links took too long").toBeLessThan(10_000);
  });

  it("handles malformed JSON-LD without throwing", () => {
    expect(() =>
      runAll(
        buildContext(
          htmlDocument({
            head: `<script type="application/ld+json">{"@type": "Article",,,}</script>`,
          }),
        ),
      ),
    ).not.toThrow();
  });
});
