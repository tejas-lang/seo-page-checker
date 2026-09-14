/**
 * The SEO guide library.
 *
 * Each guide is a real answer to a real question, written for someone who has
 * just seen the matching result in an audit and wants to know what it means.
 *
 * The structure is deliberate and identical across guides — definition, why it
 * matters, example, common mistakes, how to fix, how we check it — so a reader
 * who reads two of them already knows where to look in the third.
 *
 * `checkKeys` ties each guide back to the checks in lib/seo/registry.ts, which
 * is what lets an audit result link straight to the relevant explanation.
 */

export interface GuideSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  code?: { language: string; snippet: string; caption?: string };
}

export interface Guide {
  slug: string;
  title: string;
  /** Used as the page's meta description and the card summary. */
  summary: string;
  /** The one-line answer, shown in a highlighted box at the top. */
  definition: string;
  sections: GuideSection[];
  /** Check keys from the registry this guide explains. */
  checkKeys: string[];
  related: string[];
  updated: string;
}

export const guides: Guide[] = [
  /* ---------------------------------------------------------------- */
  {
    slug: "title-tag",
    title: "What is a title tag?",
    summary:
      "The title tag names your page for search engines and browser tabs. What it is, how long it should be, and the mistakes that waste it.",
    definition:
      "A title tag is the HTML element that states the name of a page. Search engines commonly use it as the clickable headline of a search result, and browsers use it as the tab label.",
    checkKeys: ["title"],
    related: ["meta-description", "h1-tag"],
    updated: "2026-01-10",
    sections: [
      {
        heading: "Why it matters",
        paragraphs: [
          "The title is usually the first thing a person reads about your page, before they have decided whether to click. It is also one of the strongest clues a search engine has about the page's topic.",
          "Search engines do not always show the title you wrote. They may rewrite it if they judge that a different heading better matches what somebody searched for. Writing a clear, specific title makes a rewrite less likely, and gives them better material to work with if they do rewrite it.",
        ],
      },
      {
        heading: "What it looks like",
        code: {
          language: "html",
          snippet: `<head>
  <title>Cold roll forming for automotive parts — Acme Metals</title>
</head>`,
          caption: "The title element belongs inside the head of the document.",
        },
      },
      {
        heading: "How long should it be?",
        paragraphs: [
          "There is no required length. Search results are laid out in pixels, not characters, so a title of wide capital letters is cut off sooner than a narrow lowercase one.",
          "As a practical guide, titles under roughly 60 characters are usually shown in full on a desktop result. Longer is not an error — it just means the end may not be visible, so the words that identify the page should come first.",
        ],
      },
      {
        heading: "Common mistakes",
        bullets: [
          "Using the same title on every page, so nothing distinguishes one result from another.",
          "Leaving a template default in place, such as \"Home\" or \"Untitled document\".",
          "Stuffing in keyword after keyword. It reads badly to a person, and search engines are likely to rewrite it.",
          "Putting the brand name first on every page, so every result in a list looks identical until the reader is several words in.",
          "Having more than one title element, which leaves it ambiguous which one applies.",
        ],
      },
      {
        heading: "How to write a good one",
        bullets: [
          "Say what the page is about in the words a reader would use.",
          "Make it different from every other title on your site.",
          "Put the distinguishing words first and the brand name last.",
          "Write it for a person deciding whether to click, not for a machine counting words.",
        ],
      },
      {
        heading: "How SEO Page Checker checks it",
        paragraphs: [
          "We read the title element straight out of the HTML and report its exact text and character count. A missing or empty title is flagged as critical, because it leaves search engines with nothing. Very short or very long titles are flagged as warnings with the measured length, so you can judge whether it matters for your page.",
          "We cannot tell you whether your title is duplicated elsewhere on your site — that needs a crawl of every page, and this tool checks one page at a time.",
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "meta-description",
    title: "What is a meta description?",
    summary:
      "The meta description is your pitch in the search result. What it does, what it does not do, and how to write one worth reading.",
    definition:
      "A meta description is a short summary of a page, placed in the HTML head. Search engines may use it as the grey text under a search result.",
    checkKeys: ["meta-description"],
    related: ["title-tag", "canonical-url"],
    updated: "2026-01-10",
    sections: [
      {
        heading: "Why it matters",
        paragraphs: [
          "A meta description does not influence where a page ranks. What it does is give you a say in how the page is described when somebody is deciding between several results.",
          "Search engines frequently write their own snippet instead, usually pulling a passage from the page that matches the search. That is normal and not a failure. Your description is the version they use when nothing on the page fits better.",
        ],
      },
      {
        heading: "What it looks like",
        code: {
          language: "html",
          snippet: `<meta
  name="description"
  content="Compare cold roll forming and stamping for automotive brackets, with tolerances, tooling costs and typical lead times."
/>`,
        },
      },
      {
        heading: "How long should it be?",
        paragraphs: [
          "Roughly 120 to 160 characters is usually shown in full. Beyond that it is generally cut off, so the point should come early. Under about 70 characters leaves space unused that you could have spent explaining the page.",
          "As with titles, these are display guidelines. No length is required and none guarantees anything.",
        ],
      },
      {
        heading: "Common mistakes",
        bullets: [
          "Repeating the title almost word for word, which wastes the second line entirely.",
          "Writing one generic description and reusing it across the whole site.",
          "Listing keywords instead of writing a sentence.",
          "Leaving the tag present but empty, which is the same as having none.",
          "Assuming it will always be displayed — it will not be.",
        ],
      },
      {
        heading: "How SEO Page Checker checks it",
        paragraphs: [
          "We read the description from the HTML, report its exact text and character count, and flag it when it is missing, empty, duplicated across multiple tags, or far outside the length that is normally displayed. Because a missing description is not a functional problem, it is a warning rather than an error.",
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "h1-tag",
    title: "What is an H1 tag?",
    summary:
      "The H1 is the main heading on the page itself. Why it is not the same as the title tag, and whether having two is really a problem.",
    definition:
      "An H1 is the top-level heading element on a page — the visible headline that tells a reader what they are looking at.",
    checkKeys: ["h1", "heading-structure"],
    related: ["title-tag", "meta-description"],
    updated: "2026-01-10",
    sections: [
      {
        heading: "How it differs from the title tag",
        paragraphs: [
          "The title tag is written for the search result and the browser tab. The H1 is written for the page itself. They often say similar things, and they do not have to be identical — the title may carry your brand name, while the H1 is just the headline a reader sees.",
        ],
      },
      {
        heading: "Why it matters",
        paragraphs: [
          "Headings are the page's outline. Someone using a screen reader can jump between them to find the section they want, and software parsing the page uses them to understand which content belongs to which topic. A page with no H1 has no stated subject in its own markup.",
        ],
      },
      {
        heading: "Is more than one H1 a problem?",
        paragraphs: [
          "Not automatically. Multiple H1s are valid HTML, and HTML5 explicitly allows them within sections. You will find plenty of advice claiming they damage rankings; there is no good evidence for that.",
          "What a single H1 does give you is clarity. If a page has three H1s, there is no single statement of what the page is about. That is a reason to prefer one, not a reason to panic about two.",
        ],
      },
      {
        heading: "Heading structure",
        paragraphs: [
          "Levels should descend in order: an H1 for the page, H2s for its main sections, H3s for subsections within those. Jumping from H2 straight to H4 leaves a gap in the outline that assistive software has to guess at.",
        ],
        code: {
          language: "html",
          snippet: `<h1>Cold roll forming explained</h1>
  <h2>How the process works</h2>
    <h3>Tooling</h3>
    <h3>Tolerances</h3>
  <h2>When to choose it over stamping</h2>`,
        },
      },
      {
        heading: "Common mistakes",
        bullets: [
          "Using an H1 for a logo or a decorative element rather than the page's topic.",
          "Having an H1 that contains only an image with no alt text, so the heading has no readable content.",
          "Choosing heading levels for their font size instead of their place in the outline. Use CSS for size.",
          "Leaving empty headings behind in a template, which add blank entries to the outline.",
        ],
      },
      {
        heading: "How SEO Page Checker checks it",
        paragraphs: [
          "We count the H1 elements and report their text. A missing H1 is a high-priority warning. Multiple H1s are reported as a low-priority warning with the actual headings listed, so you can decide whether it matters for your page. We also check the whole heading outline for empty headings and skipped levels.",
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "canonical-url",
    title: "What is a canonical URL?",
    summary:
      "A canonical link tells search engines which address is the original when the same content is reachable several ways.",
    definition:
      "A canonical URL is a link element that names the preferred address for a page, so that duplicate or near-duplicate URLs are credited to one original.",
    checkKeys: ["canonical"],
    related: ["xml-sitemap", "robots-txt"],
    updated: "2026-01-10",
    sections: [
      {
        heading: "The problem it solves",
        paragraphs: [
          "The same page is often reachable at several addresses. Add a tracking parameter and it is a new URL. Serve it with and without a trailing slash, with and without www, over HTTP and HTTPS, and you have several more.",
          "To a search engine these can look like separate pages with identical content. A canonical link resolves it: every version points at one preferred address, and that address is the one treated as the original.",
        ],
      },
      {
        heading: "What it looks like",
        code: {
          language: "html",
          snippet: `<link rel="canonical" href="https://example.com/guides/roll-forming/" />`,
          caption:
            "Use the complete absolute URL, including the protocol. Every version of the page carries the same canonical.",
        },
      },
      {
        heading: "Common mistakes",
        bullets: [
          "Pointing every page's canonical at the homepage. This tells search engines that none of your other pages are worth indexing on their own.",
          "Declaring more than one canonical on a page. Conflicting canonicals are generally ignored entirely.",
          "Using a relative URL that resolves differently depending on the path the page was served from.",
          "Canonicalising to a URL that redirects, or to a page that is blocked from crawling.",
          "Pointing the canonical at a different website by accident, which asks search engines to credit that site instead of yours.",
        ],
      },
      {
        heading: "A canonical is a hint, not a command",
        paragraphs: [
          "Search engines treat the canonical as strong evidence, not as an instruction they must obey. If the signals disagree — the canonical says one thing but your internal links, sitemap and redirects say another — they may choose differently. Consistency across all of those is what makes it stick.",
        ],
      },
      {
        heading: "How SEO Page Checker checks it",
        paragraphs: [
          "We find every canonical link on the page, resolve it to an absolute URL, and compare it with the page we audited. We report whether it is missing, duplicated, malformed, relative, self-referencing, or pointing somewhere else — and whether that somewhere else is on the same site.",
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "robots-txt",
    title: "What is robots.txt?",
    summary:
      "robots.txt tells crawlers which parts of a site they may request. What it controls, what it does not, and why it is not a way to hide a page.",
    definition:
      "robots.txt is a plain text file at the root of a site that tells crawlers which paths they are allowed to request.",
    checkKeys: ["robots-txt", "robots-meta"],
    related: ["xml-sitemap", "canonical-url"],
    updated: "2026-01-10",
    sections: [
      {
        heading: "Where it lives",
        paragraphs: [
          "Always at the root of the domain: https://example.com/robots.txt. It applies to that host only — a subdomain needs its own file.",
        ],
        code: {
          language: "text",
          snippet: `User-agent: *
Disallow: /admin/
Disallow: /cart/
Allow: /admin/public-notice

Sitemap: https://example.com/sitemap.xml`,
        },
      },
      {
        heading: "What it controls, and what it does not",
        paragraphs: [
          "robots.txt controls crawling — whether a crawler requests a URL. It does not control indexing. A page blocked in robots.txt can still appear in search results if other pages link to it, because a search engine can know the URL exists without ever fetching it.",
          "That surprises people regularly, and it has a sharp edge: if you block a page in robots.txt to keep it out of search, the crawler can no longer fetch the page, so it never sees the noindex directive you put there. The block prevents the very instruction that would have worked.",
        ],
      },
      {
        heading: "robots.txt or a robots meta tag?",
        bullets: [
          "To keep a page out of search results, use a noindex robots meta tag on the page and let crawlers fetch it.",
          "To stop crawlers wasting requests on sections that are worthless to them — faceted filters, internal search results — use robots.txt.",
          "Never use robots.txt as a security control. It is a public file that lists exactly what you would rather people did not visit.",
        ],
      },
      {
        heading: "Common mistakes",
        bullets: [
          "Shipping a staging site's \"Disallow: /\" to production. This is the single most expensive robots.txt mistake there is.",
          "Blocking the CSS and JavaScript a page needs, so search engines cannot render it properly.",
          "Assuming an empty \"Disallow:\" line blocks something. An empty value allows everything.",
          "Expecting the file on one subdomain to apply to another.",
        ],
      },
      {
        heading: "How SEO Page Checker checks it",
        paragraphs: [
          "We fetch /robots.txt, parse the user-agent groups, and evaluate whether the audited path appears to be allowed, using the longest-match rules crawlers document.",
          "Where the file uses wildcard patterns or directives we do not fully model, we say \"potentially blocked\" rather than claiming certainty. Different crawlers genuinely interpret those edge cases differently, and a tool that states a confident wrong answer is worse than one that admits the limit. For a definitive answer, use the robots.txt tester in Google Search Console.",
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "xml-sitemap",
    title: "What is an XML sitemap?",
    summary:
      "A sitemap is a list of the pages you want crawled. What belongs in one, what does not, and what it can and cannot do.",
    definition:
      "An XML sitemap is a file listing the URLs on a site that the owner considers worth crawling, along with optional information about when each one changed.",
    checkKeys: ["sitemap"],
    related: ["robots-txt", "canonical-url"],
    updated: "2026-01-10",
    sections: [
      {
        heading: "What it is for",
        paragraphs: [
          "A sitemap helps search engines discover URLs. It is most valuable for pages that few internal links point to, for large sites, and for new sites with few incoming links.",
          "It is a discovery aid, not an instruction. Listing a URL does not mean it will be crawled, and certainly does not mean it will be indexed. Pages are indexed on their merits, not because they appear in a file.",
        ],
      },
      {
        heading: "What it looks like",
        code: {
          language: "xml",
          snippet: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/guides/roll-forming/</loc>
    <lastmod>2026-01-08</lastmod>
  </url>
</urlset>`,
        },
      },
      {
        heading: "Where to put it",
        paragraphs: [
          "/sitemap.xml is the common convention, but a sitemap can live at any address. The reliable way to advertise it is a Sitemap line in robots.txt, which points crawlers straight to it wherever it is.",
          "Large sites split their URLs across several sitemaps and list those in a sitemap index. A single sitemap holds at most 50,000 URLs or 50 MB uncompressed.",
        ],
      },
      {
        heading: "Common mistakes",
        bullets: [
          "Listing URLs that redirect, return 404, or are canonicalised to a different address. Every URL in a sitemap should be the final, canonical one.",
          "Including pages marked noindex, which sends two contradictory signals.",
          "Letting it go stale, so it advertises pages that were deleted months ago.",
          "Setting every lastmod date to today on every build. Once the dates are obviously meaningless they get ignored.",
          "Listing the HTTP version of URLs on a site that redirects everything to HTTPS.",
        ],
      },
      {
        heading: "How SEO Page Checker checks it",
        paragraphs: [
          "We look for a sitemap in robots.txt first, then at the conventional paths. If we find one, we confirm it is valid XML, count its URLs and check whether the audited page is listed.",
          "If we find nothing, we say we could not find one at the usual locations — not that your site has no sitemap. Since a sitemap can live anywhere, those are different statements and only the first one is true.",
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "schema-markup",
    title: "What is schema markup?",
    summary:
      "Structured data describes your page's content in a form software can read. What JSON-LD is, when it is worth adding, and what it will not do.",
    definition:
      "Schema markup, or structured data, is machine-readable code that describes what a page's content means — that this text is a recipe, this number is a price, this date is when an event starts.",
    checkKeys: ["json-ld", "microdata"],
    related: ["title-tag", "canonical-url"],
    updated: "2026-01-10",
    sections: [
      {
        heading: "Why it exists",
        paragraphs: [
          "A person reading a page can tell that \"45 minutes\" is a cooking time and \"£24.99\" is a price. Software has to infer it. Structured data removes the guesswork by labelling the values explicitly using a shared vocabulary from schema.org.",
          "When a page qualifies, search engines may use that data to show a richer result — a star rating, a price, a set of FAQ answers that expand in place.",
        ],
      },
      {
        heading: "JSON-LD is the format to use",
        paragraphs: [
          "There are three formats: JSON-LD, microdata and RDFa. JSON-LD sits in a single script block, separate from your markup, which makes it far easier to maintain than attributes threaded through the HTML. It is the format search engines recommend.",
        ],
        code: {
          language: "html",
          snippet: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Cold roll forming explained",
  "datePublished": "2026-01-08",
  "author": { "@type": "Organization", "name": "Acme Metals" }
}
</script>`,
        },
      },
      {
        heading: "What it will not do",
        paragraphs: [
          "Structured data is not a ranking factor. Adding it to a page does not make that page rank higher.",
          "Nor does it guarantee a rich result. Being eligible and being shown are different things: search engines decide per query whether to display one, and they withdraw the feature from sites whose markup does not match what the page actually says.",
        ],
      },
      {
        heading: "Common mistakes",
        bullets: [
          "Describing things that are not on the page. Marking up a review that no visitor can see is a policy violation, not a shortcut.",
          "Invalid JSON — a trailing comma or an unescaped quote — which causes the entire block to be discarded silently.",
          "Marking up every page as the same type regardless of what it contains.",
          "Contradicting the page: a price in the markup that differs from the price displayed.",
        ],
      },
      {
        heading: "How SEO Page Checker checks it",
        paragraphs: [
          "We detect JSON-LD blocks, confirm each one parses as valid JSON, and list every @type declared. We also detect microdata and RDFa.",
          "This is basic structured data detection, and we label it that way. We do not validate individual schema.org properties and we are not a rich results test — for that, use Google's Rich Results Test, which applies their actual eligibility rules.",
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "image-alt-text",
    title: "What is image alt text?",
    summary:
      "Alt text describes an image to people who cannot see it. When to write a description, when to leave it empty, and why empty is sometimes correct.",
    definition:
      "Alt text is a written description of an image, carried in the alt attribute, used by screen readers, by browsers when an image fails to load, and by search engines.",
    checkKeys: ["image-alt"],
    related: ["h1-tag", "title-tag"],
    updated: "2026-01-10",
    sections: [
      {
        heading: "Why it matters",
        paragraphs: [
          "For a screen reader user, alt text is the image. Without it they hear a filename, or nothing at all. That makes this first and foremost an accessibility feature — and in many countries, a legal requirement.",
          "It also gives search engines the only description they have of what an image shows, which is what makes an image findable in image search.",
        ],
      },
      {
        heading: "Empty alt text is often the right answer",
        paragraphs: [
          "Not every image carries meaning. A decorative divider, a background flourish, an icon sitting next to a label that already says the same word — describing those adds noise for someone listening to the page.",
          "The correct markup for a decorative image is an empty alt attribute. That is not a missing description; it is an explicit statement that there is nothing to describe, and assistive software skips the image accordingly.",
        ],
        code: {
          language: "html",
          snippet: `<!-- Carries meaning: describe it -->
<img src="/chart.png" alt="Revenue doubling between 2023 and 2024" />

<!-- Purely decorative: say so with an empty alt -->
<img src="/divider.png" alt="" />

<!-- No alt attribute at all: this is the one to fix -->
<img src="/team.jpg" />`,
        },
      },
      {
        heading: "How to write it",
        bullets: [
          "Describe what the image shows, in the context of the page around it.",
          "Keep it to a sentence. Alt text is read aloud in one breath.",
          "Skip \"image of\" and \"photo of\" — the software already announced that it is an image.",
          "If the image is inside a link and the link has no other text, the alt text must describe where the link goes, not what the picture looks like.",
          "Do not pack it with keywords. It is read aloud to a person.",
        ],
      },
      {
        heading: "How SEO Page Checker checks it",
        paragraphs: [
          "We count every image and sort them into three groups: described, explicitly decorative with an empty alt, and missing the attribute entirely. Only the third group is flagged.",
          "We pay particular attention to images inside links with no alt text, because those leave the link with no accessible name at all. What we cannot do is judge whether an existing description is a good one — that needs a human who can see the image.",
        ],
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return guides.find((guide) => guide.slug === slug);
}

export function getGuideForCheck(checkKey: string): Guide | undefined {
  return guides.find((guide) => guide.checkKeys.includes(checkKey));
}

export const guideSlugs = guides.map((guide) => guide.slug);
