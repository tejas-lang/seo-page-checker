/**
 * Content checks: how much readable text the page has and how it is organised.
 *
 * A standing warning in this file: there is no correct word count for SEO.
 * Search engines do not reward length. What we can honestly report is whether
 * a page has so little text that there is nothing for a search engine to
 * understand, and whether long text is broken into sections. Everything else
 * is reported as an observation, not a target.
 */

import { createCheck, plural } from "./create-check";

/** Below this, a page has essentially no textual content in the served HTML. */
const VERY_THIN = 100;
/** Below this, the page is short — sometimes correct, often unintentional. */
const THIN = 300;

export const wordCountCheck = createCheck(
  {
    key: "word-count",
    title: "Word count",
    category: "content",
    weight: 7,
    why: "Search engines need text to work out what a page is about. There is no required length, and long pages are not rewarded for being long — but a page with almost no text gives a search engine very little to go on.",
  },
  ({ page }) => {
    const { wordCount, paragraphCount } = page.text;

    if (wordCount < VERY_THIN) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: plural(wordCount, "word"),
        message: `The served HTML contains ${plural(wordCount, "word")} of readable text.`,
        recommendation:
          "This is very little text for a search engine to interpret. If the page's content is loaded by JavaScript after the page opens, what you see in a browser will be more than what we measured here — check the 'Content rendering' result below.",
        details: { wordCount, paragraphCount },
      };
    }

    if (wordCount < THIN) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: plural(wordCount, "word"),
        message: `The page contains ${plural(wordCount, "word")} of readable text.`,
        recommendation:
          "Short pages are perfectly valid — a contact page or a product listing does not need an essay. Consider whether this page answers its topic fully enough for a visitor who arrives from search.",
        details: { wordCount, paragraphCount },
      };
    }

    return {
      status: "PASS",
      value: plural(wordCount, "word"),
      message: `The page contains ${plural(wordCount, "word")} of readable text across ${plural(paragraphCount, "paragraph")}.`,
      recommendation: null,
      details: { wordCount, paragraphCount },
    };
  },
);

export const contentStructureCheck = createCheck(
  {
    key: "content-structure",
    title: "Content structure",
    category: "content",
    weight: 5,
    why: "Long text without subheadings is hard to scan. Breaking content into sections with headings helps a reader find the part they came for, and gives search engines a clearer picture of what each part of the page covers.",
  },
  ({ page }) => {
    const { wordCount, paragraphCount } = page.text;
    const subheadings = page.headings.filter(
      (heading) => heading.level >= 2 && heading.level <= 4 && !heading.isEmpty,
    ).length;

    if (wordCount < THIN) {
      // There is not enough text here to judge whether it is well organised.
      // Reporting this as "informational" would award full marks for an empty
      // page — so it is excluded from the score instead. The thinness itself
      // is already reported by the word count check; counting it twice would
      // be double-penalising, and awarding points for it would be worse.
      return {
        status: "UNAVAILABLE",
        value: "Not enough text",
        message: `The page has ${plural(subheadings, "subheading")}, but only ${plural(wordCount, "word")} of text.`,
        unavailableReason:
          "There is too little content on this page to assess how it is structured.",
        recommendation: null,
        confidence: "unavailable",
        details: { wordCount, subheadings, paragraphCount },
      };
    }

    if (wordCount > 600 && subheadings === 0) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: "No subheadings",
        message: `The page has ${plural(wordCount, "word")} of text and no H2–H4 subheadings.`,
        recommendation:
          "Break the content into sections and give each one a subheading. This is one of the cheapest readability improvements available.",
        details: { wordCount, subheadings: 0, paragraphCount },
      };
    }

    if (wordCount > 1200 && subheadings < 3) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: plural(subheadings, "subheading"),
        message: `The page has ${plural(wordCount, "word")} of text but only ${plural(subheadings, "subheading")}.`,
        recommendation:
          "Consider adding more subheadings so the page can be scanned. A rough guide is one every few hundred words, wherever the topic shifts.",
        details: { wordCount, subheadings, paragraphCount },
      };
    }

    if (paragraphCount === 0 && wordCount > THIN) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: "No paragraphs",
        message: `The page has ${plural(wordCount, "word")} of text but no paragraph elements.`,
        recommendation:
          "Wrap body text in p elements rather than using line breaks or styled divs. It gives the document a real structure that software can follow.",
        details: { wordCount, subheadings, paragraphCount: 0 },
      };
    }

    return {
      status: "PASS",
      value: `${plural(subheadings, "subheading")}, ${plural(paragraphCount, "paragraph")}`,
      message: `The content is organised into ${plural(subheadings, "subheading")} and ${plural(paragraphCount, "paragraph")}.`,
      details: { wordCount, subheadings, paragraphCount },
    };
  },
);

/**
 * This check exists to be honest about a real limitation of the tool.
 *
 * We read the HTML as the server sends it, without running JavaScript. If a
 * site renders its content in the browser, the HTML we analysed is nearly
 * empty even though the page looks full to a visitor. Rather than silently
 * reporting "3 words" and letting the user draw the wrong conclusion, we name
 * what is happening.
 */
export const renderingCheck = createCheck(
  {
    key: "content-rendering",
    title: "Content rendering",
    category: "content",
    weight: 3,
    why: "This tool reads the HTML exactly as the server sends it, and does not run JavaScript. Search engines do render JavaScript, but rendering happens later and is not guaranteed for every page, so content present in the initial HTML is the most reliable.",
  },
  ({ page }) => {
    const { wordCount, textToHtmlRatio } = page.text;
    const ratioPercent = Math.round(textToHtmlRatio * 1000) / 10;

    // Lots of markup, almost no text: the classic signature of a page whose
    // content arrives via JavaScript after load.
    const looksClientRendered = wordCount < 150 && page.htmlBytes > 15_000;

    if (looksClientRendered) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: `${ratioPercent}% text`,
        message: `The HTML is ${Math.round(page.htmlBytes / 1024)} KB but contains only ${plural(wordCount, "word")} of readable text (${ratioPercent}% of the document).`,
        recommendation:
          "This pattern usually means the content is rendered in the browser by JavaScript. Everything this report says about your text, headings and links describes the initial HTML only. If that is the case, consider server-side rendering or pre-rendering so the content is present when the page is first fetched.",
        details: { wordCount, htmlBytes: page.htmlBytes, ratioPercent },
        confidence: "inferred",
      };
    }

    return {
      status: "PASS",
      value: `${ratioPercent}% text`,
      message: `Readable text makes up ${ratioPercent}% of the HTML document (${plural(wordCount, "word")} in ${Math.round(page.htmlBytes / 1024)} KB). The content is present in the initial HTML.`,
      recommendation: null,
      details: { wordCount, htmlBytes: page.htmlBytes, ratioPercent },
      confidence: "measured",
    };
  },
);
