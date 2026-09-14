import { describe, expect, it } from "vitest";

import { parseRobotsTxt, selectGroup, evaluatePath, evaluateRobotsForUrl } from "@/lib/crawler/robots";
import { parseSitemap } from "@/lib/crawler/sitemap";
import { decodeBody, fetchPage, closeCrawler } from "@/lib/crawler/fetch-url";
import { canonicalKey, isSamePage, registrableDomain, stripWww } from "@/lib/utils/url";

/* ------------------------------------------------------------------ */
/* robots.txt                                                          */
/* ------------------------------------------------------------------ */

describe("parseRobotsTxt", () => {
  it("parses groups, rules and sitemaps", () => {
    const parsed = parseRobotsTxt(`
# A comment
User-agent: *
Disallow: /admin/
Disallow: /cart/
Allow: /admin/public

User-agent: Googlebot
Disallow: /no-google/

Sitemap: https://example.com/sitemap.xml
`);

    expect(parsed.groups).toHaveLength(2);
    expect(parsed.groups[0]?.userAgents).toEqual(["*"]);
    expect(parsed.groups[0]?.disallow).toEqual(["/admin/", "/cart/"]);
    expect(parsed.groups[0]?.allow).toEqual(["/admin/public"]);
    expect(parsed.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });

  it("groups consecutive user-agent lines together", () => {
    const parsed = parseRobotsTxt(`
User-agent: BotA
User-agent: BotB
Disallow: /private/
`);

    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0]?.userAgents).toEqual(["bota", "botb"]);
  });

  it("strips comments and ignores blank lines", () => {
    const parsed = parseRobotsTxt(`User-agent: *  # everyone\nDisallow: /x/ # a path\n\n`);
    expect(parsed.groups[0]?.disallow).toEqual(["/x/"]);
  });

  it("notes directives it does not model", () => {
    const parsed = parseRobotsTxt(`User-agent: *\nNoindex: /legacy/\nDisallow: /a/`);
    expect(parsed.hasUnknownDirectives).toBe(true);
  });

  it("does not treat crawl-delay as unknown", () => {
    const parsed = parseRobotsTxt(`User-agent: *\nCrawl-delay: 10\nDisallow: /a/`);
    expect(parsed.hasUnknownDirectives).toBe(false);
  });

  it("survives an empty file", () => {
    const parsed = parseRobotsTxt("");
    expect(parsed.groups).toEqual([]);
    expect(parsed.sitemaps).toEqual([]);
  });
});

describe("selectGroup", () => {
  const groups = parseRobotsTxt(`
User-agent: *
Disallow: /everyone/

User-agent: seopagecheckerbot
Disallow: /just-us/
`).groups;

  it("prefers a group naming our bot over the wildcard", () => {
    expect(selectGroup(groups, "seopagecheckerbot")?.disallow).toEqual(["/just-us/"]);
  });

  it("falls back to the wildcard group", () => {
    expect(selectGroup(groups, "some-other-bot")?.disallow).toEqual(["/everyone/"]);
  });

  it("returns null when there is no applicable group", () => {
    const onlyNamed = parseRobotsTxt("User-agent: googlebot\nDisallow: /x/").groups;
    expect(selectGroup(onlyNamed, "seopagecheckerbot")).toBeNull();
  });
});

describe("evaluatePath", () => {
  const group = (content: string) => parseRobotsTxt(content).groups[0] ?? null;

  it("allows a path no rule covers", () => {
    expect(evaluatePath(group("User-agent: *\nDisallow: /admin/"), "/blog/post").verdict).toBe(
      "allowed",
    );
  });

  it("disallows a path a rule covers", () => {
    expect(evaluatePath(group("User-agent: *\nDisallow: /admin/"), "/admin/users").verdict).toBe(
      "disallowed",
    );
  });

  it("treats an empty Disallow as allowing everything", () => {
    expect(evaluatePath(group("User-agent: *\nDisallow:"), "/anything").verdict).toBe("allowed");
  });

  it("lets the longest match win", () => {
    const rules = group("User-agent: *\nDisallow: /a/\nAllow: /a/b/");
    expect(evaluatePath(rules, "/a/b/c").verdict).toBe("allowed");
    expect(evaluatePath(rules, "/a/x").verdict).toBe("disallowed");
  });

  it("lets Allow win a tie of equal length", () => {
    const rules = group("User-agent: *\nDisallow: /page\nAllow: /page");
    expect(evaluatePath(rules, "/page").verdict).toBe("allowed");
  });

  it("supports * wildcards and flags that it used one", () => {
    const rules = group("User-agent: *\nDisallow: /*.pdf");
    const verdict = evaluatePath(rules, "/files/report.pdf");
    expect(verdict.verdict).toBe("disallowed");
    expect(verdict.usedWildcard).toBe(true);
  });

  it("supports the $ end anchor", () => {
    const rules = group("User-agent: *\nDisallow: /page$");
    expect(evaluatePath(rules, "/page").verdict).toBe("disallowed");
    expect(evaluatePath(rules, "/page/sub").verdict).toBe("allowed");
  });

  it("allows everything when no group applies", () => {
    expect(evaluatePath(null, "/anything").verdict).toBe("allowed");
  });
});

describe("evaluateRobotsForUrl", () => {
  const document = {
    retrieved: true,
    url: "https://example.com/robots.txt",
    status: 200,
    error: null,
    ...parseRobotsTxt("User-agent: *\nDisallow: /private/"),
  };

  it("answers per-path against one fetched file", () => {
    expect(evaluateRobotsForUrl(document, "https://example.com/public").pathVerdict).toBe("allowed");
    expect(evaluateRobotsForUrl(document, "https://example.com/private/x").pathVerdict).toBe(
      "disallowed",
    );
  });

  it("downgrades a wildcard-based block to 'unknown' rather than asserting it", () => {
    const wildcard = {
      ...document,
      ...parseRobotsTxt("User-agent: *\nDisallow: /*?filter="),
    };

    const verdict = evaluateRobotsForUrl(wildcard, "https://example.com/p?filter=red");
    expect(verdict.pathVerdict).toBe("unknown");
    expect(verdict.hasComplexRules).toBe(true);
    // The matched rule is still reported, so the UI can explain itself.
    expect(verdict.matchedRule).toContain("Disallow:");
  });

  it("treats a 404 robots.txt as allowing everything", () => {
    const missing = { ...document, status: 404, groups: [], sitemaps: [] };
    expect(evaluateRobotsForUrl(missing, "https://example.com/x").pathVerdict).toBe("allowed");
  });

  it("returns 'unknown' when the file could not be retrieved", () => {
    const failed = { ...document, retrieved: false, status: null, error: "timeout" };
    expect(evaluateRobotsForUrl(failed, "https://example.com/x").pathVerdict).toBe("unknown");
  });
});

/* ------------------------------------------------------------------ */
/* Sitemap                                                             */
/* ------------------------------------------------------------------ */

describe("parseSitemap", () => {
  it("reads a urlset and counts locations", () => {
    const parsed = parseSitemap(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/a</loc></url>
  <url><loc>https://example.com/b</loc></url>
</urlset>`);

    expect(parsed.kind).toBe("urlset");
    expect(parsed.totalLocations).toBe(2);
    expect(parsed.locations).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  it("recognises a sitemap index", () => {
    const parsed = parseSitemap(`<sitemapindex><sitemap><loc>https://example.com/s1.xml</loc></sitemap></sitemapindex>`);
    expect(parsed.kind).toBe("sitemapindex");
  });

  it("unwraps CDATA and decodes entities", () => {
    const parsed = parseSitemap(
      `<urlset><url><loc><![CDATA[https://example.com/a?x=1&amp;y=2]]></loc></url></urlset>`,
    );
    expect(parsed.locations[0]).toBe("https://example.com/a?x=1&y=2");
  });

  it("is not fooled by an HTML page served at the sitemap path", () => {
    const parsed = parseSitemap("<!doctype html><html><body>Not found</body></html>");
    expect(parsed.kind).toBeNull();
    expect(parsed.totalLocations).toBe(0);
  });

  it("does not expand entities, so it cannot be used as a billion-laughs bomb", () => {
    const bomb = `<?xml version="1.0"?>
<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;">]>
<urlset><url><loc>&lol2;</loc></url></urlset>`;

    const parsed = parseSitemap(bomb);
    // The raw entity text is returned untouched — never expanded.
    expect(parsed.locations[0]).toBe("&lol2;");
  });

  it("caps how many locations it reads but still reports the true count", () => {
    const many = Array.from(
      { length: 6000 },
      (_, index) => `<url><loc>https://example.com/${index}</loc></url>`,
    ).join("");

    const parsed = parseSitemap(`<urlset>${many}</urlset>`);
    expect(parsed.totalLocations).toBe(6000);
    expect(parsed.locations.length).toBe(5000);
    expect(parsed.truncated).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* URL helpers                                                         */
/* ------------------------------------------------------------------ */

describe("url helpers", () => {
  it("strips www for comparison", () => {
    expect(stripWww("www.example.com")).toBe("example.com");
    expect(stripWww("wwwx.example.com")).toBe("wwwx.example.com");
  });

  it("finds the registrable domain, including two-part suffixes", () => {
    expect(registrableDomain("blog.example.com")).toBe("example.com");
    expect(registrableDomain("shop.example.co.uk")).toBe("example.co.uk");
    expect(registrableDomain("example.com")).toBe("example.com");
  });

  it("treats cosmetic URL differences as the same page", () => {
    expect(isSamePage("https://example.com/page/", "https://www.example.com/page")).toBe(true);
    expect(isSamePage("https://example.com/page", "http://example.com/page")).toBe(true);
  });

  it("treats a different query string as a different page", () => {
    expect(isSamePage("https://example.com/p?id=1", "https://example.com/p?id=2")).toBe(false);
    expect(isSamePage("https://example.com/p", "https://example.com/p?id=1")).toBe(false);
  });

  it("returns null for an unparseable URL", () => {
    expect(canonicalKey("not a url")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Body decoding                                                       */
/* ------------------------------------------------------------------ */

describe("decodeBody", () => {
  it("decodes UTF-8 by default", () => {
    const bytes = new TextEncoder().encode("<p>Café</p>");
    expect(decodeBody(bytes, "text/html")).toBe("<p>Café</p>");
  });

  it("honours a charset declared in the Content-Type header", () => {
    // 0xE9 is "é" in windows-1252 but invalid UTF-8.
    const bytes = new Uint8Array([0x43, 0x61, 0x66, 0xe9]);
    expect(decodeBody(bytes, "text/html; charset=windows-1252")).toBe("Café");
  });

  it("falls back to a charset declared in the document", () => {
    const head = new TextEncoder().encode('<meta charset="windows-1252">');
    const bytes = new Uint8Array([...head, 0x43, 0x61, 0x66, 0xe9]);
    expect(decodeBody(bytes, null)).toContain("Café");
  });

  it("falls back to UTF-8 when the declared encoding is not supported", () => {
    const bytes = new TextEncoder().encode("<p>Hello</p>");
    expect(decodeBody(bytes, "text/html; charset=not-a-real-encoding")).toContain("Hello");
  });
});

/* ------------------------------------------------------------------ */
/* fetchPage refusals (no network required)                            */
/* ------------------------------------------------------------------ */

describe("fetchPage refuses unsafe targets before opening a socket", () => {
  const blocked: [string, string][] = [
    ["http://localhost/", "BLOCKED_URL"],
    ["http://127.0.0.1/", "BLOCKED_URL"],
    ["http://0.0.0.0/", "BLOCKED_URL"],
    ["http://169.254.169.254/latest/meta-data/", "BLOCKED_URL"],
    ["http://[::1]/", "BLOCKED_URL"],
    ["http://10.1.2.3/", "BLOCKED_URL"],
    ["http://192.168.0.1/", "BLOCKED_URL"],
    ["http://172.20.1.1/", "BLOCKED_URL"],
    ["http://metadata.google.internal/", "BLOCKED_URL"],
    ["http://2130706433/", "BLOCKED_URL"],
    ["http://0x7f000001/", "BLOCKED_URL"],
    ["http://example.com:22/", "BLOCKED_URL"],
    ["file:///etc/passwd", "BLOCKED_URL"],
    ["javascript:alert(1)", "BLOCKED_URL"],
    ["data:text/html,<h1>x</h1>", "BLOCKED_URL"],
    ["ftp://example.com/", "BLOCKED_URL"],
    ["https://user:pass@example.com/", "BLOCKED_URL"],
    ["", "INVALID_URL"],
    ["   ", "INVALID_URL"],
  ];

  for (const [url, expectedCode] of blocked) {
    it(`refuses ${url || "(empty input)"}`, async () => {
      const outcome = await fetchPage(url);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.code).toBe(expectedCode);
        // The message must never leak why internally — no IPs, no hostnames.
        expect(outcome.message).not.toContain("127.0.0.1");
        expect(outcome.message).not.toContain("169.254");
      }
    });
  }

  it("closes cleanly", async () => {
    await expect(closeCrawler()).resolves.toBeUndefined();
  });
});
