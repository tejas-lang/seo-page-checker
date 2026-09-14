/**
 * Generates SEO-CHECKS.md and SCORING.md from the code itself.
 *
 * WHY GENERATE THEM: documentation that lists 26 checks and their weights goes
 * stale the first time somebody adds a check and forgets to edit the markdown.
 * Deriving both files from `lib/seo/registry.ts` and `lib/seo/scoring.ts` means
 * the numbers in the documentation cannot disagree with the numbers in the
 * product.
 *
 * Run it with:  npm run docs:generate
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { checkRegistry } from "../lib/seo/registry";
import {
  CATEGORY_WEIGHTS,
  SCORE_BANDS,
  SEVERITY_DEDUCTIONS,
  scoringExplanation,
} from "../lib/seo/scoring";
import { CATEGORY_DESCRIPTIONS, CATEGORY_LABELS, CHECK_CATEGORIES } from "../lib/seo/types";

const root = resolve(import.meta.dirname, "..");

/** Detection notes and stated limits, keyed by check. Prose belongs here. */
const CHECK_NOTES: Record<string, { detection: string; limitation: string }> = {
  "http-status": {
    detection: "The status code of the final response, after redirects.",
    limitation:
      "A single request from one location at one moment. A server that is intermittently failing may answer normally for us.",
  },
  https: {
    detection: "The protocol of the final URL, plus whether an HTTP address redirected to HTTPS.",
    limitation:
      "We do not inspect the certificate itself — its issuer, expiry or chain. A connection that fails TLS is reported as a connection failure instead.",
  },
  redirects: {
    detection: "Every hop is recorded as we follow it manually, with its status code and target.",
    limitation:
      "We follow at most 10 hops. A chain longer than that is reported as TOO_MANY_REDIRECTS rather than analysed.",
  },
  "robots-meta": {
    detection:
      'The robots and googlebot meta tags, plus the X-Robots-Tag response header. Directives are parsed as a comma-separated list.',
    limitation:
      "We report what the page instructs. Whether a search engine acts on it depends on factors no external tool can observe, so the wording is always 'may be instructed', never 'will not be indexed'.",
  },
  canonical: {
    detection:
      'Every link element whose rel includes "canonical". The href is resolved to an absolute URL and compared with the audited page.',
    limitation:
      "A canonical is a hint, not a command. Search engines weigh it against your internal links, sitemap and redirects and may choose differently.",
  },
  "robots-txt": {
    detection:
      "Fetches /robots.txt, parses the user-agent groups, and evaluates the audited path using longest-match-wins with allow beating disallow on ties.",
    limitation:
      "Wildcard and $-anchored patterns are interpreted differently by different crawlers. Where the file uses them, the result is downgraded to 'potentially blocked' rather than asserted. Use Google Search Console for a definitive answer.",
  },
  sitemap: {
    detection:
      "Looks for a sitemap declared in robots.txt first, then at /sitemap.xml and /sitemap_index.xml. Confirms it is valid XML and counts its <loc> entries.",
    limitation:
      "A sitemap can live at any address, so not finding one proves nothing — the result says 'not found at the usual locations'. Child sitemaps of an index are not fetched, so membership cannot be confirmed for an index.",
  },
  language: {
    detection: "The lang attribute on the html element, validated against a BCP 47 shape.",
    limitation:
      "We check the shape of the code, not whether it matches the language the page is actually written in.",
  },
  viewport: {
    detection:
      'The viewport meta tag, checked for width=device-width and for settings that block zooming.',
    limitation:
      "Its presence does not mean the page is actually responsive. That needs rendering at multiple widths, which this tool does not do.",
  },
  charset: {
    detection: "A charset meta tag, or a charset declared in a Content-Type meta http-equiv.",
    limitation: "We report what is declared, not whether the bytes actually match that encoding.",
  },
  favicon: {
    detection: "Link elements whose rel includes icon, shortcut, apple-touch-icon or mask-icon.",
    limitation:
      "Browsers also fall back to /favicon.ico at the site root, which we do not request. A site with no tag may still show an icon.",
  },
  title: {
    detection: "Every title element outside SVG. Text and character count are reported exactly.",
    limitation:
      "Length guidance is about display width, not a rule. Search results are laid out in pixels, so wide capitals truncate sooner than narrow lowercase. We cannot tell whether the title is duplicated elsewhere on the site — that needs a full crawl.",
  },
  "meta-description": {
    detection: 'Every meta tag named "description", case-insensitively.',
    limitation:
      "Not a ranking factor, and search engines frequently write their own snippet instead. Length guidance is about display, not a requirement.",
  },
  h1: {
    detection: "All h1 elements, with their text, in document order.",
    limitation:
      "Multiple H1s are valid HTML and are reported as a low-severity observation, not a failure. There is no good evidence they harm rankings.",
  },
  "heading-structure": {
    detection:
      "Every h1–h6 in document order, checked for empty headings and for levels that skip a step.",
    limitation:
      "Structure is judged mechanically. We cannot tell whether a heading accurately describes the section beneath it.",
  },
  "image-alt": {
    detection:
      "Every img element, sorted into described, explicitly decorative (alt=\"\") and missing the attribute entirely. Images inside links are tracked separately.",
    limitation:
      "An empty alt is correct for decoration and is never flagged. We cannot judge whether an existing description is a good one — that needs someone who can see the image. Images added by JavaScript are not seen at all.",
  },
  "word-count": {
    detection:
      "Visible text after removing script, style, noscript, template, svg and iframe content. A word must contain at least one letter or digit.",
    limitation:
      "There is no correct word count for SEO. This is an observation, not a target. Content rendered by JavaScript is not counted.",
  },
  "content-structure": {
    detection: "The ratio of H2–H4 subheadings and paragraph elements to the word count.",
    limitation:
      "On a page with too little text to assess, this returns 'unable to determine' and is excluded from the score rather than awarding full marks for emptiness.",
  },
  "content-rendering": {
    detection:
      "Compares the readable text against the size of the HTML document. A large document with very little text is the signature of client-side rendering.",
    limitation:
      "Inferred, not measured. A page can legitimately be markup-heavy. This check exists to stop users misreading a low word count caused by our own inability to run JavaScript.",
  },
  "internal-links": {
    detection:
      "Anchor elements resolving to the same registrable domain, counted in total and as unique destinations.",
    limitation:
      "Structure only. We never request a link, so we never claim one is broken. The public suffix list used is short, so an unusual suffix may misclassify a subdomain.",
  },
  "external-links": {
    detection:
      "Anchor elements resolving to a different registrable domain, with their rel attributes.",
    limitation:
      "External links are not a fault, and this check never treats them as one. We do not evaluate the quality or reputation of destinations.",
  },
  "link-quality": {
    detection:
      "Empty hrefs, javascript: hrefs, links with no text, generic anchor text, and external new-tab links missing rel=noopener.",
    limitation:
      "The list of non-descriptive phrases is fixed and English-only. Link text can be poor in ways this does not catch.",
  },
  "json-ld": {
    detection:
      'Every script of type application/ld+json, parsed with JSON.parse. All @type values are collected, including inside @graph.',
    limitation:
      "This is basic detection, not validation. Schema.org properties are not checked and this is NOT a rich results test — eligibility rules are not fully published. Structured data is not a ranking factor and does not guarantee a rich result.",
  },
  microdata: {
    detection: "itemtype attributes (microdata) and typeof attributes (RDFa).",
    limitation: "Presence and type only. Property completeness is not validated.",
  },
  "open-graph": {
    detection:
      "Meta tags with an og: prefix, read from either the property or the name attribute, since CMSs emit both.",
    limitation:
      "Affects how a link previews when shared, not search rankings. We do not fetch og:image to confirm it exists or check its dimensions.",
  },
  "twitter-card": {
    detection: "Meta tags with a twitter: prefix, and the card type validated against the four recognised values.",
    limitation:
      "Twitter/X falls back to Open Graph when these are absent, so their absence is reported as informational when Open Graph is present.",
  },
};

/* ------------------------------------------------------------------ */
/* SEO-CHECKS.md                                                       */
/* ------------------------------------------------------------------ */

function generateChecksDoc(): string {
  const lines: string[] = [];

  lines.push("# SEO checks");
  lines.push("");
  lines.push(
    "<!-- GENERATED FILE. Edit lib/seo/registry.ts or scripts/generate-docs.ts, then run `npm run docs:generate`. -->",
  );
  lines.push("");
  lines.push(
    `Every check this tool runs: what it measures, how it detects it, how much it weighs, and — importantly — what it cannot tell you.`,
  );
  lines.push("");
  lines.push(`There are **${checkRegistry.length} checks** across six categories.`);
  lines.push("");

  /* Summary table */
  lines.push("## Summary");
  lines.push("");
  lines.push("| Check | Category | Weight | Guide |");
  lines.push("| --- | --- | ---: | --- |");
  for (const check of checkRegistry) {
    const guide = check.guide ? `[${check.guide}](/seo-guides/${check.guide})` : "—";
    lines.push(
      `| \`${check.key}\` | ${CATEGORY_LABELS[check.category]} | ${check.weight} | ${guide} |`,
    );
  }
  lines.push("");

  /* Per-category detail */
  for (const category of CHECK_CATEGORIES) {
    const checks = checkRegistry.filter((check) => check.category === category);
    if (checks.length === 0) continue;

    const categoryTotal = checks.reduce((sum, check) => sum + check.weight, 0);

    lines.push("---");
    lines.push("");
    lines.push(`## ${CATEGORY_LABELS[category]} — ${CATEGORY_WEIGHTS[category]}% of the score`);
    lines.push("");
    lines.push(CATEGORY_DESCRIPTIONS[category]);
    lines.push("");
    lines.push(
      `${checks.length} checks, ${categoryTotal} points shared between them. A check's share of this category is its weight divided by ${categoryTotal}.`,
    );
    lines.push("");

    for (const check of checks) {
      const notes = CHECK_NOTES[check.key];
      const share = ((check.weight / categoryTotal) * CATEGORY_WEIGHTS[category]).toFixed(1);

      lines.push(`### ${check.title}`);
      lines.push("");
      lines.push(`- **Key:** \`${check.key}\``);
      lines.push(
        `- **Weight:** ${check.weight} of ${categoryTotal} in this category — up to **${share} points** of the final 100`,
      );
      if (check.guide) lines.push(`- **Guide:** \`/seo-guides/${check.guide}\``);
      lines.push("");
      lines.push(`**How it is detected**`);
      lines.push("");
      lines.push(notes?.detection ?? "See the check implementation.");
      lines.push("");
      lines.push(`**Limitations**`);
      lines.push("");
      lines.push(notes?.limitation ?? "None recorded.");
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push("## What no check does");
  lines.push("");
  lines.push(
    "None of these checks measures rankings, search traffic, backlinks, domain authority, Core Web Vitals, PageSpeed scores, or whether a page is indexed. Those require data sources this tool does not have. There is a test in `tests/unit/checks.test.ts` that scans every check's wording and fails the build if any of them promises a ranking improvement.",
  );
  lines.push("");

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* SCORING.md                                                          */
/* ------------------------------------------------------------------ */

function generateScoringDoc(): string {
  const lines: string[] = [];
  const explanation = scoringExplanation();

  lines.push("# Scoring");
  lines.push("");
  lines.push(
    "<!-- GENERATED FILE. Edit lib/seo/scoring.ts or scripts/generate-docs.ts, then run `npm run docs:generate`. -->",
  );
  lines.push("");
  lines.push(
    "Every rule the scoring engine follows. All of it lives in one file — `lib/seo/scoring.ts` — and nothing else in the application calculates a score.",
  );
  lines.push("");
  lines.push("## The rules");
  lines.push("");
  for (const rule of explanation.rules) lines.push(`1. ${rule}`);
  lines.push("");
  lines.push(
    "The score is **deterministic**: the same page always produces the same number. There is no randomness and no AI anywhere in the calculation.",
  );
  lines.push("");

  /* Category weights */
  lines.push("## Category weights");
  lines.push("");
  lines.push("| Category | Weight | Checks | Points within category |");
  lines.push("| --- | ---: | ---: | ---: |");
  for (const category of CHECK_CATEGORIES) {
    const checks = checkRegistry.filter((check) => check.category === category);
    const total = checks.reduce((sum, check) => sum + check.weight, 0);
    lines.push(
      `| ${CATEGORY_LABELS[category]} | ${CATEGORY_WEIGHTS[category]}% | ${checks.length} | ${total} |`,
    );
  }
  const weightTotal = Object.values(CATEGORY_WEIGHTS).reduce((sum, w) => sum + w, 0);
  lines.push(`| **Total** | **${weightTotal}%** | **${checkRegistry.length}** | |`);
  lines.push("");

  /* Severity deductions */
  lines.push("## Severity deductions");
  lines.push("");
  lines.push("When a check does not pass, it loses this share of its own weight:");
  lines.push("");
  lines.push("| Severity | Deduction | Keeps |");
  lines.push("| --- | ---: | ---: |");
  for (const [severity, deduction] of Object.entries(SEVERITY_DEDUCTIONS)) {
    lines.push(
      `| ${severity} | ${Math.round(deduction * 100)}% | ${Math.round((1 - deduction) * 100)}% |`,
    );
  }
  lines.push("");
  lines.push("| Status | Effect on the score |");
  lines.push("| --- | --- |");
  lines.push("| `PASS` | Earns the check's full weight |");
  lines.push("| `INFO` | Earns the check's full weight — informational findings never deduct |");
  lines.push("| `WARNING` | Loses the share above, by severity |");
  lines.push("| `ERROR` | Loses the share above, by severity |");
  lines.push(
    "| `UNAVAILABLE` | **Removed from the calculation entirely.** Never counts against the page |",
  );
  lines.push("");

  /* Per-check deduction table */
  lines.push("## What each check can cost");
  lines.push("");
  lines.push(
    "The maximum points a check can lose, assuming every other category is measurable. Read this as: if this check fails at this severity, the final score drops by about this much.",
  );
  lines.push("");
  lines.push("| Check | Category | Max points | Critical | High | Medium | Low |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: |");

  for (const check of checkRegistry) {
    const categoryTotal = checkRegistry
      .filter((entry) => entry.category === check.category)
      .reduce((sum, entry) => sum + entry.weight, 0);

    const maxPoints = (check.weight / categoryTotal) * CATEGORY_WEIGHTS[check.category];
    const cost = (deduction: number) => (maxPoints * deduction).toFixed(1);

    lines.push(
      `| \`${check.key}\` | ${CATEGORY_LABELS[check.category]} | ${maxPoints.toFixed(1)} | −${cost(SEVERITY_DEDUCTIONS.CRITICAL)} | −${cost(SEVERITY_DEDUCTIONS.HIGH)} | −${cost(SEVERITY_DEDUCTIONS.MEDIUM)} | −${cost(SEVERITY_DEDUCTIONS.LOW)} |`,
    );
  }
  lines.push("");
  lines.push(
    "Note that a check does not use every severity. `title` reports CRITICAL when missing and MEDIUM when an unusual length; it never reports HIGH. The table shows what each severity would cost if it occurred.",
  );
  lines.push("");

  /* Redistribution */
  lines.push("## When a category cannot be measured");
  lines.push("");
  lines.push(
    "If every check in a category returns `UNAVAILABLE`, that category is excluded and its weight is shared proportionally across the categories that could be measured, so the maxima still total exactly 100.",
  );
  lines.push("");
  lines.push(
    "Rounding each category can leave the set summing to 99 or 101, so the remainder is given to the largest category. This is why a redistributed category may show a max of 51 rather than 50. The report flags when this has happened.",
  );
  lines.push("");

  /* Bands */
  lines.push("## Score bands");
  lines.push("");
  lines.push("| Range | Label | Meaning |");
  lines.push("| --- | --- | --- |");
  for (const band of SCORE_BANDS) {
    lines.push(`| ${band.min}–${band.max} | ${band.label} | ${band.summary} |`);
  }
  lines.push("");

  /* Worked example */
  lines.push("## A worked example");
  lines.push("");
  const onPage = checkRegistry.filter((check) => check.category === "on-page");
  const onPageTotal = onPage.reduce((sum, check) => sum + check.weight, 0);
  lines.push("```");
  lines.push(
    `On-Page SEO is worth ${CATEGORY_WEIGHTS["on-page"]} points across ${onPage.length} checks`,
  );
  lines.push(`weighted ${onPage.map((c) => c.weight).join(", ")} — ${onPageTotal} points in total.`);
  lines.push("");
  lines.push("Everything passes except the meta description, flagged low severity:");
  lines.push("");
  const metaDescription = onPage.find((check) => check.key === "meta-description");
  const metaWeight = metaDescription?.weight ?? 8;
  const earned = metaWeight * (1 - SEVERITY_DEDUCTIONS.LOW);
  const categoryEarned = onPageTotal - metaWeight + earned;
  const finalScore = Math.round((CATEGORY_WEIGHTS["on-page"] / onPageTotal) * categoryEarned);
  lines.push(`  meta description weight     = ${metaWeight}`);
  lines.push(`  low severity deduction      = ${Math.round(SEVERITY_DEDUCTIONS.LOW * 100)}%`);
  lines.push(
    `  points earned by that check = ${metaWeight} × (1 − ${SEVERITY_DEDUCTIONS.LOW}) = ${earned.toFixed(1)}`,
  );
  lines.push("");
  lines.push(`  category points earned      = ${categoryEarned.toFixed(1)}`);
  lines.push(`  category points available   = ${onPageTotal}`);
  lines.push("");
  lines.push(
    `  On-Page SEO = round(${CATEGORY_WEIGHTS["on-page"]} / ${onPageTotal} × ${categoryEarned.toFixed(1)}) = ${finalScore} out of ${CATEGORY_WEIGHTS["on-page"]}`,
  );
  lines.push("```");
  lines.push("");

  /* What the score is not */
  lines.push("## What the score is not");
  lines.push("");
  lines.push(
    "It measures **how well a page follows the conventions this tool checks**. It is not a prediction, not a verdict, and not Google's opinion. Two pages with the same score are not equally likely to rank.",
  );
  lines.push("");
  lines.push(
    "Because of that, **severity is communicated separately from the number**. A page can sit in the middle band and still have something critical wrong with it — a page returning 200 with no redirects, not noindexed and listed in a sitemap earns real points for those, even with no title at all. The \"Fix these first\" list always leads with the critical items, and there is a test enforcing it.",
  );
  lines.push("");
  lines.push(
    "Every report carries this line: *This score is based on the checks performed by SEO Page Checker. It is not a Google ranking score.*",
  );
  lines.push("");

  /* Changing it */
  lines.push("## Changing the scoring");
  lines.push("");
  lines.push("Everything tunable is at the top of `lib/seo/scoring.ts`:");
  lines.push("");
  lines.push("- `CATEGORY_WEIGHTS` — the split across categories. Must total 100; the module");
  lines.push("  throws at load if it does not.");
  lines.push("- `SEVERITY_DEDUCTIONS` — what each severity costs.");
  lines.push("- `SCORE_BANDS` — the ranges and their wording.");
  lines.push("");
  lines.push(
    "A check's own weight lives with the check, in its `createCheck` definition. After changing any of these, run `npm run docs:generate` to update this file and `npm test` to confirm the invariants still hold.",
  );
  lines.push("");

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */

writeFileSync(resolve(root, "SEO-CHECKS.md"), `${generateChecksDoc()}\n`, "utf8");
writeFileSync(resolve(root, "SCORING.md"), `${generateScoringDoc()}\n`, "utf8");

console.log(`Generated SEO-CHECKS.md and SCORING.md from ${checkRegistry.length} checks.`);
