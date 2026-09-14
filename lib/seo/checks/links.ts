/**
 * Link checks.
 *
 * SCOPE NOTE, stated plainly in the results too: this is a page checker, so we
 * analyse the STRUCTURE of the links on the page. We do not request them. That
 * means we never claim a link is broken — verifying that would mean firing a
 * request at every destination, which is slow, expensive, and rude to the
 * sites being linked to. A future version can add opt-in link verification.
 */

import { createCheck, plural, truncate } from "./create-check";

/** Anchor text that describes the click rather than the destination. */
const UNINFORMATIVE_ANCHORS = new Set([
  "click here",
  "here",
  "read more",
  "more",
  "learn more",
  "this",
  "link",
  "this link",
  "go",
  "continue",
  "details",
  "info",
  "download",
]);

export const internalLinksCheck = createCheck(
  {
    key: "internal-links",
    title: "Internal links",
    category: "links",
    weight: 5,
    why: "Internal links are how a visitor — and a crawler — moves between the pages of a site. A page that nothing links to is hard to discover, and a page that links nowhere is a dead end for anyone who reaches it.",
  },
  ({ page }) => {
    const internal = page.links.filter((link) => link.kind === "internal");
    const unique = new Set(internal.map((link) => link.resolved).filter(Boolean));
    const nofollowed = internal.filter((link) => link.isNofollow);

    if (internal.length === 0) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: "0 internal links",
        message: "This page contains no links to other pages on the same site.",
        recommendation:
          "Add links to related pages. Without them, this page is a dead end for visitors and gives crawlers no route onward.",
        details: { total: 0, unique: 0, nofollowed: 0 },
      };
    }

    const details = {
      total: internal.length,
      unique: unique.size,
      nofollowed: nofollowed.length,
      samples: [...unique].slice(0, 10),
    };

    if (nofollowed.length > 0 && nofollowed.length === internal.length) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: `${internal.length} (all nofollow)`,
        message: `All ${plural(internal.length, "internal link")} on this page carry rel="nofollow".`,
        recommendation:
          "Nofollow on your own internal links asks search engines not to follow routes through your own site. Unless this is deliberate, remove it from internal links.",
        details,
      };
    }

    return {
      status: "PASS",
      value: plural(internal.length, "internal link"),
      message: `This page has ${plural(internal.length, "internal link")} pointing to ${plural(unique.size, "unique page")} on the same site.`,
      recommendation: null,
      details,
    };
  },
);

export const externalLinksCheck = createCheck(
  {
    key: "external-links",
    title: "External links",
    category: "links",
    weight: 3,
    why: "Linking out to other sites is normal and useful — it is how you cite a source or point somewhere more authoritative. The rel attribute is how you say what kind of link it is: sponsored for paid placements, ugc for user-submitted content, nofollow for links you do not want to endorse.",
  },
  ({ page }) => {
    const external = page.links.filter((link) => link.kind === "external");

    if (external.length === 0) {
      return {
        status: "INFO",
        severity: "INFO",
        value: "0 external links",
        message: "This page does not link to any other websites.",
        recommendation: null,
        details: { total: 0 },
      };
    }

    const nofollow = external.filter((link) => link.isNofollow).length;
    const sponsored = external.filter((link) => link.isSponsored).length;
    const ugc = external.filter((link) => link.isUgc).length;
    const hosts = new Set(
      external
        .map((link) => {
          try {
            return new URL(link.resolved ?? "").hostname;
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    );

    const annotations: string[] = [];
    if (nofollow > 0) annotations.push(`${nofollow} nofollow`);
    if (sponsored > 0) annotations.push(`${sponsored} sponsored`);
    if (ugc > 0) annotations.push(`${ugc} ugc`);

    return {
      status: "PASS",
      value: plural(external.length, "external link"),
      message: `This page links out to ${plural(hosts.size, "other website")} across ${plural(external.length, "link")}${
        annotations.length > 0 ? ` (${annotations.join(", ")})` : ""
      }.`,
      recommendation:
        nofollow + sponsored + ugc === 0
          ? "No rel attributes are set on the outbound links. That is fine for ordinary citations. If any of these are paid or user-submitted, mark them rel=\"sponsored\" or rel=\"ugc\"."
          : null,
      details: {
        total: external.length,
        uniqueHosts: hosts.size,
        nofollow,
        sponsored,
        ugc,
        samples: [...hosts].slice(0, 10),
      },
    };
  },
);

export const linkQualityCheck = createCheck(
  {
    key: "link-quality",
    title: "Link quality",
    category: "links",
    weight: 4,
    why: "Link text is the description of where a link goes. Search engines use it as a clue about the destination, and screen reader users often navigate by jumping between links, hearing only the link text out of context. 'Click here' tells neither of them anything.",
  },
  ({ page }) => {
    const links = page.links;

    if (links.length === 0) {
      return {
        status: "INFO",
        severity: "INFO",
        value: "No links",
        message: "No links were found on this page.",
        recommendation: null,
        details: { total: 0 },
      };
    }

    const empty = links.filter((link) => link.kind === "empty");
    const javascriptLinks = links.filter((link) => link.kind === "javascript");
    const navigational = links.filter(
      (link) => link.kind === "internal" || link.kind === "external",
    );

    const emptyText = navigational.filter((link) => link.anchorText === "");
    const uninformative = navigational.filter((link) =>
      UNINFORMATIVE_ANCHORS.has(link.anchorText.toLowerCase().replace(/[.!…»>]+$/, "").trim()),
    );

    // A new-tab link without rel="noopener" hands the opened page a reference
    // back to yours. Modern browsers imply noopener, so this is a low-priority
    // hygiene note rather than an urgent hole.
    const unsafeTargets = navigational.filter(
      (link) =>
        link.target === "_blank" &&
        !link.rel.includes("noopener") &&
        !link.rel.includes("noreferrer") &&
        link.kind === "external",
    );

    const details = {
      total: links.length,
      empty: empty.length,
      javascript: javascriptLinks.length,
      emptyAnchorText: emptyText.length,
      uninformativeAnchorText: uninformative.length,
      unsafeNewTab: unsafeTargets.length,
      uninformativeExamples: [...new Set(uninformative.map((link) => link.anchorText))].slice(0, 5),
      fragments: links.filter((link) => link.kind === "fragment").length,
      mailto: links.filter((link) => link.kind === "mailto").length,
      tel: links.filter((link) => link.kind === "tel").length,
    };

    const problems: string[] = [];
    if (empty.length > 0) problems.push(`${plural(empty.length, "link")} with an empty href`);
    if (javascriptLinks.length > 0) {
      problems.push(`${plural(javascriptLinks.length, "javascript: link")}`);
    }
    if (emptyText.length > 0) problems.push(`${plural(emptyText.length, "link")} with no link text`);
    if (uninformative.length > 0) {
      problems.push(`${plural(uninformative.length, "link")} using non-descriptive text`);
    }

    if (problems.length === 0 && unsafeTargets.length === 0) {
      return {
        status: "PASS",
        value: `${links.length} links checked`,
        message: `All ${plural(navigational.length, "navigational link")} have a usable destination and descriptive link text.`,
        details,
      };
    }

    if (problems.length === 0) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: `${plural(unsafeTargets.length, "link")} missing rel`,
        message: `${plural(unsafeTargets.length, "external link")} open${unsafeTargets.length === 1 ? "s" : ""} in a new tab without rel="noopener".`,
        recommendation:
          'Add rel="noopener" to links that use target="_blank". Current browsers apply it automatically, so this is a hygiene improvement rather than an active risk.',
        details,
      };
    }

    const severity = empty.length + emptyText.length > 5 ? "MEDIUM" : "LOW";

    return {
      status: "WARNING",
      severity,
      value: problems[0] ?? "Issues found",
      message: `This page has ${problems.join(", ")}.${
        uninformative.length > 0
          ? ` Examples: ${details.uninformativeExamples.map((text) => `"${truncate(text, 24)}"`).join(", ")}.`
          : ""
      }`,
      recommendation:
        "Give every link text that describes its destination, and remove links with an empty href. Where JavaScript handles the click, use a button element instead of a link that goes nowhere.",
      details,
    };
  },
);
