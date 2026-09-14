import { describe, expect, it } from "vitest";

import {
  CATEGORY_WEIGHTS,
  SEVERITY_DEDUCTIONS,
  bandFor,
  calculateScore,
  earnedFraction,
  prioritiseIssues,
} from "@/lib/seo/scoring";
import { checkRegistry } from "@/lib/seo/registry";
import type { CheckCategory, CheckResult, CheckStatus, SeoCheck, Severity } from "@/lib/seo/types";

/** Build a minimal result for scoring tests. */
function result(
  key: string,
  category: CheckCategory,
  status: CheckStatus,
  severity: Severity = "INFO",
): CheckResult {
  return {
    key,
    title: key,
    category,
    status,
    severity,
    value: null,
    message: "m",
    recommendation: null,
    why: "w",
    confidence: status === "UNAVAILABLE" ? "unavailable" : "measured",
  };
}

function check(key: string, category: CheckCategory, weight: number): SeoCheck {
  return {
    key,
    title: key,
    category,
    weight,
    run: () => result(key, category, "PASS"),
  };
}

describe("configuration invariants", () => {
  it("category weights total exactly 100", () => {
    const total = Object.values(CATEGORY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBe(100);
  });

  it("matches the weights named in the specification", () => {
    expect(CATEGORY_WEIGHTS).toEqual({
      technical: 30,
      "on-page": 35,
      content: 15,
      links: 10,
      "structured-data": 5,
      social: 5,
    });
  });

  it("severity deductions run from total loss to none", () => {
    expect(SEVERITY_DEDUCTIONS.CRITICAL).toBe(1);
    expect(SEVERITY_DEDUCTIONS.INFO).toBe(0);
    expect(SEVERITY_DEDUCTIONS.CRITICAL).toBeGreaterThan(SEVERITY_DEDUCTIONS.HIGH);
    expect(SEVERITY_DEDUCTIONS.HIGH).toBeGreaterThan(SEVERITY_DEDUCTIONS.MEDIUM);
    expect(SEVERITY_DEDUCTIONS.MEDIUM).toBeGreaterThan(SEVERITY_DEDUCTIONS.LOW);
    expect(SEVERITY_DEDUCTIONS.LOW).toBeGreaterThan(SEVERITY_DEDUCTIONS.INFO);
  });
});

describe("earnedFraction", () => {
  it("awards everything to a pass or an informational result", () => {
    expect(earnedFraction(result("a", "technical", "PASS"))).toBe(1);
    expect(earnedFraction(result("a", "technical", "INFO"))).toBe(1);
  });

  it("excludes an unavailable check from scoring entirely", () => {
    expect(earnedFraction(result("a", "technical", "UNAVAILABLE"))).toBeNull();
  });

  it("deducts according to severity", () => {
    expect(earnedFraction(result("a", "technical", "ERROR", "CRITICAL"))).toBe(0);
    expect(earnedFraction(result("a", "technical", "WARNING", "MEDIUM"))).toBeCloseTo(0.6);
    expect(earnedFraction(result("a", "technical", "WARNING", "LOW"))).toBeCloseTo(0.85);
  });
});

describe("calculateScore", () => {
  const checks: SeoCheck[] = [
    check("t1", "technical", 10),
    check("o1", "on-page", 10),
    check("c1", "content", 10),
    check("l1", "links", 10),
    check("s1", "structured-data", 10),
    check("soc1", "social", 10),
  ];

  it("gives a perfect page 100", () => {
    const results = checks.map((entry) => result(entry.key, entry.category, "PASS"));
    const score = calculateScore(results, checks);

    expect(score.total).toBe(100);
    expect(score.band.id).toBe("excellent");
  });

  it("gives a page that fails everything critically 0", () => {
    const results = checks.map((entry) =>
      result(entry.key, entry.category, "ERROR", "CRITICAL"),
    );
    expect(calculateScore(results, checks).total).toBe(0);
  });

  it("is deterministic — the same input always gives the same number", () => {
    const results = [
      result("t1", "technical", "WARNING", "MEDIUM"),
      result("o1", "on-page", "ERROR", "CRITICAL"),
      result("c1", "content", "PASS"),
      result("l1", "links", "WARNING", "LOW"),
      result("s1", "structured-data", "INFO"),
      result("soc1", "social", "PASS"),
    ];

    const first = calculateScore(results, checks);
    for (let i = 0; i < 20; i += 1) {
      expect(calculateScore(results, checks).total).toBe(first.total);
    }
  });

  it("makes the category scores add up to the total exactly", () => {
    const results = [
      result("t1", "technical", "WARNING", "HIGH"),
      result("o1", "on-page", "WARNING", "MEDIUM"),
      result("c1", "content", "PASS"),
      result("l1", "links", "ERROR", "CRITICAL"),
      result("s1", "structured-data", "PASS"),
      result("soc1", "social", "WARNING", "LOW"),
    ];

    const score = calculateScore(results, checks);
    const sum = score.categories.reduce((total, category) => total + category.score, 0);
    expect(sum).toBe(score.total);
  });

  it("makes the category maxima add up to 100 exactly", () => {
    const results = checks.map((entry) => result(entry.key, entry.category, "PASS"));
    const score = calculateScore(results, checks);
    const sum = score.categories.reduce((total, category) => total + category.max, 0);
    expect(sum).toBe(100);
  });

  it("never penalises a page for a check that could not be determined", () => {
    const allPass = checks.map((entry) => result(entry.key, entry.category, "PASS"));

    const withUnavailable = [
      result("t1", "technical", "UNAVAILABLE"),
      ...allPass.slice(1),
    ];

    // Technical is entirely unmeasurable here, so its weight is shared out and
    // the page still scores 100 on what could be measured.
    const score = calculateScore(withUnavailable, checks);
    expect(score.total).toBe(100);
    expect(score.weightsRedistributed).toBe(true);
  });

  it("redistributes an excluded category's weight across the rest", () => {
    const results = [
      result("t1", "technical", "UNAVAILABLE"),
      ...checks.slice(1).map((entry) => result(entry.key, entry.category, "PASS")),
    ];

    const score = calculateScore(results, checks);
    const technical = score.categories.find((category) => category.category === "technical");
    const onPage = score.categories.find((category) => category.category === "on-page");

    expect(technical?.max).toBe(0);
    expect(technical?.ratio).toBeNull();

    // On-page was 35 of the remaining 70, so it scales to about 50. Rounding
    // each category can leave the set summing to 99, and the remainder is
    // given to the largest category so the maxima always total exactly 100 —
    // hence 51 rather than 50 here.
    expect(onPage?.max).toBe(51);
    expect(score.categories.reduce((sum, category) => sum + category.max, 0)).toBe(100);
  });

  it("keeps the maxima summing to 100 whichever category is excluded", () => {
    for (const excluded of checks) {
      const results = checks.map((entry) =>
        entry.key === excluded.key
          ? result(entry.key, entry.category, "UNAVAILABLE")
          : result(entry.key, entry.category, "PASS"),
      );

      const score = calculateScore(results, checks);
      const sum = score.categories.reduce((total, category) => total + category.max, 0);

      expect(sum, `maxima do not total 100 when ${excluded.category} is excluded`).toBe(100);
      expect(score.total, `a fully passing page should still score 100`).toBe(100);
    }
  });

  it("weights a heavy check more than a light one in the same category", () => {
    const weighted: SeoCheck[] = [
      check("heavy", "technical", 20),
      check("light", "technical", 2),
      ...checks.slice(1),
    ];

    const heavyFails = calculateScore(
      [
        result("heavy", "technical", "ERROR", "CRITICAL"),
        result("light", "technical", "PASS"),
        ...checks.slice(1).map((entry) => result(entry.key, entry.category, "PASS")),
      ],
      weighted,
    );

    const lightFails = calculateScore(
      [
        result("heavy", "technical", "PASS"),
        result("light", "technical", "ERROR", "CRITICAL"),
        ...checks.slice(1).map((entry) => result(entry.key, entry.category, "PASS")),
      ],
      weighted,
    );

    expect(heavyFails.total).toBeLessThan(lightFails.total);
  });

  it("clamps into the 0-100 range", () => {
    const results = checks.map((entry) => result(entry.key, entry.category, "PASS"));
    const score = calculateScore(results, checks);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
  });

  it("handles an empty result set without throwing", () => {
    const score = calculateScore([], checks);
    expect(score.total).toBe(0);
    expect(Number.isNaN(score.total)).toBe(false);
  });
});

describe("bandFor", () => {
  it("maps scores to the documented bands", () => {
    expect(bandFor(100).id).toBe("excellent");
    expect(bandFor(90).id).toBe("excellent");
    expect(bandFor(89).id).toBe("good");
    expect(bandFor(75).id).toBe("good");
    expect(bandFor(74).id).toBe("needs-improvement");
    expect(bandFor(50).id).toBe("needs-improvement");
    expect(bandFor(49).id).toBe("significant-issues");
    expect(bandFor(0).id).toBe("significant-issues");
  });

  it("covers every value from 0 to 100 with no gaps", () => {
    for (let score = 0; score <= 100; score += 1) {
      expect(bandFor(score), `no band for ${score}`).toBeTruthy();
    }
  });

  it("never describes a score as a Google ranking", () => {
    for (let score = 0; score <= 100; score += 25) {
      const band = bandFor(score);
      expect(band.summary.toLowerCase()).not.toContain("google");
      expect(band.summary.toLowerCase()).not.toContain("rank");
    }
  });
});

describe("prioritiseIssues", () => {
  it("lists only failures, never passes", () => {
    const results = [
      result("a", "technical", "PASS"),
      result("b", "technical", "WARNING", "LOW"),
      result("c", "technical", "INFO"),
      result("d", "technical", "UNAVAILABLE"),
    ];

    const issues = prioritiseIssues(results, checkRegistry);
    expect(issues.map((issue) => issue.key)).toEqual(["b"]);
  });

  it("orders by severity first", () => {
    const results = [
      result("low", "technical", "WARNING", "LOW"),
      result("critical", "technical", "ERROR", "CRITICAL"),
      result("medium", "technical", "WARNING", "MEDIUM"),
      result("high", "technical", "WARNING", "HIGH"),
    ];

    const issues = prioritiseIssues(results, checkRegistry);
    expect(issues.map((issue) => issue.key)).toEqual(["critical", "high", "medium", "low"]);
  });

  it("breaks ties by how many points the fix recovers", () => {
    // Both MEDIUM, but `title` is a heavier check than `favicon`.
    const results = [
      result("favicon", "technical", "WARNING", "MEDIUM"),
      result("title", "on-page", "WARNING", "MEDIUM"),
    ];

    const issues = prioritiseIssues(results, checkRegistry);
    expect(issues[0]?.key).toBe("title");
  });

  it("respects the limit", () => {
    const results = Array.from({ length: 10 }, (_, index) =>
      result(`k${index}`, "technical", "WARNING", "MEDIUM"),
    );
    expect(prioritiseIssues(results, checkRegistry, 3)).toHaveLength(3);
  });
});

describe("the real registry", () => {
  it("has at least one check in every category", () => {
    for (const category of Object.keys(CATEGORY_WEIGHTS) as CheckCategory[]) {
      const inCategory = checkRegistry.filter((entry) => entry.category === category);
      expect(inCategory.length, `no checks in ${category}`).toBeGreaterThan(0);
    }
  });

  it("weights a missing title far above a missing favicon", () => {
    const title = checkRegistry.find((entry) => entry.key === "title");
    const favicon = checkRegistry.find((entry) => entry.key === "favicon");
    expect(title!.weight).toBeGreaterThan(favicon!.weight * 3);
  });
});
