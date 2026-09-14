# SEO checks

<!-- GENERATED FILE. Edit lib/seo/registry.ts or scripts/generate-docs.ts, then run `npm run docs:generate`. -->

Every check this tool runs: what it measures, how it detects it, how much it weighs, and — importantly — what it cannot tell you.

There are **26 checks** across six categories.

## Summary

| Check | Category | Weight | Guide |
| --- | --- | ---: | --- |
| `http-status` | Technical SEO | 8 | — |
| `https` | Technical SEO | 8 | — |
| `redirects` | Technical SEO | 5 | — |
| `robots-meta` | Technical SEO | 8 | [robots-txt](/seo-guides/robots-txt) |
| `canonical` | Technical SEO | 7 | [canonical-url](/seo-guides/canonical-url) |
| `robots-txt` | Technical SEO | 5 | [robots-txt](/seo-guides/robots-txt) |
| `sitemap` | Technical SEO | 4 | [xml-sitemap](/seo-guides/xml-sitemap) |
| `language` | Technical SEO | 4 | — |
| `viewport` | Technical SEO | 5 | — |
| `charset` | Technical SEO | 2 | — |
| `favicon` | Technical SEO | 2 | — |
| `title` | On-Page SEO | 10 | [title-tag](/seo-guides/title-tag) |
| `meta-description` | On-Page SEO | 8 | [meta-description](/seo-guides/meta-description) |
| `h1` | On-Page SEO | 8 | [h1-tag](/seo-guides/h1-tag) |
| `heading-structure` | On-Page SEO | 5 | [h1-tag](/seo-guides/h1-tag) |
| `image-alt` | On-Page SEO | 6 | [image-alt-text](/seo-guides/image-alt-text) |
| `word-count` | Content & Structure | 7 | — |
| `content-structure` | Content & Structure | 5 | — |
| `content-rendering` | Content & Structure | 3 | — |
| `internal-links` | Links | 5 | — |
| `external-links` | Links | 3 | — |
| `link-quality` | Links | 4 | — |
| `json-ld` | Structured Data | 7 | [schema-markup](/seo-guides/schema-markup) |
| `microdata` | Structured Data | 3 | [schema-markup](/seo-guides/schema-markup) |
| `open-graph` | Social Metadata | 6 | — |
| `twitter-card` | Social Metadata | 4 | — |

---

## Technical SEO — 30% of the score

How well the page can be reached, crawled and understood: status codes, HTTPS, canonical, robots directives, language and viewport.

11 checks, 58 points shared between them. A check's share of this category is its weight divided by 58.

### HTTP status

- **Key:** `http-status`
- **Weight:** 8 of 58 in this category — up to **4.1 points** of the final 100

**How it is detected**

The status code of the final response, after redirects.

**Limitations**

A single request from one location at one moment. A server that is intermittently failing may answer normally for us.

### HTTPS

- **Key:** `https`
- **Weight:** 8 of 58 in this category — up to **4.1 points** of the final 100

**How it is detected**

The protocol of the final URL, plus whether an HTTP address redirected to HTTPS.

**Limitations**

We do not inspect the certificate itself — its issuer, expiry or chain. A connection that fails TLS is reported as a connection failure instead.

### Redirects

- **Key:** `redirects`
- **Weight:** 5 of 58 in this category — up to **2.6 points** of the final 100

**How it is detected**

Every hop is recorded as we follow it manually, with its status code and target.

**Limitations**

We follow at most 10 hops. A chain longer than that is reported as TOO_MANY_REDIRECTS rather than analysed.

### Robots directives

- **Key:** `robots-meta`
- **Weight:** 8 of 58 in this category — up to **4.1 points** of the final 100
- **Guide:** `/seo-guides/robots-txt`

**How it is detected**

The robots and googlebot meta tags, plus the X-Robots-Tag response header. Directives are parsed as a comma-separated list.

**Limitations**

We report what the page instructs. Whether a search engine acts on it depends on factors no external tool can observe, so the wording is always 'may be instructed', never 'will not be indexed'.

### Canonical URL

- **Key:** `canonical`
- **Weight:** 7 of 58 in this category — up to **3.6 points** of the final 100
- **Guide:** `/seo-guides/canonical-url`

**How it is detected**

Every link element whose rel includes "canonical". The href is resolved to an absolute URL and compared with the audited page.

**Limitations**

A canonical is a hint, not a command. Search engines weigh it against your internal links, sitemap and redirects and may choose differently.

### robots.txt

- **Key:** `robots-txt`
- **Weight:** 5 of 58 in this category — up to **2.6 points** of the final 100
- **Guide:** `/seo-guides/robots-txt`

**How it is detected**

Fetches /robots.txt, parses the user-agent groups, and evaluates the audited path using longest-match-wins with allow beating disallow on ties.

**Limitations**

Wildcard and $-anchored patterns are interpreted differently by different crawlers. Where the file uses them, the result is downgraded to 'potentially blocked' rather than asserted. Use Google Search Console for a definitive answer.

### XML sitemap

- **Key:** `sitemap`
- **Weight:** 4 of 58 in this category — up to **2.1 points** of the final 100
- **Guide:** `/seo-guides/xml-sitemap`

**How it is detected**

Looks for a sitemap declared in robots.txt first, then at /sitemap.xml and /sitemap_index.xml. Confirms it is valid XML and counts its <loc> entries.

**Limitations**

A sitemap can live at any address, so not finding one proves nothing — the result says 'not found at the usual locations'. Child sitemaps of an index are not fetched, so membership cannot be confirmed for an index.

### Language declaration

- **Key:** `language`
- **Weight:** 4 of 58 in this category — up to **2.1 points** of the final 100

**How it is detected**

The lang attribute on the html element, validated against a BCP 47 shape.

**Limitations**

We check the shape of the code, not whether it matches the language the page is actually written in.

### Mobile viewport

- **Key:** `viewport`
- **Weight:** 5 of 58 in this category — up to **2.6 points** of the final 100

**How it is detected**

The viewport meta tag, checked for width=device-width and for settings that block zooming.

**Limitations**

Its presence does not mean the page is actually responsive. That needs rendering at multiple widths, which this tool does not do.

### Character encoding

- **Key:** `charset`
- **Weight:** 2 of 58 in this category — up to **1.0 points** of the final 100

**How it is detected**

A charset meta tag, or a charset declared in a Content-Type meta http-equiv.

**Limitations**

We report what is declared, not whether the bytes actually match that encoding.

### Favicon

- **Key:** `favicon`
- **Weight:** 2 of 58 in this category — up to **1.0 points** of the final 100

**How it is detected**

Link elements whose rel includes icon, shortcut, apple-touch-icon or mask-icon.

**Limitations**

Browsers also fall back to /favicon.ico at the site root, which we do not request. A site with no tag may still show an icon.

---

## On-Page SEO — 35% of the score

The elements search engines read to understand the topic of the page: title, meta description, headings and image alt text.

5 checks, 37 points shared between them. A check's share of this category is its weight divided by 37.

### Title tag

- **Key:** `title`
- **Weight:** 10 of 37 in this category — up to **9.5 points** of the final 100
- **Guide:** `/seo-guides/title-tag`

**How it is detected**

Every title element outside SVG. Text and character count are reported exactly.

**Limitations**

Length guidance is about display width, not a rule. Search results are laid out in pixels, so wide capitals truncate sooner than narrow lowercase. We cannot tell whether the title is duplicated elsewhere on the site — that needs a full crawl.

### Meta description

- **Key:** `meta-description`
- **Weight:** 8 of 37 in this category — up to **7.6 points** of the final 100
- **Guide:** `/seo-guides/meta-description`

**How it is detected**

Every meta tag named "description", case-insensitively.

**Limitations**

Not a ranking factor, and search engines frequently write their own snippet instead. Length guidance is about display, not a requirement.

### H1 heading

- **Key:** `h1`
- **Weight:** 8 of 37 in this category — up to **7.6 points** of the final 100
- **Guide:** `/seo-guides/h1-tag`

**How it is detected**

All h1 elements, with their text, in document order.

**Limitations**

Multiple H1s are valid HTML and are reported as a low-severity observation, not a failure. There is no good evidence they harm rankings.

### Heading structure

- **Key:** `heading-structure`
- **Weight:** 5 of 37 in this category — up to **4.7 points** of the final 100
- **Guide:** `/seo-guides/h1-tag`

**How it is detected**

Every h1–h6 in document order, checked for empty headings and for levels that skip a step.

**Limitations**

Structure is judged mechanically. We cannot tell whether a heading accurately describes the section beneath it.

### Image alt text

- **Key:** `image-alt`
- **Weight:** 6 of 37 in this category — up to **5.7 points** of the final 100
- **Guide:** `/seo-guides/image-alt-text`

**How it is detected**

Every img element, sorted into described, explicitly decorative (alt="") and missing the attribute entirely. Images inside links are tracked separately.

**Limitations**

An empty alt is correct for decoration and is never flagged. We cannot judge whether an existing description is a good one — that needs someone who can see the image. Images added by JavaScript are not seen at all.

---

## Content & Structure — 15% of the score

The amount and structure of the readable text on the page.

3 checks, 15 points shared between them. A check's share of this category is its weight divided by 15.

### Word count

- **Key:** `word-count`
- **Weight:** 7 of 15 in this category — up to **7.0 points** of the final 100

**How it is detected**

Visible text after removing script, style, noscript, template, svg and iframe content. A word must contain at least one letter or digit.

**Limitations**

There is no correct word count for SEO. This is an observation, not a target. Content rendered by JavaScript is not counted.

### Content structure

- **Key:** `content-structure`
- **Weight:** 5 of 15 in this category — up to **5.0 points** of the final 100

**How it is detected**

The ratio of H2–H4 subheadings and paragraph elements to the word count.

**Limitations**

On a page with too little text to assess, this returns 'unable to determine' and is excluded from the score rather than awarding full marks for emptiness.

### Content rendering

- **Key:** `content-rendering`
- **Weight:** 3 of 15 in this category — up to **3.0 points** of the final 100

**How it is detected**

Compares the readable text against the size of the HTML document. A large document with very little text is the signature of client-side rendering.

**Limitations**

Inferred, not measured. A page can legitimately be markup-heavy. This check exists to stop users misreading a low word count caused by our own inability to run JavaScript.

---

## Links — 10% of the score

The internal and external links found in the page.

3 checks, 12 points shared between them. A check's share of this category is its weight divided by 12.

### Internal links

- **Key:** `internal-links`
- **Weight:** 5 of 12 in this category — up to **4.2 points** of the final 100

**How it is detected**

Anchor elements resolving to the same registrable domain, counted in total and as unique destinations.

**Limitations**

Structure only. We never request a link, so we never claim one is broken. The public suffix list used is short, so an unusual suffix may misclassify a subdomain.

### External links

- **Key:** `external-links`
- **Weight:** 3 of 12 in this category — up to **2.5 points** of the final 100

**How it is detected**

Anchor elements resolving to a different registrable domain, with their rel attributes.

**Limitations**

External links are not a fault, and this check never treats them as one. We do not evaluate the quality or reputation of destinations.

### Link quality

- **Key:** `link-quality`
- **Weight:** 4 of 12 in this category — up to **3.3 points** of the final 100

**How it is detected**

Empty hrefs, javascript: hrefs, links with no text, generic anchor text, and external new-tab links missing rel=noopener.

**Limitations**

The list of non-descriptive phrases is fixed and English-only. Link text can be poor in ways this does not catch.

---

## Structured Data — 5% of the score

Machine-readable markup (JSON-LD, microdata) that describes the content of the page.

2 checks, 10 points shared between them. A check's share of this category is its weight divided by 10.

### JSON-LD structured data

- **Key:** `json-ld`
- **Weight:** 7 of 10 in this category — up to **3.5 points** of the final 100
- **Guide:** `/seo-guides/schema-markup`

**How it is detected**

Every script of type application/ld+json, parsed with JSON.parse. All @type values are collected, including inside @graph.

**Limitations**

This is basic detection, not validation. Schema.org properties are not checked and this is NOT a rich results test — eligibility rules are not fully published. Structured data is not a ranking factor and does not guarantee a rich result.

### Microdata and RDFa

- **Key:** `microdata`
- **Weight:** 3 of 10 in this category — up to **1.5 points** of the final 100
- **Guide:** `/seo-guides/schema-markup`

**How it is detected**

itemtype attributes (microdata) and typeof attributes (RDFa).

**Limitations**

Presence and type only. Property completeness is not validated.

---

## Social Metadata — 5% of the score

Open Graph and Twitter/X metadata that controls how the page may look when shared.

2 checks, 10 points shared between them. A check's share of this category is its weight divided by 10.

### Open Graph

- **Key:** `open-graph`
- **Weight:** 6 of 10 in this category — up to **3.0 points** of the final 100

**How it is detected**

Meta tags with an og: prefix, read from either the property or the name attribute, since CMSs emit both.

**Limitations**

Affects how a link previews when shared, not search rankings. We do not fetch og:image to confirm it exists or check its dimensions.

### Twitter/X card

- **Key:** `twitter-card`
- **Weight:** 4 of 10 in this category — up to **2.0 points** of the final 100

**How it is detected**

Meta tags with a twitter: prefix, and the card type validated against the four recognised values.

**Limitations**

Twitter/X falls back to Open Graph when these are absent, so their absence is reported as informational when Open Graph is present.

---

## What no check does

None of these checks measures rankings, search traffic, backlinks, domain authority, Core Web Vitals, PageSpeed scores, or whether a page is indexed. Those require data sources this tool does not have. There is a test in `tests/unit/checks.test.ts` that scans every check's wording and fails the build if any of them promises a ranking improvement.

