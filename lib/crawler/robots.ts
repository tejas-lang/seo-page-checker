/**
 * robots.txt retrieval and parsing.
 *
 * WHAT IT IS: fetches /robots.txt for the audited site and works out, as far as
 * it honestly can, whether the audited path is crawlable.
 *
 * WHY IT IS CAUTIOUS: robots.txt has a deceptively tricky matching algorithm
 * (wildcards, `$` anchors, longest-match-wins, allow-beats-disallow on ties)
 * and search engines differ in the edge cases. A tool that confidently says
 * "your page is blocked" and is wrong is worse than useless. So we implement
 * the widely-agreed rules, and whenever the file contains syntax we do not
 * fully model we mark the result as uncertain and the UI says "potentially
 * blocked" instead of stating it as fact.
 */

import { fetchText } from "./fetch-url";
import { crawlerUserAgentToken } from "@/lib/config/env";
import type { RobotsRule, RobotsTxtResult } from "@/lib/seo/types";

/** Directives we understand. Anything else marks the file as "complex". */
const KNOWN_DIRECTIVES = new Set([
  "user-agent",
  "allow",
  "disallow",
  "sitemap",
  "crawl-delay",
  "host",
  "clean-param",
  "request-rate",
  "visit-time",
]);

/** Directives that exist but that we do not act on, without meaning complexity. */
const IGNORED_BUT_KNOWN = new Set(["crawl-delay", "host", "clean-param", "request-rate", "visit-time"]);

export interface ParsedRobots {
  groups: RobotsRule[];
  sitemaps: string[];
  hasUnknownDirectives: boolean;
}

/**
 * Parse robots.txt into user-agent groups.
 *
 * Consecutive `User-agent:` lines share the following rule block, which is why
 * groups hold an array of agents rather than a single one.
 */
export function parseRobotsTxt(content: string): ParsedRobots {
  const groups: RobotsRule[] = [];
  const sitemaps: string[] = [];
  let hasUnknownDirectives = false;

  let current: RobotsRule | null = null;
  // True while we are reading a run of User-agent lines that share one block.
  let collectingAgents = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const withoutComment = rawLine.split("#")[0] ?? "";
    const line = withoutComment.trim();
    if (line === "") continue;

    const separator = line.indexOf(":");
    if (separator === -1) {
      hasUnknownDirectives = true;
      continue;
    }

    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (!KNOWN_DIRECTIVES.has(directive)) {
      hasUnknownDirectives = true;
      continue;
    }

    if (directive === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }

    if (IGNORED_BUT_KNOWN.has(directive)) continue;

    if (directive === "user-agent") {
      if (!collectingAgents || current === null) {
        current = { userAgents: [], allow: [], disallow: [] };
        groups.push(current);
        collectingAgents = true;
      }
      if (value) current.userAgents.push(value.toLowerCase());
      continue;
    }

    // An Allow/Disallow line ends the run of user-agent lines.
    collectingAgents = false;

    if (current === null) {
      // Rules before any User-agent line are not addressed to anyone. Record
      // that the file is unusual rather than guessing what was meant.
      hasUnknownDirectives = true;
      continue;
    }

    if (directive === "allow") current.allow.push(value);
    else if (directive === "disallow") current.disallow.push(value);
  }

  return { groups, sitemaps, hasUnknownDirectives };
}

/**
 * Turn a robots.txt path pattern into a regular expression.
 * `*` matches any run of characters; a trailing `$` anchors the end.
 */
function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;

  const escaped = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");

  return new RegExp(`^${escaped}${anchored ? "$" : ""}`);
}

/** Select the rule group that applies to a given user-agent token. */
export function selectGroup(groups: RobotsRule[], agentToken: string): RobotsRule | null {
  const token = agentToken.toLowerCase();

  // Longest matching agent name wins, exactly as the specification describes.
  let best: { group: RobotsRule; length: number } | null = null;

  for (const group of groups) {
    for (const agent of group.userAgents) {
      if (agent === "*") continue;
      if (token.startsWith(agent) || token.includes(agent)) {
        if (!best || agent.length > best.length) best = { group, length: agent.length };
      }
    }
  }

  if (best) return best.group;

  const wildcard = groups.find((group) => group.userAgents.includes("*"));
  return wildcard ?? null;
}

export interface PathVerdict {
  verdict: "allowed" | "disallowed" | "unknown";
  matchedRule: string | null;
  /** True when the decision relied on a pattern with wildcards. */
  usedWildcard: boolean;
}

/**
 * Decide whether a path is crawlable under a rule group.
 *
 * The algorithm search engines document: find the longest matching Allow and
 * the longest matching Disallow; the longer one wins; on a tie, Allow wins.
 * An empty `Disallow:` means "allow everything".
 */
export function evaluatePath(group: RobotsRule | null, path: string): PathVerdict {
  if (group === null) {
    return { verdict: "allowed", matchedRule: null, usedWildcard: false };
  }

  let bestAllow: { rule: string; length: number } | null = null;
  let bestDisallow: { rule: string; length: number } | null = null;
  let usedWildcard = false;

  for (const rule of group.allow) {
    if (rule === "") continue;
    if (patternToRegExp(rule).test(path)) {
      if (rule.includes("*") || rule.endsWith("$")) usedWildcard = true;
      if (!bestAllow || rule.length > bestAllow.length) bestAllow = { rule, length: rule.length };
    }
  }

  for (const rule of group.disallow) {
    // "Disallow:" with no value explicitly permits everything.
    if (rule === "") continue;
    if (patternToRegExp(rule).test(path)) {
      if (rule.includes("*") || rule.endsWith("$")) usedWildcard = true;
      if (!bestDisallow || rule.length > bestDisallow.length) {
        bestDisallow = { rule, length: rule.length };
      }
    }
  }

  if (!bestDisallow) {
    return { verdict: "allowed", matchedRule: bestAllow?.rule ?? null, usedWildcard };
  }

  if (bestAllow && bestAllow.length >= bestDisallow.length) {
    return { verdict: "allowed", matchedRule: `Allow: ${bestAllow.rule}`, usedWildcard };
  }

  return { verdict: "disallowed", matchedRule: `Disallow: ${bestDisallow.rule}`, usedWildcard };
}

/**
 * The part of a robots.txt result that is the same for every page on a site.
 *
 * Kept separate from the path verdict so it can be cached per origin: the file
 * is shared by the whole site, but "is THIS path allowed?" has to be answered
 * per audit.
 */
export interface RobotsDocument {
  retrieved: boolean;
  url: string;
  status: number | null;
  error: string | null;
  groups: RobotsRule[];
  sitemaps: string[];
  hasUnknownDirectives: boolean;
}

/** Fetch and parse robots.txt for an origin. Contains no per-page state. */
export async function fetchRobotsDocument(origin: string): Promise<RobotsDocument> {
  const robotsUrl = new URL("/robots.txt", origin).href;

  const response = await fetchText(robotsUrl, { maxBytes: 512 * 1024, timeoutMs: 8000 });

  if (!response.ok) {
    // A 404 is a perfectly valid state meaning "nothing is disallowed".
    if (response.status === 404 || response.status === 410) {
      return {
        retrieved: true,
        url: robotsUrl,
        status: response.status,
        error: null,
        groups: [],
        sitemaps: [],
        hasUnknownDirectives: false,
      };
    }

    return {
      retrieved: false,
      url: robotsUrl,
      status: response.status,
      error: response.error ?? `robots.txt returned HTTP ${response.status ?? "no response"}.`,
      groups: [],
      sitemaps: [],
      hasUnknownDirectives: false,
    };
  }

  const content = response.text ?? "";

  // Some hosts answer every path with an HTML page. That is not a robots file,
  // and parsing it would produce nonsense.
  if (/^\s*<(?:!doctype|html)/i.test(content)) {
    return {
      retrieved: false,
      url: robotsUrl,
      status: response.status,
      error: "The server returned an HTML page instead of a robots.txt file.",
      groups: [],
      sitemaps: [],
      hasUnknownDirectives: false,
    };
  }

  const parsed = parseRobotsTxt(content);

  return {
    retrieved: true,
    url: robotsUrl,
    status: response.status,
    error: null,
    groups: parsed.groups,
    sitemaps: parsed.sitemaps,
    hasUnknownDirectives: parsed.hasUnknownDirectives,
  };
}

/**
 * Answer "may this specific URL be crawled?" against an already-fetched file.
 *
 * We evaluate against the `*` group (or a group naming our own bot), because
 * that is the closest honest proxy for "what a generic crawler sees". We do
 * NOT evaluate as Googlebot — pretending to be Google would be both dishonest
 * and unreliable.
 */
export function evaluateRobotsForUrl(
  document: RobotsDocument,
  auditedUrl: string,
): RobotsTxtResult {
  const base = {
    retrieved: document.retrieved,
    url: document.url,
    status: document.status,
    error: document.error,
    groups: document.groups,
    sitemaps: document.sitemaps,
  };

  if (!document.retrieved) {
    return { ...base, pathVerdict: "unknown", matchedRule: null, hasComplexRules: false };
  }

  if (document.status === 404 || document.status === 410) {
    return { ...base, pathVerdict: "allowed", matchedRule: null, hasComplexRules: false };
  }

  let path: string;
  try {
    const target = new URL(auditedUrl);
    path = `${target.pathname}${target.search}`;
  } catch {
    return { ...base, pathVerdict: "unknown", matchedRule: null, hasComplexRules: false };
  }

  const group = selectGroup(document.groups, crawlerUserAgentToken);
  const evaluation = evaluatePath(group, path);
  const hasComplexRules = document.hasUnknownDirectives || evaluation.usedWildcard;

  return {
    ...base,
    // When the file uses syntax we only partly model, we downgrade a
    // "disallowed" verdict to "unknown" rather than asserting a block.
    pathVerdict:
      hasComplexRules && evaluation.verdict === "disallowed" ? "unknown" : evaluation.verdict,
    matchedRule: evaluation.matchedRule,
    hasComplexRules,
  };
}

/** Convenience wrapper: fetch and evaluate in one call. */
export async function analyzeRobotsTxt(auditedUrl: string): Promise<RobotsTxtResult> {
  let origin: string;
  try {
    origin = new URL(auditedUrl).origin;
  } catch {
    return {
      retrieved: false,
      url: "",
      status: null,
      error: "The audited URL could not be parsed.",
      groups: [],
      sitemaps: [],
      pathVerdict: "unknown",
      matchedRule: null,
      hasComplexRules: false,
    };
  }

  const document = await fetchRobotsDocument(origin);
  return evaluateRobotsForUrl(document, auditedUrl);
}
