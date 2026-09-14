# SEO Page Checker

**Live: <https://seo-page-checker.netlify.app>**

A real, working SEO audit tool. You give it a public webpage address, it fetches
that page safely, runs 26 technical and on-page checks against the HTML, and
returns a transparent score with prioritised, plain-language recommendations.

It is built to be honest about what it can and cannot measure. There is no
invented data anywhere in it.

---

## Table of contents

1. [What this project does](#1-what-this-project-does)
2. [Technology used](#2-technology-used)
3. [Installing it](#3-installing-it)
4. [Environment variables](#4-environment-variables)
5. [Setting up the database](#5-setting-up-the-database)
6. [Running it locally](#6-running-it-locally)
7. [How the crawler works](#7-how-the-crawler-works)
8. [How the SEO score works](#8-how-the-seo-score-works)
9. [Running the tests](#9-running-the-tests)
10. [Deploying it](#10-deploying-it)
11. [Security](#11-security)
12. [Known limitations](#12-known-limitations)
13. [Future improvements](#13-future-improvements)
14. [Project structure](#14-project-structure)

---

## 1. What this project does

You paste a URL. The server:

1. **Validates the address** — only public `http://` and `https://` pages, never
   anything on a private network.
2. **Fetches the page once**, following redirects safely, with a timeout and a
   size cap.
3. **Parses the HTML** with a parser, not a browser. No JavaScript from the
   audited page ever runs on the server.
4. **Fetches `/robots.txt` and a sitemap** — the only two extra requests it
   makes.
5. **Runs 26 checks** across six categories.
6. **Calculates a score** using published, deterministic arithmetic.
7. **Saves the report** at its own unlisted URL so it can be revisited, shared
   or printed to PDF.

### The principles it is built on

These are not decoration. They shaped the code, and there are tests that
enforce them.

- **No invented data.** If something cannot be determined, the report says
  "unable to determine" and gives the reason. It never shows `0` when it means
  "unknown", and a check that could not run is removed from the score rather
  than counted against the page.
- **Facts and advice are kept apart.** Every result states what was measured,
  then separately what you might do about it. "Title length: 74 characters" is
  a fact. "Consider shortening it" is advice.
- **No ranking promises.** No check claims that fixing it will improve your
  position in search results. A test in `tests/unit/checks.test.ts` scans every
  check's wording for forbidden phrases and fails the build if one appears.
- **The score is arithmetic, not judgement.** Every weight is published, the
  calculation is shown on each report, and the same page always produces the
  same number. No AI writes any part of an audit.
- **We say what we cannot do.** No rankings, no backlinks, no authority score,
  no indexing status. Where outside data is shown — Core Web Vitals from the
  Google PageSpeed Insights API — it is attributed to Google and kept out of
  the score.

---

## 2. Technology used

| Piece | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) | Server-rendered pages and API routes in one codebase |
| Language | TypeScript (strict) | Catches whole classes of mistakes before they ship |
| Styling | Tailwind CSS v4 | The design tokens live in one file, `app/globals.css` |
| HTML parsing | Cheerio | A parser, not a browser — it cannot execute page scripts |
| HTTP | undici | Lets us supply a custom DNS lookup, which is what makes SSRF protection possible |
| Validation | Zod | One schema validates an API request and produces the error message |
| Database | PostgreSQL via Prisma 7 | Typed queries and versioned migrations |
| Unit tests | Vitest | Fast, and runs the real TypeScript |
| E2E tests | Playwright | Drives a real browser against a real build |

---

## 3. Installing it

You need **Node.js 20 or newer** and **npm**. PostgreSQL is optional to start
with (see below).

```bash
git clone <your-repository-url>
cd seo-page-checker
npm install
```

`npm install` also runs `prisma generate`, which creates the typed database
client. That step does not need a database connection.

Then create your environment file:

```bash
cp .env.example .env
```

**You can now run it.** With no `DATABASE_URL` set, reports are kept in the
server's memory instead of a database — enough to develop against, not enough
for production. See the next two sections.

---

## 4. Environment variables

Every variable has a safe default. `.env.example` documents all of them; these
are the ones that matter most.

| Variable | What it does | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. **Required in production.** Without it, reports live in memory and vanish on restart. | unset |
| `NEXT_PUBLIC_APP_URL` | The public origin of your site. Used for canonical URLs, the sitemap, social cards and the crawler's User-Agent. | `https://yourdomain.com` |
| `APP_URL` | The same value, available to server code. | `http://localhost:3000` |
| `NEXT_PUBLIC_BRAND_NAME` | Rename the product without touching the code. | `SEO Page Checker` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Shown on the contact page. If unset, the page says so rather than printing a fake address. | unset |
| `CONTACT_WEBHOOK_URL` | Where contact messages are delivered (Slack, Discord, Zapier, Formspree, your own endpoint). If unset, the form tells visitors it is not connected instead of silently dropping messages. | unset |
| `CRAWLER_USER_AGENT` | How the crawler identifies itself. Keep a contact URL in it. **Never impersonate Googlebot.** | `SEOPageCheckerBot/1.0 (+${APP_URL}/about#bot)` |
| `MAX_CRAWL_SIZE` | Largest response body the crawler will read, in bytes. | `5242880` (5 MB) |
| `CRAWL_TIMEOUT` | Total time budget for fetching a page, in milliseconds. | `10000` |
| `MAX_REDIRECTS` | Redirect hops to follow before giving up. | `10` |
| `RATE_LIMIT_MAX` | Audits allowed per client per window. | `5` |
| `RATE_LIMIT_WINDOW` | The window, in milliseconds. | `3600000` (1 hour) |
| `AUDIT_RETENTION_DAYS` | How long a stored report survives before deletion. | `7` |
| `ALLOW_PRIVATE_NETWORK_TARGETS` | **Danger.** Lets the crawler reach loopback and private addresses. Disables SSRF protection. Local testing only. | `false` |

Never commit `.env`. It is already in `.gitignore`.

---

## 5. Setting up the database

### Do I need one?

For **local development**, no. The app falls back to an in-memory store so it
runs the moment you clone it.

For **production**, yes. The memory fallback lives inside one server process:
reports disappear on restart, and on a platform where each route runs in its
own instance it cannot work at all.

### Getting a database

The easiest free options are [Neon](https://neon.tech) and
[Supabase](https://supabase.com). Both give you a connection string that looks
like this:

```
postgresql://user:password@host.region.provider.com/dbname?sslmode=require
```

Or run one locally with Docker:

```bash
docker run --name seo-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:17
```

...giving you `postgresql://postgres:postgres@localhost:5432/postgres`.

### Creating the tables

An initial migration ships with the repository
(`prisma/migrations/20260914000000_init/`), so you do not need to generate one.
Put the connection string in `.env` as `DATABASE_URL`, then:

```bash
npm run db:deploy
```

That applies the migration and records it, so it runs exactly once per
environment. Use this command in production too.

Use `npm run db:migrate` only when you have **changed** `prisma/schema.prisma`
and need a new migration file. Commit the folder it creates.

### The commands

| Command | What it does |
| --- | --- |
| `npm run db:generate` | Regenerate the typed client after editing the schema |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply existing migrations (production) |
| `npm run db:studio` | Open a browser UI to inspect the data |
| `npm run db:push` | Push the schema without a migration file (prototyping only) |

There is no seed script, and the crawler does not need one. The database starts
empty and fills up as audits are run.

---

## 6. Running it locally

```bash
npm run dev
```

Open <http://localhost:3000>.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Run the production build |
| `npm run lint` | Check code style |
| `npm run typecheck` | Check types without building |
| `npm test` | Run the unit tests |
| `npm run test:e2e` | Run the browser tests |

---

## 7. How the crawler works

The crawler is the part that talks to the outside world, so it is the part most
worth understanding. It lives in `lib/crawler/` and `lib/security/`.

### What it requests

Exactly three things per audit, at most:

1. The page you asked for.
2. That site's `/robots.txt`.
3. One sitemap — the one robots.txt names, or `/sitemap.xml`.

It does **not** crawl your site. It does not follow links. This is a page
checker, deliberately.

### How it identifies itself

```
SEOPageCheckerBot/1.0 (+https://yourdomain.com/about#bot)
```

An honest name and a URL explaining what it is, so site owners can identify and
block it. It never pretends to be Googlebot or a browser.

### The limits it enforces

| Limit | Default | Why |
| --- | --- | --- |
| Timeout | 10 seconds total | A server that answers one byte a minute cannot pin a worker |
| Response size | 5 MB | A multi-gigabyte page cannot exhaust memory |
| Redirects | 10 hops | Chains and loops terminate |
| Content type | HTML and XML only | We parse documents, not binaries |
| Ports | 80 and 443 | Defence in depth against internal service probing |

### What it does not do

It **never executes JavaScript**. Cheerio is an HTML parser: it reads markup
and builds a tree. There is no JavaScript engine in the request path, so a
hostile page cannot run code on the server.

The consequence is worth stating plainly, and the tool states it to users too:
if a page builds its content in the browser, the audit describes the initial
HTML, not what a visitor sees. The `content-rendering` check detects that
pattern and says so.

---

## 8. How the SEO score works

All of it lives in one file: `lib/seo/scoring.ts`. Nothing else in the
application calculates a score.

### The categories

| Category | Weight | Checks |
| --- | --- | --- |
| On-Page SEO | 35% | 5 |
| Technical SEO | 30% | 11 |
| Content & Structure | 15% | 3 |
| Links | 10% | 3 |
| Structured Data | 5% | 2 |
| Social Metadata | 5% | 2 |

### The rules

1. Each check belongs to one category, and each category is worth a fixed share
   of 100 points.
2. Within a category, checks carry different weights. A missing title costs far
   more than a missing favicon.
3. A **pass** or an **informational** result loses nothing.
4. A **failing** check loses a share of its own weight, set by its severity:
   critical 100%, high 70%, medium 40%, low 15%.
5. A check that could **not be determined** is removed from the calculation
   entirely. Its category's weight is shared across the categories that could
   be measured, so the total still runs to 100.
6. Category scores are rounded and then added, so the breakdown a user sees
   always adds up to the total exactly.

### A worked example

On-Page SEO is worth 35 points across five checks weighted 10, 8, 8, 5 and 6 —
37 points in total. If everything passes except the meta description, flagged
low severity:

```
meta description weight     = 8
low severity deduction      = 15%
points earned by that check = 8 × (1 − 0.15) = 6.8

category points earned      = 10 + 6.8 + 8 + 5 + 6 = 35.8
category points available   = 37

On-Page SEO = round(35 / 37 × 35.8) = 34 out of 35
```

### What the score is not

It measures **how well a page follows the conventions this tool checks**. It is
not a prediction, not a verdict, and not Google's opinion. Two pages with the
same score are not equally likely to rank.

Because of that, severity is communicated separately from the number. A page
can sit in the middle band and still have something critical wrong with it —
the "Fix these first" list always leads with the critical items, and there is a
test that enforces this.

`SCORING.md` documents every individual weight.

---

## 9. Running the tests

```bash
npm test
```

301 unit tests covering:

| Area | What is tested |
| --- | --- |
| IP classification | Every private, loopback, link-local, metadata, CGNAT, multicast and reserved range, in IPv4 and IPv6, including IPv4-mapped, 6to4 and NAT64 wrappers |
| URL validation | Scheme rules, credentials, ports, reserved TLDs, single-label hosts, decimal and hex encoded IPs, control characters |
| The crawler | Every SSRF vector is refused before a socket opens; body decoding across character sets |
| robots.txt | Group selection, longest-match wins, allow beats disallow on ties, wildcards, `$` anchors, unknown directives |
| Sitemaps | urlset and index detection, CDATA, entity handling, XML bomb resistance, parse caps |
| The parser | Titles, meta tags, headings, images, links, JSON-LD, microdata, word counts, malformed HTML |
| Every check | Pass, warning and error paths for all 26 |
| Scoring | Determinism, category sums, weight redistribution, band boundaries, issue prioritisation |
| Rate limiting | Limits, windows, per-client isolation, proxy header handling |
| The whole engine | Good page, bad page, error page, empty document, 3000 links, malformed JSON-LD |

There are also **registry-wide invariant tests** that every check must satisfy:
a unique key, a non-empty message, an explanation of why it matters, no
severity on a passing result, a reason on every "unavailable", and no
ranking-promise language.

### Browser tests

```bash
npx playwright install chromium   # once, about 100 MB
npm run test:e2e
```

22 tests, run against both a desktop and a mobile (Pixel 7) viewport — 44 in
total. They build the app, start it, and drive a real browser through the whole
flow: submitting the form, watching the streamed progress arrive, rendering a
report, filtering its results, and confirming the API refuses a private
address. Three of them fetch real pages, so they need internet access.

They also cover the things unit tests cannot see, such as whether the skip link
is still the first thing a keyboard user reaches.

---

## 10. Deploying it

See `DEPLOYMENT.md` for step-by-step instructions. In short: Vercel for the
app, Neon or Supabase for the database, and set `DATABASE_URL` plus
`NEXT_PUBLIC_APP_URL` before your first deploy.

---

## 11. Security

See `SECURITY.md` for the full account. The short version: the server fetches
URLs that strangers supply, which without protection would make it a proxy into
its own network. Four layers of defence stop that, including re-validating the
IP address at the moment the socket opens — which is what makes DNS rebinding
ineffective.

---

## 12. Known limitations

Stated plainly, because a tool that hides its limits cannot be trusted about
anything else.

**Things this tool genuinely cannot do:**

- **It does not run JavaScript.** Content rendered in the browser is invisible
  to it. The `content-rendering` check detects the pattern and says so.
- **It checks one page.** It cannot tell you whether a title is duplicated
  elsewhere on your site, or which pages link to this one.
- **It does not verify links.** It analyses link *structure*. It never claims a
  link is broken, because checking would mean firing a request at every
  destination.
- **It cannot see rankings, traffic, backlinks or indexing status.** Those need
  data sources no external tool has.
- **It is not a rich results test.** It confirms your JSON-LD is valid JSON and
  lists its types. Eligibility rules are not fully published.
- **Speed data is Google's, not ours.** The PageSpeed panel is a live call to
  Google's API. It needs an API key, has its own rate limit, and takes 10–30
  seconds — which is why it is requested on demand rather than with every
  audit. It never affects the SEO score, because Lighthouse results vary
  between runs and the score must not.
- **Its robots.txt parser is honest about its limits.** Where a file uses
  patterns different crawlers interpret differently, it reports "potentially
  blocked" rather than asserting a wrong answer.
- **Its public suffix list is short.** `lib/utils/url.ts` recognises common
  two-part suffixes like `.co.uk`, not the full Public Suffix List. An unusual
  suffix may cause a subdomain link to be counted as external.

**Operational limits of this build:**

- **Rate limiting is per-process.** Counters live in memory, so running several
  instances behind a load balancer multiplies the effective limit. Swap the Map
  in `lib/rate-limit.ts` for Redis to fix it.
- **The in-memory report store is for development only.** Set `DATABASE_URL` in
  production.
- **Expired reports are removed on read, not by a scheduled job.** A row past
  its expiry is treated as gone immediately, but the delete happens when
  `purgeExpired()` is called. Wire it to a cron job — see `DEPLOYMENT.md`.
- **Light mode only.** Dark mode is not implemented rather than implemented
  badly.

---

## 13. Future improvements

The next five features, in the order I would build them:

1. **Opt-in broken link checking.** A background job that requests each
   outbound link and reports its status. It must be opt-in and rate-limited —
   this is the one feature that turns a page checker into something that could
   annoy other people's servers.
2. ~~**Google PageSpeed Insights integration.**~~ **Done.** Reports fetch live
   Core Web Vitals and Lighthouse results on demand. Set `PAGESPEED_API_KEY` to
   enable it; without a key the panel says so plainly rather than showing
   anything invented.
3. **Accounts and saved history.** The `User` model already exists in the schema
   for exactly this. It brings higher rate limits and the ability to compare a
   page against its own past audits.
4. **Multi-page crawling.** The natural extension, and the point at which a
   background worker replaces the synchronous request — see `ARCHITECTURE.md`
   for where that boundary sits.
5. **A target keyword field.** Optional, and it would enable checks that are
   impossible now: is the keyword in the title, the H1, the first paragraph.
   The keyword has to come from the user; guessing it would be exactly the kind
   of invention this project avoids.

---

## 14. Project structure

```
app/                          Pages and API routes
  api/audit/route.ts          POST /api/audit — JSON API
  api/audit/stream/route.ts   POST — the same audit, streaming real progress
  api/audit/[id]/route.ts     GET — read a stored report
  api/contact/route.ts        POST — contact form delivery
  audit/[id]/page.tsx         The report page
  audit/[id]/print/page.tsx   The printable report (print to PDF)
  seo-guides/[slug]/page.tsx  The guide library
  robots.ts, sitemap.ts       This site's own technical SEO
  globals.css                 The entire design system

components/
  ui/                         Button, card, badge, alert, layout
  site/                       Header, footer, logo, contact form
  audit/                      Form, score gauge, check list, report views
  marketing/                  Homepage building blocks

lib/
  config/site.ts              Brand name, URL, disclaimers — change here
  config/env.ts               Validated environment configuration
  security/ip.ts              IP address classification
  security/url-guard.ts       URL validation and SSRF protection
  crawler/fetch-url.ts        The safe fetcher
  crawler/robots.ts           robots.txt retrieval and evaluation
  crawler/sitemap.ts          Sitemap discovery and parsing
  seo/types.ts                The shared vocabulary
  seo/parser.ts               HTML to facts
  seo/checks/                 One file per group of checks
  seo/registry.ts             The list of every check
  seo/scoring.ts              The only place a score is calculated
  seo/audit.ts                The orchestrator
  db/audit-store.ts           Storage, with the memory fallback
  rate-limit.ts               Server-side rate limiting

content/guides.ts             The SEO guide library
prisma/schema.prisma          The database schema
tests/unit/                   301 unit tests
tests/e2e/                    Browser tests
```

### Adding a new check

1. Write it in a file under `lib/seo/checks/` using `createCheck`.
2. Add one line to `lib/seo/registry.ts`.

That is all. The scorer, the API, the dashboard, the printable report and the
documentation pages all read the registry, so none of them need touching.

---

## Documentation

| File | What it covers |
| --- | --- |
| `README.md` | This file |
| `ARCHITECTURE.md` | How the pieces fit together and why |
| `SECURITY.md` | The threat model and every defence |
| `SEO-CHECKS.md` | Every check: what it measures, how, and its limits |
| `SCORING.md` | Every scoring rule and weight |
| `DEPLOYMENT.md` | Step-by-step production deployment |

---

## Licence and disclaimer

SEO Page Checker provides automated analysis for informational purposes. It
does not guarantee search engine rankings or indexing.
