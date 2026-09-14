/**
 * On-page checks: title, meta description, headings and image alt text.
 *
 * These are the elements search engines read to work out what a page is about.
 * Note the careful wording throughout: character-count guidance is presented
 * as a display consideration, never as a ranking rule, because no specific
 * length is required by any search engine.
 */

import { createCheck, plural, truncate } from "./create-check";

/* ------------------------------------------------------------------ */
/* Title                                                               */
/* ------------------------------------------------------------------ */

/**
 * Length thresholds, in characters.
 *
 * These are display-width heuristics: search results are laid out in pixels,
 * not characters, so these are indicative only. We flag the extremes, where
 * truncation or thinness is likely, and stay quiet in the broad middle.
 */
const TITLE_SHORT = 20;
const TITLE_LONG = 65;
const TITLE_VERY_LONG = 80;

export const titleCheck = createCheck(
  {
    key: "title",
    title: "Title tag",
    category: "on-page",
    weight: 10,
    guide: "title-tag",
    why: "The title element is the single clearest statement of what a page is about. Search engines commonly use it as the headline of a search result, and browsers use it as the tab label. A page with no title gives search engines nothing to work with.",
  },
  ({ page }) => {
    const titles = page.titles;

    if (titles.length === 0) {
      return {
        status: "ERROR",
        severity: "CRITICAL",
        value: "Missing",
        message: "This page has no title element.",
        recommendation:
          "Add a title element inside the head of the page that describes what this specific page is about.",
        codeExample: "<title>Your page topic — Your site name</title>",
      };
    }

    const primary = titles[0] ?? "";
    const length = primary.length;

    if (primary.trim() === "") {
      return {
        status: "ERROR",
        severity: "CRITICAL",
        value: "Empty",
        message: "A title element exists but contains no text.",
        recommendation: "Add descriptive text inside the title element.",
        codeExample: "<title>Your page topic — Your site name</title>",
        details: { count: titles.length },
      };
    }

    if (titles.length > 1) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: `${titles.length} title tags`,
        message: `This page has ${titles.length} title elements. Browsers and search engines use the first one: "${truncate(primary, 80)}".`,
        recommendation:
          "Remove the extra title elements so there is exactly one, leaving no ambiguity about which applies.",
        details: { titles: titles.map((value) => truncate(value, 120)), length },
      };
    }

    if (length < TITLE_SHORT) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: `${length} characters`,
        message: `The title is "${primary}" (${length} characters), which is short.`,
        recommendation:
          "Consider expanding the title so it describes the page topic more fully. Short titles often leave out words a reader would use to recognise the page.",
        details: { title: primary, length },
      };
    }

    if (length > TITLE_VERY_LONG) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: `${length} characters`,
        message: `The title is ${length} characters long: "${truncate(primary, 100)}".`,
        recommendation:
          "Consider shortening the title so the primary topic appears early. Long titles are often shortened in search results, and the end may not be shown.",
        details: { title: primary, length },
      };
    }

    if (length > TITLE_LONG) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: `${length} characters`,
        message: `The title is ${length} characters long: "${truncate(primary, 100)}".`,
        recommendation:
          "This may be shortened when displayed in search results. Putting the most important words first is a safe habit.",
        details: { title: primary, length },
      };
    }

    return {
      status: "PASS",
      value: `${length} characters`,
      message: `This page has one title element: "${primary}".`,
      details: { title: primary, length },
    };
  },
);

/* ------------------------------------------------------------------ */
/* Meta description                                                    */
/* ------------------------------------------------------------------ */

const DESCRIPTION_SHORT = 70;
const DESCRIPTION_LONG = 160;
const DESCRIPTION_VERY_LONG = 200;

export const metaDescriptionCheck = createCheck(
  {
    key: "meta-description",
    title: "Meta description",
    category: "on-page",
    weight: 8,
    guide: "meta-description",
    why: "A meta description is a short summary of the page. Search engines may use it as the snippet under a result, which makes it a chance to explain to a person why the page is worth opening. It is not a ranking factor, and search engines often write their own snippet instead — but when they do use it, you control the wording.",
  },
  ({ page }) => {
    const descriptions = page.metaDescriptions;

    if (descriptions.length === 0) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: "Missing",
        message: "This page has no meta description.",
        recommendation:
          "Add a meta description summarising the page in a sentence or two. Search engines may generate a different snippet, but this gives them your preferred wording.",
        codeExample:
          '<meta name="description" content="A short, specific summary of what this page offers." />',
      };
    }

    const primary = descriptions[0] ?? "";
    const length = primary.length;

    if (primary.trim() === "") {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: "Empty",
        message: "A meta description tag exists but its content is empty.",
        recommendation: "Write a summary of the page in the content attribute, or remove the tag.",
        details: { count: descriptions.length },
      };
    }

    if (descriptions.length > 1) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: `${descriptions.length} tags`,
        message: `This page has ${descriptions.length} meta description tags. The first one is used: "${truncate(primary, 90)}".`,
        recommendation: "Remove the duplicates so only one meta description remains.",
        details: { descriptions: descriptions.map((value) => truncate(value, 200)), length },
      };
    }

    if (length < DESCRIPTION_SHORT) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: `${length} characters`,
        message: `The meta description is ${length} characters: "${primary}".`,
        recommendation:
          "Consider expanding it. A very short description leaves unused space in a search snippet where you could explain the page.",
        details: { description: primary, length },
      };
    }

    if (length > DESCRIPTION_VERY_LONG) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: `${length} characters`,
        message: `The meta description is ${length} characters long.`,
        recommendation:
          "Consider shortening it so the key message appears early. Long descriptions are usually cut off when displayed.",
        details: { description: truncate(primary, 300), length },
      };
    }

    if (length > DESCRIPTION_LONG) {
      return {
        status: "PASS",
        severity: "INFO",
        value: `${length} characters`,
        message: `The meta description is ${length} characters, slightly above the length that is typically displayed in full.`,
        recommendation:
          "No action needed, but front-loading the most important words is a safe habit.",
        details: { description: truncate(primary, 300), length },
      };
    }

    return {
      status: "PASS",
      value: `${length} characters`,
      message: `This page has a meta description: "${primary}".`,
      details: { description: primary, length },
    };
  },
);

/* ------------------------------------------------------------------ */
/* H1                                                                  */
/* ------------------------------------------------------------------ */

export const h1Check = createCheck(
  {
    key: "h1",
    title: "H1 heading",
    category: "on-page",
    weight: 8,
    guide: "h1-tag",
    why: "The H1 is the main on-page heading. It tells a reader — and any software reading the page, including screen readers and search engines — what the page is about in its own words, independently of the title tag.",
  },
  ({ page }) => {
    const h1s = page.headings.filter((heading) => heading.level === 1);
    const nonEmpty = h1s.filter((heading) => !heading.isEmpty);

    if (h1s.length === 0) {
      return {
        status: "WARNING",
        severity: "HIGH",
        value: "Missing",
        message: "This page has no H1 heading.",
        recommendation:
          "Add a single H1 that states the main topic of the page. It is usually the visible headline at the top of the content.",
        codeExample: "<h1>The main topic of this page</h1>",
      };
    }

    if (nonEmpty.length === 0) {
      return {
        status: "WARNING",
        severity: "HIGH",
        value: `${h1s.length} empty`,
        message: `This page has ${plural(h1s.length, "H1 heading")}, but ${h1s.length === 1 ? "it contains" : "they contain"} no text.`,
        recommendation:
          "Put the page's main heading text inside the H1. If it is being used purely as a styling hook or holds only a background image, use a div instead.",
      };
    }

    if (h1s.length > 1) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: `${h1s.length} H1 headings`,
        message: `This page has ${plural(h1s.length, "H1 heading")}: ${nonEmpty
          .slice(0, 3)
          .map((heading) => `"${truncate(heading.text, 50)}"`)
          .join(", ")}${nonEmpty.length > 3 ? ", …" : ""}.`,
        recommendation:
          "Multiple H1s are valid HTML and are not automatically a problem. Still, a single H1 makes the main topic unambiguous — consider demoting the secondary ones to H2.",
        details: { count: h1s.length, headings: nonEmpty.map((heading) => heading.text) },
      };
    }

    const only = nonEmpty[0];
    return {
      status: "PASS",
      value: truncate(only?.text ?? "", 60),
      message: `This page has one H1: "${only?.text ?? ""}".`,
      details: { count: 1, text: only?.text ?? "" },
    };
  },
);

/* ------------------------------------------------------------------ */
/* Heading structure                                                   */
/* ------------------------------------------------------------------ */

export const headingStructureCheck = createCheck(
  {
    key: "heading-structure",
    title: "Heading structure",
    category: "on-page",
    weight: 5,
    guide: "h1-tag",
    why: "Headings form the outline of a page. When the levels descend in order (H1, then H2, then H3) both people using screen readers and software parsing the page can follow how sections relate to each other.",
  },
  ({ page }) => {
    const headings = page.headings;

    if (headings.length === 0) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: "No headings",
        message: "No heading elements (H1–H6) were found on this page.",
        recommendation:
          "Break the content into sections with headings. This helps readers scan the page and makes the structure explicit.",
      };
    }

    const counts = {
      h1: headings.filter((h) => h.level === 1).length,
      h2: headings.filter((h) => h.level === 2).length,
      h3: headings.filter((h) => h.level === 3).length,
      h4: headings.filter((h) => h.level === 4).length,
      h5: headings.filter((h) => h.level === 5).length,
      h6: headings.filter((h) => h.level === 6).length,
    };

    const empty = headings.filter((heading) => heading.isEmpty);

    // A "skip" is jumping more than one level deeper, e.g. H2 straight to H4.
    const skips: string[] = [];
    let previousLevel = 0;
    for (const heading of headings) {
      if (previousLevel > 0 && heading.level > previousLevel + 1) {
        skips.push(`H${previousLevel} → H${heading.level}`);
      }
      previousLevel = heading.level;
    }

    const summary = `${counts.h1} H1, ${counts.h2} H2, ${counts.h3} H3`;

    if (empty.length > 0) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: `${plural(empty.length, "empty heading")}`,
        message: `${plural(empty.length, "heading")} on this page ${empty.length === 1 ? "contains" : "contain"} no text. In total: ${summary}.`,
        recommendation:
          "Remove empty headings or give them text. They are usually left behind by a template or used for spacing, and they add confusing entries to the page outline.",
        details: { counts, emptyCount: empty.length, skips },
      };
    }

    if (skips.length > 0) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: `${plural(skips.length, "skipped level")}`,
        message: `The heading levels skip a step ${skips.length === 1 ? "once" : `${skips.length} times`} (${[...new Set(skips)].join(", ")}). In total: ${summary}.`,
        recommendation:
          "Use heading levels in order so each section sits one level below its parent. This is a structure improvement rather than an urgent fix.",
        details: { counts, skips },
      };
    }

    return {
      status: "PASS",
      value: summary,
      message: `The page uses ${headings.length} headings in a consistent order: ${summary}.`,
      details: { counts, skips: [] },
    };
  },
);

/* ------------------------------------------------------------------ */
/* Image alt text                                                      */
/* ------------------------------------------------------------------ */

export const imageAltCheck = createCheck(
  {
    key: "image-alt",
    title: "Image alt text",
    category: "on-page",
    weight: 6,
    guide: "image-alt-text",
    why: "Alt text describes an image to anyone who cannot see it, including screen reader users and search engines. An image that carries meaning needs a description; a purely decorative image should have an empty alt attribute so assistive software knows to skip it.",
  },
  ({ page }) => {
    const images = page.images;

    if (images.length === 0) {
      return {
        status: "INFO",
        severity: "INFO",
        value: "No images",
        message: "No image elements were found on this page.",
        recommendation: null,
        details: { total: 0 },
      };
    }

    const missing = images.filter((image) => !image.hasAltAttribute);
    const decorative = images.filter((image) => image.hasAltAttribute && image.alt === "");
    const described = images.filter(
      (image) => image.hasAltAttribute && (image.alt ?? "").trim() !== "",
    );

    // An image inside a link with no alt text is worse than a plain one: the
    // link ends up with no accessible name at all.
    const linkedWithoutAlt = images.filter(
      (image) => image.isLinked && (!image.hasAltAttribute || (image.alt ?? "").trim() === ""),
    );

    const details = {
      total: images.length,
      described: described.length,
      decorative: decorative.length,
      missing: missing.length,
      linkedWithoutAlt: linkedWithoutAlt.length,
      examples: missing.slice(0, 5).map((image) => image.src ?? "(no src attribute)"),
    };

    if (missing.length === 0) {
      const decorativeNote =
        decorative.length > 0
          ? ` ${plural(decorative.length, "image")} ${decorative.length === 1 ? "uses" : "use"} an empty alt attribute, which is correct for decorative images.`
          : "";

      return {
        status: "PASS",
        value: `${images.length}/${images.length} have alt`,
        message: `All ${plural(images.length, "image")} on this page have an alt attribute.${decorativeNote}`,
        details,
      };
    }

    const proportion = missing.length / images.length;
    const severity = linkedWithoutAlt.length > 0 || proportion > 0.5 ? "MEDIUM" : "LOW";

    return {
      status: "WARNING",
      severity,
      value: `${plural(missing.length, "image")} missing alt`,
      message: `${plural(missing.length, "image")} of ${images.length} ${missing.length === 1 ? "has" : "have"} no alt attribute.${
        linkedWithoutAlt.length > 0
          ? ` ${plural(linkedWithoutAlt.length, "of these is", "of these are")} inside a link, so the link has no text description at all.`
          : ""
      }`,
      recommendation:
        "Add an alt attribute to each image. Describe what the image shows if it carries meaning, or use alt=\"\" if it is purely decorative — an empty alt is the correct answer for decoration, not a mistake.",
      codeExample:
        '<img src="/chart.png" alt="Bar chart showing revenue doubling between 2023 and 2024" />\n<img src="/divider.png" alt="" />',
      details,
    };
  },
);
