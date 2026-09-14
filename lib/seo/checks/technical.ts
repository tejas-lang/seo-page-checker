/**
 * Technical checks: how reachable, crawlable and well-formed the page is.
 *
 * Several of these report on things we measured about the HTTP response rather
 * than the HTML — status codes, redirects, the protocol used — which is why
 * they receive the whole fetch result, not just the parsed page.
 */

import { createCheck, plural, truncate } from "./create-check";
import { isSamePage, isSameSite } from "@/lib/utils/url";

/* ------------------------------------------------------------------ */
/* HTTPS                                                               */
/* ------------------------------------------------------------------ */

export const httpsCheck = createCheck(
  {
    key: "https",
    title: "HTTPS",
    category: "technical",
    weight: 8,
    why: "HTTPS encrypts the connection between a visitor and the site. Browsers mark pages served over plain HTTP as 'Not secure', which visitors see directly, and Google has said HTTPS is used as a lightweight signal.",
  },
  ({ requestedUrl, finalUrl }) => {
    let requested: URL;
    let final: URL;
    try {
      requested = new URL(requestedUrl);
      final = new URL(finalUrl);
    } catch {
      return {
        status: "UNAVAILABLE",
        value: null,
        message: "The URL could not be parsed to determine its protocol.",
        unavailableReason: "The URL could not be parsed.",
      };
    }

    const finalIsHttps = final.protocol === "https:";
    const upgraded = requested.protocol === "http:" && finalIsHttps;

    if (finalIsHttps && upgraded) {
      return {
        status: "PASS",
        value: "HTTPS (redirected)",
        message:
          "The page is served over HTTPS. The HTTP address you entered redirects to the secure version, which is the recommended setup.",
        details: { finalProtocol: "https:", upgradedFromHttp: true },
      };
    }

    if (finalIsHttps) {
      return {
        status: "PASS",
        value: "HTTPS",
        message: "This page is served over HTTPS.",
        details: { finalProtocol: "https:", upgradedFromHttp: false },
      };
    }

    return {
      status: "ERROR",
      // Critical rather than high: browsers label plain HTTP pages "Not
      // secure" to every visitor, and the page cannot use a growing list of
      // browser features at all. This is a functional failure, not a polish
      // item.
      severity: "CRITICAL",
      value: "HTTP only",
      message: "This page is served over plain HTTP, not HTTPS.",
      recommendation:
        "Install a TLS certificate and serve the page over HTTPS, then redirect the HTTP address to it permanently (301). Most hosts and CDNs provide free certificates.",
      details: { finalProtocol: final.protocol, upgradedFromHttp: false },
    };
  },
);

/* ------------------------------------------------------------------ */
/* HTTP status                                                         */
/* ------------------------------------------------------------------ */

export const httpStatusCheck = createCheck(
  {
    key: "http-status",
    title: "HTTP status",
    category: "technical",
    weight: 8,
    why: "The status code is the server's answer to 'does this page exist?'. A 200 means the page was served normally. A 4xx or 5xx tells search engines the page is missing or broken, and pages that answer with an error are generally not kept in a search index.",
  },
  ({ fetchResult }) => {
    const status = fetchResult.finalStatus;

    if (status >= 200 && status < 300) {
      return {
        status: "PASS",
        value: `${status} OK`,
        message: `The page returned HTTP ${status}, meaning it was served successfully.`,
        details: { initialStatus: fetchResult.initialStatus, finalStatus: status },
      };
    }

    if (status >= 300 && status < 400) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: `${status}`,
        message: `The final response was HTTP ${status}, a redirect that we did not follow further.`,
        recommendation: "Check where this address ultimately leads and audit that URL directly.",
        details: { finalStatus: status },
      };
    }

    if (status === 404 || status === 410) {
      return {
        status: "ERROR",
        severity: "CRITICAL",
        value: `${status} Not Found`,
        message: `The page returned HTTP ${status}. The server is reporting that this page does not exist.`,
        recommendation:
          "If this URL should work, fix the routing or restore the page. If it is genuinely gone, redirect it to the closest relevant page so visitors and links are not lost.",
        details: { finalStatus: status },
      };
    }

    if (status >= 500) {
      return {
        status: "ERROR",
        severity: "CRITICAL",
        value: `${status} Server Error`,
        message: `The page returned HTTP ${status}, a server error.`,
        recommendation:
          "Check the server or application logs for this URL. Persistent server errors can cause a page to be dropped from search results.",
        details: { finalStatus: status },
      };
    }

    return {
      status: "ERROR",
      severity: "HIGH",
      value: `${status}`,
      message: `The page returned HTTP ${status}.`,
      recommendation:
        status === 403
          ? "The server refused the request. This often means automated requests are blocked — the page may work normally in a browser."
          : "Investigate why the server is returning this status for this URL.",
      details: { finalStatus: status },
    };
  },
);

/* ------------------------------------------------------------------ */
/* Redirects                                                           */
/* ------------------------------------------------------------------ */

export const redirectCheck = createCheck(
  {
    key: "redirects",
    title: "Redirects",
    category: "technical",
    weight: 5,
    why: "Every redirect adds a round trip before the page starts loading. One redirect is normal and harmless; a chain of several slows the page down for visitors and wastes crawl time.",
  },
  ({ fetchResult, requestedUrl, finalUrl }) => {
    const hops = fetchResult.redirects;

    if (hops.length === 0) {
      return {
        status: "PASS",
        value: "None",
        message: "The URL was served directly with no redirects.",
        details: { count: 0, chain: [] },
      };
    }

    const chain = [
      ...hops.map((hop) => ({ url: hop.url, status: hop.status })),
      { url: finalUrl, status: fetchResult.finalStatus },
    ];

    const isHttpsUpgradeOnly =
      hops.length === 1 &&
      requestedUrl.startsWith("http://") &&
      finalUrl.startsWith("https://") &&
      isSamePage(requestedUrl.replace(/^http:/, "https:"), finalUrl);

    if (isHttpsUpgradeOnly) {
      return {
        status: "PASS",
        value: "1 redirect",
        message: `The URL redirected once (HTTP ${hops[0]?.status}) to upgrade from HTTP to HTTPS. This is the expected setup.`,
        details: { count: 1, chain },
      };
    }

    const temporary = hops.filter((hop) => hop.status === 302 || hop.status === 307);

    if (hops.length === 1) {
      return {
        status: "PASS",
        severity: "INFO",
        value: "1 redirect",
        message: `The URL redirected once (HTTP ${hops[0]?.status}) to ${truncate(finalUrl, 80)}.`,
        recommendation:
          temporary.length > 0
            ? "This is a temporary redirect. If the move is permanent, a 301 tells search engines to transfer the old URL's signals to the new one."
            : "No action needed. Linking directly to the final URL saves visitors one round trip.",
        details: { count: 1, chain },
      };
    }

    return {
      status: "WARNING",
      severity: hops.length >= 4 ? "MEDIUM" : "LOW",
      value: plural(hops.length, "redirect"),
      message: `This URL went through ${plural(hops.length, "redirect")} before reaching the final page.`,
      recommendation:
        "Shorten the chain so the first URL points straight at the final destination. Each extra hop delays the page for every visitor who follows the old link.",
      details: { count: hops.length, chain },
    };
  },
);

/* ------------------------------------------------------------------ */
/* Canonical                                                           */
/* ------------------------------------------------------------------ */

export const canonicalCheck = createCheck(
  {
    key: "canonical",
    title: "Canonical URL",
    category: "technical",
    weight: 7,
    guide: "canonical-url",
    why: "A canonical link says 'when several URLs show this same content, this one is the original'. It is how a site avoids splitting its signals across a URL with tracking parameters, a printer-friendly version, and the page itself.",
  },
  ({ page, finalUrl }) => {
    const canonicals = page.canonicals;

    if (canonicals.length === 0) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: "Missing",
        message: "This page has no canonical link element.",
        recommendation:
          "Add a canonical link pointing at this page's preferred URL. It is the clearest way to state which address is the original when the same content is reachable by more than one URL.",
        codeExample: `<link rel="canonical" href="${truncate(finalUrl, 80)}" />`,
      };
    }

    if (canonicals.length > 1) {
      return {
        status: "ERROR",
        severity: "HIGH",
        value: `${canonicals.length} canonical tags`,
        message: `This page declares ${canonicals.length} canonical URLs: ${canonicals
          .map((value) => truncate(value, 60))
          .join(", ")}. Conflicting canonicals are generally ignored.`,
        recommendation:
          "Remove the extra canonical link elements so exactly one remains. Duplicates often come from a theme and a plugin both adding one.",
        details: { canonicals },
      };
    }

    const declared = (canonicals[0] ?? "").trim();

    if (declared === "") {
      return {
        status: "ERROR",
        severity: "HIGH",
        value: "Empty",
        message: "The canonical link element has an empty href attribute.",
        recommendation:
          "Set the href to this page's full, absolute URL, or remove the element entirely.",
        codeExample: `<link rel="canonical" href="${truncate(finalUrl, 80)}" />`,
      };
    }

    // A value containing "://" was clearly meant to be absolute. If it is not
    // a valid http(s) URL, resolving it against the page would quietly turn
    // "ht!tp://example.com" into a same-site path and hide a real typo.
    const looksAbsolute = declared.includes("://");
    const isValidAbsolute = /^https?:\/\//i.test(declared);

    let resolved: URL | null = null;
    try {
      resolved = new URL(declared, finalUrl);
    } catch {
      resolved = null;
    }

    if (resolved === null || (looksAbsolute && !isValidAbsolute)) {
      return {
        status: "ERROR",
        severity: "HIGH",
        value: "Invalid URL",
        message: `The canonical value "${truncate(declared, 80)}" is not a valid URL.`,
        recommendation:
          "Replace it with a complete absolute URL, including https:// and the full domain.",
        codeExample: `<link rel="canonical" href="${truncate(finalUrl, 80)}" />`,
        details: { declared },
      };
    }

    const isAbsolute = /^https?:\/\//i.test(declared);
    const pointsToSelf = isSamePage(resolved, finalUrl);

    if (pointsToSelf && isAbsolute) {
      return {
        status: "PASS",
        value: truncate(resolved.href, 60),
        message: `The canonical URL points at this page: ${resolved.href}`,
        details: { canonical: resolved.href, selfReferencing: true },
      };
    }

    if (pointsToSelf && !isAbsolute) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: "Relative URL",
        message: `The canonical is written as a relative URL ("${truncate(declared, 60)}"), which resolves to this page: ${resolved.href}`,
        recommendation:
          "Relative canonicals are valid but easy to get wrong when a page is served from more than one path. Writing the full absolute URL removes the ambiguity.",
        codeExample: `<link rel="canonical" href="${resolved.href}" />`,
        details: { declared, canonical: resolved.href, selfReferencing: true },
      };
    }

    let currentUrl: URL;
    try {
      currentUrl = new URL(finalUrl);
    } catch {
      currentUrl = resolved;
    }

    const crossSite = !isSameSite(resolved, currentUrl);

    return {
      status: "WARNING",
      severity: crossSite ? "HIGH" : "MEDIUM",
      value: "Points elsewhere",
      message: `The canonical URL points to a different page: ${resolved.href}${
        crossSite ? " — on a different website." : ""
      }`,
      recommendation: crossSite
        ? "A cross-site canonical tells search engines to credit another website with this content. If that is not deliberate, correct the href to this page's own URL."
        : "This tells search engines to treat the other URL as the original and index that instead of this one. If this page should be indexed in its own right, point the canonical at itself.",
      details: { canonical: resolved.href, selfReferencing: false, crossSite },
      confidence: "measured",
    };
  },
);

/* ------------------------------------------------------------------ */
/* Robots meta + X-Robots-Tag                                          */
/* ------------------------------------------------------------------ */

/** Split "noindex, max-snippet:-1" into normalised directive tokens. */
function parseDirectives(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

export const robotsMetaCheck = createCheck(
  {
    key: "robots-meta",
    title: "Robots directives",
    category: "technical",
    weight: 8,
    guide: "robots-txt",
    why: "Robots directives tell search engines what they may do with a page once they have it: whether to index it, follow its links, and how to display it in results. A stray 'noindex' left over from a staging site is one of the most common reasons a page never appears in search.",
  },
  ({ page, fetchResult }) => {
    const metaRobots = page.metaRobots;
    const googlebot = page.metaGooglebot;
    const header = fetchResult.headers["x-robots-tag"] ?? null;

    const all = [
      ...parseDirectives(metaRobots),
      ...parseDirectives(googlebot),
      ...parseDirectives(header),
    ];

    const sources: string[] = [];
    if (metaRobots) sources.push(`meta robots: "${metaRobots}"`);
    if (googlebot) sources.push(`meta googlebot: "${googlebot}"`);
    if (header) sources.push(`X-Robots-Tag header: "${header}"`);

    const hasNoindex = all.includes("noindex") || all.includes("none");
    const hasNofollow = all.includes("nofollow") || all.includes("none");

    const displayDirectives = all.filter((directive) =>
      /^(noarchive|nosnippet|notranslate|noimageindex|max-snippet|max-image-preview|max-video-preview|unavailable_after)/.test(
        directive,
      ),
    );

    if (hasNoindex) {
      return {
        status: "ERROR",
        severity: "CRITICAL",
        value: "noindex",
        message: `This page carries a noindex directive (${sources.join("; ")}). Search engines may be instructed not to index this page.`,
        recommendation:
          "If this page should appear in search results, remove the noindex directive. If it is intentional — a thank-you page, a staging copy, an internal search result — no action is needed.",
        codeExample: '<meta name="robots" content="index, follow" />',
        details: { directives: all, sources, noindex: true, nofollow: hasNofollow },
        confidence: "measured",
      };
    }

    if (hasNofollow) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: "nofollow",
        message: `This page carries a page-level nofollow directive (${sources.join("; ")}). Search engines may be instructed not to follow the links on this page.`,
        recommendation:
          "Remove the page-level nofollow unless it is deliberate. It applies to every link on the page, including your own internal navigation.",
        details: { directives: all, sources, noindex: false, nofollow: true },
      };
    }

    if (displayDirectives.length > 0) {
      return {
        status: "INFO",
        severity: "INFO",
        value: displayDirectives.join(", "),
        message: `This page is indexable. It also sets display directives: ${displayDirectives.join(", ")}.`,
        recommendation:
          "These control how the page may be shown in results (snippet length, image previews, cached copies). No action needed unless they are unintentional.",
        details: { directives: all, sources, noindex: false, nofollow: false },
      };
    }

    if (all.length === 0) {
      return {
        status: "PASS",
        value: "No restrictions",
        message:
          "This page sets no robots directives. With none present, search engines treat the page as indexable by default.",
        details: { directives: [], sources: [], noindex: false, nofollow: false },
      };
    }

    return {
      status: "PASS",
      value: all.join(", "),
      message: `This page sets robots directives that allow indexing: ${all.join(", ")}.`,
      details: { directives: all, sources, noindex: false, nofollow: false },
    };
  },
);

/* ------------------------------------------------------------------ */
/* robots.txt                                                          */
/* ------------------------------------------------------------------ */

export const robotsTxtCheck = createCheck(
  {
    key: "robots-txt",
    title: "robots.txt",
    category: "technical",
    weight: 5,
    guide: "robots-txt",
    why: "robots.txt sits at the root of a site and tells crawlers which paths they may request. A rule that accidentally covers an important section is a quiet but serious problem, because the pages are never fetched in the first place.",
  },
  ({ robotsTxt }) => {
    if (!robotsTxt.retrieved) {
      return {
        status: "UNAVAILABLE",
        value: "Unable to determine",
        message: "We could not retrieve robots.txt for this site.",
        unavailableReason:
          robotsTxt.error ?? "The request for /robots.txt did not return a usable response.",
        recommendation:
          "This does not necessarily mean anything is wrong. Open the file in a browser to confirm it is reachable.",
        details: { url: robotsTxt.url, status: robotsTxt.status },
        confidence: "unavailable",
      };
    }

    if (robotsTxt.status === 404 || robotsTxt.status === 410) {
      return {
        status: "PASS",
        severity: "INFO",
        value: "Not present",
        message:
          "This site has no robots.txt file. That is valid — with no file, crawlers treat the whole site as allowed.",
        recommendation:
          "A robots.txt is optional. Adding one is useful mainly if you need to exclude paths or point crawlers at your sitemap.",
        details: { url: robotsTxt.url, status: robotsTxt.status },
      };
    }

    const blockedByComplexRule =
      robotsTxt.pathVerdict === "unknown" && robotsTxt.matchedRule?.startsWith("Disallow:");

    if (robotsTxt.pathVerdict === "disallowed") {
      return {
        status: "ERROR",
        severity: "CRITICAL",
        value: "Path disallowed",
        message: `robots.txt appears to block this path with the rule "${robotsTxt.matchedRule}". Crawlers that respect robots.txt will not request this page.`,
        recommendation:
          "If this page should be crawled, remove or narrow that rule. Note that blocking a page in robots.txt does not reliably remove it from search results — a noindex directive on the page is the tool for that.",
        details: {
          url: robotsTxt.url,
          matchedRule: robotsTxt.matchedRule,
          sitemaps: robotsTxt.sitemaps,
        },
        confidence: "inferred",
      };
    }

    if (blockedByComplexRule) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: "Potentially blocked",
        message: `robots.txt contains a rule that may cover this path ("${robotsTxt.matchedRule}"), but the file uses patterns that different crawlers interpret differently. We cannot say for certain whether this page is blocked.`,
        recommendation:
          "Confirm with a robots.txt tester in Google Search Console or Bing Webmaster Tools, which evaluate the file exactly as those crawlers do.",
        details: {
          url: robotsTxt.url,
          matchedRule: robotsTxt.matchedRule,
          hasComplexRules: true,
          sitemaps: robotsTxt.sitemaps,
        },
        confidence: "inferred",
      };
    }

    if (robotsTxt.pathVerdict === "unknown") {
      return {
        status: "UNAVAILABLE",
        value: "Unable to determine",
        message:
          "robots.txt was retrieved, but its rules are more complex than we can evaluate with confidence.",
        unavailableReason: "The file uses directives or patterns this tool does not fully model.",
        recommendation:
          "Use the robots.txt tester in Google Search Console to confirm how this page is treated.",
        details: { url: robotsTxt.url, sitemaps: robotsTxt.sitemaps },
        confidence: "unavailable",
      };
    }

    const sitemapNote =
      robotsTxt.sitemaps.length > 0
        ? ` It also references ${plural(robotsTxt.sitemaps.length, "sitemap")}.`
        : " It does not reference a sitemap.";

    return {
      status: "PASS",
      value: "Path allowed",
      message: `robots.txt was found and does not block this page.${sitemapNote}`,
      recommendation:
        robotsTxt.sitemaps.length === 0
          ? "Consider adding a Sitemap: line to robots.txt so crawlers can find your sitemap without guessing."
          : null,
      details: {
        url: robotsTxt.url,
        groups: robotsTxt.groups.length,
        sitemaps: robotsTxt.sitemaps,
        matchedRule: robotsTxt.matchedRule,
      },
      confidence: "inferred",
    };
  },
);

/* ------------------------------------------------------------------ */
/* Sitemap                                                             */
/* ------------------------------------------------------------------ */

export const sitemapCheck = createCheck(
  {
    key: "sitemap",
    title: "XML sitemap",
    category: "technical",
    weight: 4,
    guide: "xml-sitemap",
    why: "A sitemap is a list of the URLs a site considers worth crawling. It does not guarantee anything gets indexed, but it is a reliable way to tell search engines a page exists — particularly for pages that few internal links point to.",
  },
  ({ sitemap }) => {
    if (!sitemap.retrieved) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: "Not found",
        message: `We could not find a sitemap at the usual locations (${sitemap.checkedUrls
          .map((url) => new URL(url).pathname)
          .join(", ")}), and robots.txt did not point to one.`,
        recommendation:
          "A sitemap can live at any address, so this does not prove one is missing. If you do have one, add a 'Sitemap:' line to robots.txt so crawlers can find it. If you do not, most CMS platforms can generate one.",
        unavailableReason: sitemap.error ?? undefined,
        details: { checked: sitemap.checkedUrls },
        confidence: "inferred",
      };
    }

    const countLabel = sitemap.countTruncated
      ? `${sitemap.urlCount}+ URLs`
      : plural(sitemap.urlCount, "URL");

    if (sitemap.kind === "sitemapindex") {
      return {
        status: "PASS",
        value: `Index, ${plural(sitemap.urlCount, "sitemap")}`,
        message: `A sitemap index was found at ${sitemap.foundUrl}, listing ${plural(sitemap.urlCount, "child sitemap")}.`,
        recommendation:
          "We do not download the child sitemaps, so we cannot confirm whether this page is listed in one of them.",
        details: {
          url: sitemap.foundUrl,
          kind: sitemap.kind,
          count: sitemap.urlCount,
          discoveredVia: sitemap.discoveredVia,
        },
        confidence: "measured",
      };
    }

    if (sitemap.containsAuditedUrl === "no") {
      return {
        status: "WARNING",
        severity: "LOW",
        value: "Page not listed",
        message: `A sitemap was found at ${sitemap.foundUrl} listing ${countLabel}, but this page's URL is not among them.`,
        recommendation:
          "If this page should be indexed, add it to the sitemap. Check first whether the sitemap lists a different version of this URL — with or without a trailing slash, for example.",
        details: {
          url: sitemap.foundUrl,
          count: sitemap.urlCount,
          discoveredVia: sitemap.discoveredVia,
        },
      };
    }

    if (sitemap.containsAuditedUrl === "yes") {
      return {
        status: "PASS",
        value: "Listed in sitemap",
        message: `A sitemap was found at ${sitemap.foundUrl} listing ${countLabel}, and this page is included.`,
        details: {
          url: sitemap.foundUrl,
          count: sitemap.urlCount,
          discoveredVia: sitemap.discoveredVia,
        },
      };
    }

    return {
      status: "PASS",
      severity: "INFO",
      value: countLabel,
      message: `A sitemap was found at ${sitemap.foundUrl} listing ${countLabel}. It was too large for us to read in full, so we could not confirm whether this page is listed.`,
      details: {
        url: sitemap.foundUrl,
        count: sitemap.urlCount,
        truncated: sitemap.countTruncated,
      },
      confidence: "inferred",
    };
  },
);

/* ------------------------------------------------------------------ */
/* Language                                                            */
/* ------------------------------------------------------------------ */

/** A loose BCP 47 shape check: "en", "en-GB", "zh-Hant-TW". */
const LANG_PATTERN = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;

export const languageCheck = createCheck(
  {
    key: "language",
    title: "Language declaration",
    category: "technical",
    weight: 4,
    why: "The lang attribute states what language the page is written in. Screen readers use it to choose a voice, browsers use it to offer translation, and search engines use it as one signal when matching a page to a searcher's language.",
  },
  ({ page }) => {
    const lang = page.htmlLang;

    if (!lang) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: "Missing",
        message: "The html element has no lang attribute.",
        recommendation:
          "Add a lang attribute to the html element naming the language of the page content.",
        codeExample: '<html lang="en">',
      };
    }

    if (!LANG_PATTERN.test(lang)) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: truncate(lang, 30),
        message: `The lang attribute is "${lang}", which does not look like a standard language code.`,
        recommendation:
          "Use a BCP 47 language tag, such as en, en-GB, es or zh-Hant. Software that reads this attribute may ignore a value it cannot recognise.",
        codeExample: '<html lang="en-GB">',
        details: { lang },
      };
    }

    return {
      status: "PASS",
      value: lang,
      message: `The page declares its language as "${lang}".`,
      details: { lang, hreflangCount: page.hreflang.length },
    };
  },
);

/* ------------------------------------------------------------------ */
/* Viewport                                                            */
/* ------------------------------------------------------------------ */

export const viewportCheck = createCheck(
  {
    key: "viewport",
    title: "Mobile viewport",
    category: "technical",
    weight: 5,
    why: "Without a viewport meta tag, mobile browsers render a page at desktop width and zoom out, leaving text too small to read. Since most search traffic is mobile, and Google indexes the mobile version of pages, this affects both visitors and how the page is assessed.",
  },
  ({ page }) => {
    const viewport = page.viewport;

    if (!viewport) {
      return {
        status: "WARNING",
        severity: "HIGH",
        value: "Missing",
        message: "This page has no viewport meta tag.",
        recommendation:
          "Add a viewport meta tag so mobile browsers lay the page out at the device's own width.",
        codeExample: '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      };
    }

    const normalised = viewport.toLowerCase().replace(/\s+/g, "");
    const hasDeviceWidth = normalised.includes("width=device-width");
    const blocksZoom =
      normalised.includes("user-scalable=no") ||
      /maximum-scale=(0?\.\d|1(\.0+)?)\b/.test(normalised);

    if (!hasDeviceWidth) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: truncate(viewport, 40),
        message: `A viewport tag is present but does not set width=device-width: "${viewport}".`,
        recommendation:
          "Set width=device-width so the layout matches the width of the device it is viewed on.",
        codeExample: '<meta name="viewport" content="width=device-width, initial-scale=1" />',
        details: { viewport },
      };
    }

    if (blocksZoom) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: "Zoom disabled",
        message: `The viewport is set correctly but prevents zooming: "${viewport}".`,
        recommendation:
          "Remove user-scalable=no and any maximum-scale below 2. Blocking zoom is an accessibility barrier for anyone who needs to enlarge text.",
        details: { viewport },
      };
    }

    return {
      status: "PASS",
      value: truncate(viewport, 40),
      message: `The page sets a mobile viewport: "${viewport}".`,
      details: { viewport },
    };
  },
);

/* ------------------------------------------------------------------ */
/* Character encoding                                                  */
/* ------------------------------------------------------------------ */

export const charsetCheck = createCheck(
  {
    key: "charset",
    title: "Character encoding",
    category: "technical",
    weight: 2,
    why: "The character encoding declaration tells the browser how to turn the page's bytes into letters. Without it, accented characters, curly quotes and non-Latin scripts can render as mojibake — and the same garbling can end up in a search result snippet.",
  },
  ({ page }) => {
    const charset = page.charset;

    if (!charset) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: "Not declared",
        message: "This page does not declare a character encoding.",
        recommendation:
          "Add a charset meta tag as the first element inside the head. UTF-8 is the right answer for almost every site.",
        codeExample: '<meta charset="utf-8" />',
      };
    }

    const normalised = charset.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (normalised === "utf8") {
      return {
        status: "PASS",
        value: charset,
        message: `The page declares UTF-8 encoding ("${charset}").`,
        details: { charset },
      };
    }

    return {
      status: "INFO",
      severity: "INFO",
      value: charset,
      message: `The page declares "${charset}" rather than UTF-8.`,
      recommendation:
        "Legacy encodings still work, but UTF-8 handles every language and is what modern tooling expects. Moving to it avoids a class of character-corruption bugs.",
      details: { charset },
    };
  },
);

/* ------------------------------------------------------------------ */
/* Favicon                                                             */
/* ------------------------------------------------------------------ */

export const faviconCheck = createCheck(
  {
    key: "favicon",
    title: "Favicon",
    category: "technical",
    weight: 2,
    why: "The favicon is the small icon shown in browser tabs, bookmarks, and next to some mobile search results. It is a recognition and trust detail rather than a ranking one.",
  },
  ({ page }) => {
    const favicons = page.favicons;

    if (favicons.length === 0) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: "Not declared",
        message: "No favicon link element was found in the HTML.",
        recommendation:
          "Add a favicon link in the head. Browsers also fall back to /favicon.ico at the site root, so a file there may still be picked up even without this tag.",
        codeExample: '<link rel="icon" href="/favicon.ico" sizes="any" />',
        confidence: "inferred",
      };
    }

    return {
      status: "PASS",
      value: plural(favicons.length, "icon"),
      message: `The page declares ${plural(favicons.length, "favicon link")}.`,
      details: { favicons: favicons.slice(0, 5) },
    };
  },
);
