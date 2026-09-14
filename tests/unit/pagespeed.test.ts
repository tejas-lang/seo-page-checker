/**
 * PageSpeed Insights parsing tests.
 *
 * These run against recorded response shapes rather than the live API, which
 * means they verify the part that can actually break — our parsing of a large,
 * deeply nested, highly variable payload — without needing an API key, a
 * network, or Google's quota.
 *
 * The fixtures mirror the documented v5 response, including the awkward parts:
 * field data that may be missing entirely, CLS arriving multiplied by 100, and
 * errors returned with a 200 status.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPageSpeed, isPageSpeedConfigured } from "@/lib/pagespeed/client";
import { positionOnTrack, thresholdFor } from "@/lib/pagespeed/thresholds";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function labAudit(displayValue: string, numericValue: number, score: number) {
  return { displayValue, numericValue, score };
}

const FULL_RESPONSE = {
  analysisUTCTimestamp: "2026-09-15T10:00:00.000Z",
  lighthouseResult: {
    finalUrl: "https://example.com/",
    lighthouseVersion: "12.2.1",
    categories: { performance: { score: 0.74 } },
    audits: {
      "largest-contentful-paint": labAudit("3.1 s", 3100, 0.62),
      "cumulative-layout-shift": labAudit("0.05", 0.05, 0.98),
      "total-blocking-time": labAudit("450 ms", 450, 0.41),
      "first-contentful-paint": labAudit("1.4 s", 1400, 0.93),
      "speed-index": labAudit("4.2 s", 4200, 0.68),
      // An opportunity, which is what the suggestions list is built from.
      "unused-javascript": {
        title: "Reduce unused JavaScript",
        description:
          "Reduce unused JavaScript. [Learn how](https://developer.chrome.com/docs/lighthouse/) to save bytes.",
        displayValue: "Potential savings of 480 ms",
        details: { type: "opportunity", overallSavingsMs: 480 },
      },
      "render-blocking-resources": {
        title: "Eliminate render-blocking resources",
        description: "Resources are blocking the first paint.",
        displayValue: "Potential savings of 210 ms",
        details: { type: "opportunity", overallSavingsMs: 210 },
      },
      // Below the noise floor — must be filtered out.
      "uses-text-compression": {
        title: "Enable text compression",
        details: { type: "opportunity", overallSavingsMs: 12 },
      },
      // Not an opportunity at all — must be ignored.
      "meta-description": { title: "Document has a meta description", score: 1 },
    },
  },
  loadingExperience: {
    overall_category: "AVERAGE",
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2900, category: "AVERAGE" },
      // The API reports CLS multiplied by 100: 8 here means 0.08.
      CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 8, category: "FAST" },
      INTERACTION_TO_NEXT_PAINT: { percentile: 610, category: "SLOW" },
    },
  },
} as const;

/** A new page: Lighthouse ran, but Google has no real-user data for it. */
const NO_FIELD_DATA_RESPONSE = {
  analysisUTCTimestamp: "2026-09-15T10:00:00.000Z",
  lighthouseResult: {
    finalUrl: "https://new-site.example/",
    lighthouseVersion: "12.2.1",
    categories: { performance: { score: 0.99 } },
    audits: { "largest-contentful-paint": labAudit("0.9 s", 900, 1) },
  },
} as const;

function mockFetchOnce(payload: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(payload), { status })),
  );
}

/* ------------------------------------------------------------------ */

describe("isPageSpeedConfigured", () => {
  afterEach(() => {
    delete process.env.PAGESPEED_API_KEY;
  });

  it("is false with no key, and false for a blank one", () => {
    delete process.env.PAGESPEED_API_KEY;
    expect(isPageSpeedConfigured()).toBe(false);

    process.env.PAGESPEED_API_KEY = "   ";
    expect(isPageSpeedConfigured()).toBe(false);
  });

  it("is true once a key is set", () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    expect(isPageSpeedConfigured()).toBe(true);
  });
});

describe("fetchPageSpeed", () => {
  beforeEach(() => {
    process.env.PAGESPEED_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PAGESPEED_API_KEY;
  });

  it("refuses to pretend when no key is configured", async () => {
    delete process.env.PAGESPEED_API_KEY;
    const result = await fetchPageSpeed("https://example.com/");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_CONFIGURED");
  });

  it("parses a complete response", async () => {
    mockFetchOnce(FULL_RESPONSE);
    const result = await fetchPageSpeed("https://example.com/");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.lab.score).toBe(74);
    expect(result.finalUrl).toBe("https://example.com/");
    expect(result.lighthouseVersion).toBe("12.2.1");
    expect(result.strategy).toBe("mobile");
  });

  it("maps Lighthouse scores onto Google's three bands", async () => {
    mockFetchOnce(FULL_RESPONSE);
    const result = await fetchPageSpeed("https://example.com/");
    if (!result.ok) throw new Error("expected success");

    const byId = Object.fromEntries(result.lab.metrics.map((m) => [m.id, m]));

    expect(byId["cumulative-layout-shift"]?.category).toBe("GOOD"); // 0.98
    expect(byId["largest-contentful-paint"]?.category).toBe("NEEDS_IMPROVEMENT"); // 0.62
    expect(byId["total-blocking-time"]?.category).toBe("POOR"); // 0.41
  });

  it("gives every metric a plain-language explanation", async () => {
    mockFetchOnce(FULL_RESPONSE);
    const result = await fetchPageSpeed("https://example.com/");
    if (!result.ok) throw new Error("expected success");

    for (const metric of result.lab.metrics) {
      expect(metric.explanation.length, `${metric.id} has no explanation`).toBeGreaterThan(20);
    }
  });

  it("passes Google's own field ratings through unchanged", async () => {
    mockFetchOnce(FULL_RESPONSE);
    const result = await fetchPageSpeed("https://example.com/");
    if (!result.ok) throw new Error("expected success");

    expect(result.field.available).toBe(true);
    expect(result.field.overall).toBe("AVERAGE");
    expect(result.field.isOriginFallback).toBe(false);

    const byId = Object.fromEntries(result.field.metrics.map((m) => [m.id, m]));
    expect(byId["largest-contentful-paint"]?.category).toBe("NEEDS_IMPROVEMENT"); // AVERAGE
    expect(byId["cumulative-layout-shift"]?.category).toBe("GOOD"); // FAST
    expect(byId["interaction-to-next-paint"]?.category).toBe("POOR"); // SLOW
  });

  it("converts the API's ×100 CLS back to a readable value", async () => {
    mockFetchOnce(FULL_RESPONSE);
    const result = await fetchPageSpeed("https://example.com/");
    if (!result.ok) throw new Error("expected success");

    const cls = result.field.metrics.find((m) => m.id === "cumulative-layout-shift");
    // 8 from the API means a CLS of 0.08, not 8.
    expect(cls?.displayValue).toBe("0.08");
  });

  it("formats field timings in sensible units", async () => {
    mockFetchOnce(FULL_RESPONSE);
    const result = await fetchPageSpeed("https://example.com/");
    if (!result.ok) throw new Error("expected success");

    const lcp = result.field.metrics.find((m) => m.id === "largest-contentful-paint");
    const inp = result.field.metrics.find((m) => m.id === "interaction-to-next-paint");

    expect(lcp?.displayValue).toBe("2.9 s");
    expect(inp?.displayValue).toBe("610 ms");
  });

  it("ranks opportunities by saving and drops negligible ones", async () => {
    mockFetchOnce(FULL_RESPONSE);
    const result = await fetchPageSpeed("https://example.com/");
    if (!result.ok) throw new Error("expected success");

    expect(result.opportunities.map((o) => o.id)).toEqual([
      "unused-javascript",
      "render-blocking-resources",
    ]);
    // The 12ms one is below the floor; the non-opportunity audit is not one.
    expect(result.opportunities.some((o) => o.id === "uses-text-compression")).toBe(false);
    expect(result.opportunities.some((o) => o.id === "meta-description")).toBe(false);
  });

  it("strips the markdown links Google embeds in descriptions", async () => {
    mockFetchOnce(FULL_RESPONSE);
    const result = await fetchPageSpeed("https://example.com/");
    if (!result.ok) throw new Error("expected success");

    const opportunity = result.opportunities[0];
    expect(opportunity?.description).toContain("Learn how");
    expect(opportunity?.description).not.toContain("http");
    expect(opportunity?.description).not.toContain("[");
  });

  it("reports absent field data as absent rather than as zero", async () => {
    mockFetchOnce(NO_FIELD_DATA_RESPONSE);
    const result = await fetchPageSpeed("https://new-site.example/");
    if (!result.ok) throw new Error("expected success");

    expect(result.field.available).toBe(false);
    expect(result.field.metrics).toEqual([]);
    // The lab data is still perfectly usable.
    expect(result.lab.score).toBe(99);
  });

  it("falls back to origin data and says that is what it did", async () => {
    mockFetchOnce({
      ...NO_FIELD_DATA_RESPONSE,
      originLoadingExperience: {
        overall_category: "FAST",
        metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 1900, category: "FAST" } },
      },
    });

    const result = await fetchPageSpeed("https://new-site.example/page");
    if (!result.ok) throw new Error("expected success");

    expect(result.field.available).toBe(true);
    expect(result.field.isOriginFallback).toBe(true);
  });

  it("handles a quota error", async () => {
    mockFetchOnce({ error: { code: 429, message: "Quota exceeded" } }, 429);
    const result = await fetchPageSpeed("https://example.com/");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("QUOTA_EXCEEDED");
      expect(result.message).not.toContain("Quota exceeded for quota metric");
    }
  });

  it("handles an error returned with a 200 status", async () => {
    // PSI does this, which is why the check is on the body, not just the status.
    mockFetchOnce({ error: { code: 400, message: "Invalid URL" } }, 200);
    const result = await fetchPageSpeed("https://example.com/");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_URL");
  });

  it("handles an unreachable page", async () => {
    mockFetchOnce({ error: { code: 500, message: "Lighthouse returned an error" } }, 500);
    const result = await fetchPageSpeed("https://example.com/");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNREACHABLE");
  });

  it("survives a truncated or nonsense payload without throwing", async () => {
    mockFetchOnce({ lighthouseResult: {} });
    const result = await fetchPageSpeed("https://example.com/");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lab.score).toBeNull();
      expect(result.lab.metrics).toEqual([]);
      expect(result.field.available).toBe(false);
    }
  });

  it("never leaks the API key into an error message", async () => {
    process.env.PAGESPEED_API_KEY = "super-secret-key-12345";
    mockFetchOnce({ error: { code: 403, message: "API key invalid: super-secret-key-12345" } }, 403);

    const result = await fetchPageSpeed("https://example.com/");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).not.toContain("super-secret-key-12345");
  });
});

describe("thresholds", () => {
  it("knows the three Core Web Vitals", () => {
    const coreWebVitals = [
      "largest-contentful-paint",
      "cumulative-layout-shift",
      "interaction-to-next-paint",
    ];

    for (const id of coreWebVitals) {
      expect(thresholdFor(id)?.isCoreWebVital, id).toBe(true);
    }

    expect(thresholdFor("speed-index")?.isCoreWebVital).toBe(false);
  });

  it("matches Google's published boundaries", () => {
    expect(thresholdFor("largest-contentful-paint")?.good).toBe(2500);
    expect(thresholdFor("largest-contentful-paint")?.needsImprovement).toBe(4000);
    expect(thresholdFor("interaction-to-next-paint")?.good).toBe(200);
    // CLS 0.1 and 0.25, in the API's ×100 form.
    expect(thresholdFor("cumulative-layout-shift")?.good).toBe(10);
    expect(thresholdFor("cumulative-layout-shift")?.needsImprovement).toBe(25);
  });

  it("clamps a meter position into the track rather than overflowing", () => {
    const lcp = thresholdFor("largest-contentful-paint")!;

    expect(positionOnTrack(0, lcp)).toBe(0);
    expect(positionOnTrack(3000, lcp)).toBeCloseTo(0.5);
    // A catastrophically slow page still ends at the end of the track.
    expect(positionOnTrack(999_999, lcp)).toBe(1);
    expect(positionOnTrack(-5, lcp)).toBe(0);
  });

  it("returns null for a metric it has no thresholds for", () => {
    expect(thresholdFor("not-a-real-metric")).toBeNull();
  });
});
