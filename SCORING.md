# Scoring

<!-- GENERATED FILE. Edit lib/seo/scoring.ts or scripts/generate-docs.ts, then run `npm run docs:generate`. -->

Every rule the scoring engine follows. All of it lives in one file — `lib/seo/scoring.ts` — and nothing else in the application calculates a score.

## The rules

1. Each check belongs to one category, and each category is worth a fixed share of the 100 points.
1. Within a category, checks carry different weights — a missing title costs far more than a missing favicon.
1. A passing or informational check loses nothing. A failing check loses a share of its weight based on its severity.
1. A check we could not determine is excluded from the calculation. It never counts against the page.
1. Category scores are rounded and then added, so the breakdown always adds up to the total shown.

The score is **deterministic**: the same page always produces the same number. There is no randomness and no AI anywhere in the calculation.

## Category weights

| Category | Weight | Checks | Points within category |
| --- | ---: | ---: | ---: |
| Technical SEO | 30% | 11 | 58 |
| On-Page SEO | 35% | 5 | 37 |
| Content & Structure | 15% | 3 | 15 |
| Links | 10% | 3 | 12 |
| Structured Data | 5% | 2 | 10 |
| Social Metadata | 5% | 2 | 10 |
| **Total** | **100%** | **26** | |

## Severity deductions

When a check does not pass, it loses this share of its own weight:

| Severity | Deduction | Keeps |
| --- | ---: | ---: |
| CRITICAL | 100% | 0% |
| HIGH | 70% | 30% |
| MEDIUM | 40% | 60% |
| LOW | 15% | 85% |
| INFO | 0% | 100% |

| Status | Effect on the score |
| --- | --- |
| `PASS` | Earns the check's full weight |
| `INFO` | Earns the check's full weight — informational findings never deduct |
| `WARNING` | Loses the share above, by severity |
| `ERROR` | Loses the share above, by severity |
| `UNAVAILABLE` | **Removed from the calculation entirely.** Never counts against the page |

## What each check can cost

The maximum points a check can lose, assuming every other category is measurable. Read this as: if this check fails at this severity, the final score drops by about this much.

| Check | Category | Max points | Critical | High | Medium | Low |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `http-status` | Technical SEO | 4.1 | −4.1 | −2.9 | −1.7 | −0.6 |
| `https` | Technical SEO | 4.1 | −4.1 | −2.9 | −1.7 | −0.6 |
| `redirects` | Technical SEO | 2.6 | −2.6 | −1.8 | −1.0 | −0.4 |
| `robots-meta` | Technical SEO | 4.1 | −4.1 | −2.9 | −1.7 | −0.6 |
| `canonical` | Technical SEO | 3.6 | −3.6 | −2.5 | −1.4 | −0.5 |
| `robots-txt` | Technical SEO | 2.6 | −2.6 | −1.8 | −1.0 | −0.4 |
| `sitemap` | Technical SEO | 2.1 | −2.1 | −1.4 | −0.8 | −0.3 |
| `language` | Technical SEO | 2.1 | −2.1 | −1.4 | −0.8 | −0.3 |
| `viewport` | Technical SEO | 2.6 | −2.6 | −1.8 | −1.0 | −0.4 |
| `charset` | Technical SEO | 1.0 | −1.0 | −0.7 | −0.4 | −0.2 |
| `favicon` | Technical SEO | 1.0 | −1.0 | −0.7 | −0.4 | −0.2 |
| `title` | On-Page SEO | 9.5 | −9.5 | −6.6 | −3.8 | −1.4 |
| `meta-description` | On-Page SEO | 7.6 | −7.6 | −5.3 | −3.0 | −1.1 |
| `h1` | On-Page SEO | 7.6 | −7.6 | −5.3 | −3.0 | −1.1 |
| `heading-structure` | On-Page SEO | 4.7 | −4.7 | −3.3 | −1.9 | −0.7 |
| `image-alt` | On-Page SEO | 5.7 | −5.7 | −4.0 | −2.3 | −0.9 |
| `word-count` | Content & Structure | 7.0 | −7.0 | −4.9 | −2.8 | −1.1 |
| `content-structure` | Content & Structure | 5.0 | −5.0 | −3.5 | −2.0 | −0.8 |
| `content-rendering` | Content & Structure | 3.0 | −3.0 | −2.1 | −1.2 | −0.4 |
| `internal-links` | Links | 4.2 | −4.2 | −2.9 | −1.7 | −0.6 |
| `external-links` | Links | 2.5 | −2.5 | −1.8 | −1.0 | −0.4 |
| `link-quality` | Links | 3.3 | −3.3 | −2.3 | −1.3 | −0.5 |
| `json-ld` | Structured Data | 3.5 | −3.5 | −2.4 | −1.4 | −0.5 |
| `microdata` | Structured Data | 1.5 | −1.5 | −1.0 | −0.6 | −0.2 |
| `open-graph` | Social Metadata | 3.0 | −3.0 | −2.1 | −1.2 | −0.4 |
| `twitter-card` | Social Metadata | 2.0 | −2.0 | −1.4 | −0.8 | −0.3 |

Note that a check does not use every severity. `title` reports CRITICAL when missing and MEDIUM when an unusual length; it never reports HIGH. The table shows what each severity would cost if it occurred.

## When a category cannot be measured

If every check in a category returns `UNAVAILABLE`, that category is excluded and its weight is shared proportionally across the categories that could be measured, so the maxima still total exactly 100.

Rounding each category can leave the set summing to 99 or 101, so the remainder is given to the largest category. This is why a redistributed category may show a max of 51 rather than 50. The report flags when this has happened.

## Score bands

| Range | Label | Meaning |
| --- | --- | --- |
| 90–100 | Excellent foundation | This page passes the large majority of the checks in this tool. The remaining items are refinements rather than problems. |
| 75–89 | Good foundation | The essentials are in place. A few improvements would strengthen how clearly this page describes itself. |
| 50–74 | Needs improvement | Several checks did not pass. Working through the prioritised list below will address the most consequential ones first. |
| 0–49 | Significant issues found | This page has problems that are likely to affect how search engines read it. Start with the critical items at the top. |

## A worked example

```
On-Page SEO is worth 35 points across 5 checks
weighted 10, 8, 8, 5, 6 — 37 points in total.

Everything passes except the meta description, flagged low severity:

  meta description weight     = 8
  low severity deduction      = 15%
  points earned by that check = 8 × (1 − 0.15) = 6.8

  category points earned      = 35.8
  category points available   = 37

  On-Page SEO = round(35 / 37 × 35.8) = 34 out of 35
```

## What the score is not

It measures **how well a page follows the conventions this tool checks**. It is not a prediction, not a verdict, and not Google's opinion. Two pages with the same score are not equally likely to rank.

Because of that, **severity is communicated separately from the number**. A page can sit in the middle band and still have something critical wrong with it — a page returning 200 with no redirects, not noindexed and listed in a sitemap earns real points for those, even with no title at all. The "Fix these first" list always leads with the critical items, and there is a test enforcing it.

Every report carries this line: *This score is based on the checks performed by SEO Page Checker. It is not a Google ranking score.*

## Changing the scoring

Everything tunable is at the top of `lib/seo/scoring.ts`:

- `CATEGORY_WEIGHTS` — the split across categories. Must total 100; the module
  throws at load if it does not.
- `SEVERITY_DEDUCTIONS` — what each severity costs.
- `SCORE_BANDS` — the ranges and their wording.

A check's own weight lives with the check, in its `createCheck` definition. After changing any of these, run `npm run docs:generate` to update this file and `npm test` to confirm the invariants still hold.

