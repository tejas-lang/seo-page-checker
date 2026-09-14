/**
 * Social metadata checks: Open Graph and Twitter/X cards.
 *
 * These do not affect search rankings. They control what a link to the page
 * looks like when someone shares it — the image, headline and description that
 * appear in a message or a post. They are weighted lightly in the score for
 * exactly that reason.
 */

import { createCheck, truncate } from "./create-check";

/** The four Open Graph properties that actually shape a shared preview. */
const OG_REQUIRED = ["og:title", "og:description", "og:image"] as const;
const OG_RECOMMENDED = ["og:url", "og:type"] as const;

export const openGraphCheck = createCheck(
  {
    key: "open-graph",
    title: "Open Graph",
    category: "social",
    weight: 6,
    why: "Open Graph metadata controls how a page may appear when it is shared — on Facebook, LinkedIn, WhatsApp, Slack, Discord and most messaging apps. Without it, platforms guess, and often pick the wrong image or an unhelpful fragment of text.",
  },
  ({ page, finalUrl }) => {
    const og = page.openGraph;
    const present = Object.keys(og);

    if (present.length === 0) {
      return {
        status: "WARNING",
        severity: "MEDIUM",
        value: "Missing",
        message: "This page has no Open Graph metadata.",
        recommendation:
          "Add Open Graph tags so you control the title, description and image shown when someone shares this page.",
        codeExample: `<meta property="og:title" content="Your page title" />
<meta property="og:description" content="A one-sentence summary." />
<meta property="og:image" content="https://example.com/preview.jpg" />
<meta property="og:url" content="${truncate(finalUrl, 60)}" />
<meta property="og:type" content="website" />`,
        details: { present: [], missing: [...OG_REQUIRED, ...OG_RECOMMENDED] },
      };
    }

    const missingRequired = OG_REQUIRED.filter((key) => !og[key] || og[key]?.trim() === "");
    const missingRecommended = OG_RECOMMENDED.filter((key) => !og[key] || og[key]?.trim() === "");

    const details = {
      present,
      missing: [...missingRequired, ...missingRecommended],
      title: og["og:title"] ?? null,
      description: og["og:description"] ?? null,
      image: og["og:image"] ?? null,
      url: og["og:url"] ?? null,
      type: og["og:type"] ?? null,
    };

    if (missingRequired.length > 0) {
      return {
        status: "WARNING",
        severity: missingRequired.includes("og:image") ? "MEDIUM" : "LOW",
        value: `Partial (${present.length} tags)`,
        message: `Open Graph metadata is incomplete. Missing: ${missingRequired.join(", ")}${
          missingRecommended.length > 0 ? ` (also missing ${missingRecommended.join(", ")})` : ""
        }.`,
        recommendation:
          "Add the missing tags. og:image matters most — a share without an image is far less visible in a feed or a chat.",
        details,
      };
    }

    if (missingRecommended.length > 0) {
      return {
        status: "PASS",
        severity: "INFO",
        value: "Complete",
        message: `Open Graph title, description and image are all set. Optional tags not set: ${missingRecommended.join(", ")}.`,
        recommendation:
          "og:url and og:type are optional refinements — they tell platforms the canonical address and what kind of content this is.",
        details,
      };
    }

    return {
      status: "PASS",
      value: "Complete",
      message: `Open Graph metadata is complete: ${[...OG_REQUIRED, ...OG_RECOMMENDED].join(", ")} are all set.`,
      details,
    };
  },
);

export const twitterCardCheck = createCheck(
  {
    key: "twitter-card",
    title: "Twitter/X card",
    category: "social",
    weight: 4,
    why: "Twitter/X card tags describe how a link should be previewed on that platform. When they are absent, the platform falls back to Open Graph tags, so a page with good Open Graph metadata usually still previews correctly.",
  },
  ({ page }) => {
    const twitter = page.twitter;
    const cardType = twitter["twitter:card"];
    const present = Object.keys(twitter);
    const hasOpenGraph = Object.keys(page.openGraph).length > 0;

    if (present.length === 0) {
      return {
        status: hasOpenGraph ? "INFO" : "WARNING",
        severity: hasOpenGraph ? "INFO" : "LOW",
        value: "Missing",
        message: hasOpenGraph
          ? "This page has no Twitter/X card tags. Because Open Graph tags are present, Twitter/X will normally fall back to those."
          : "This page has no Twitter/X card tags and no Open Graph tags to fall back on.",
        recommendation: hasOpenGraph
          ? "No action needed unless you want a different preview on Twitter/X than elsewhere."
          : "Add at least twitter:card, or add Open Graph tags, which Twitter/X will use as a fallback.",
        codeExample: `<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Your page title" />
<meta name="twitter:description" content="A one-sentence summary." />
<meta name="twitter:image" content="https://example.com/preview.jpg" />`,
        details: { present: [], hasOpenGraphFallback: hasOpenGraph },
      };
    }

    if (!cardType) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: "No card type",
        message: `Twitter/X tags are present (${present.join(", ")}) but twitter:card is not set, which is the tag that selects the preview layout.`,
        recommendation:
          'Add <meta name="twitter:card" content="summary_large_image" /> for a large image preview, or "summary" for a compact one.',
        details: { present },
      };
    }

    const validTypes = ["summary", "summary_large_image", "app", "player"];
    if (!validTypes.includes(cardType.trim())) {
      return {
        status: "WARNING",
        severity: "LOW",
        value: truncate(cardType, 30),
        message: `twitter:card is set to "${cardType}", which is not one of the recognised card types.`,
        recommendation: `Use one of: ${validTypes.join(", ")}.`,
        details: { present, cardType },
      };
    }

    return {
      status: "PASS",
      value: cardType,
      message: `A Twitter/X card is configured as "${cardType}" with ${present.length} tags.`,
      details: {
        present,
        cardType,
        title: twitter["twitter:title"] ?? null,
        description: twitter["twitter:description"] ?? null,
        image: twitter["twitter:image"] ?? null,
      },
    };
  },
);
