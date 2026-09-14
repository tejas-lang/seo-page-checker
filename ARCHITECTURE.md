# Architecture

How the pieces fit together, and why they are arranged this way.

---

## The one-sentence version

A user's URL flows through a security gate, into a safe fetcher, into a parser,
into a list of independent checks, into a scorer, into one report object — and
that single object is what every consumer reads.

```
  URL from the browser
          │
          ▼
  ┌───────────────────┐
  │  URL guard        │  lib/security/     reject anything not public http(s)
  └─────────┬─────────┘
            ▼
  ┌───────────────────┐
  │  Fetcher          │  lib/crawler/      manual redirects, timeout, size cap
  └─────────┬─────────┘
            ▼
  ┌───────────────────┐
  │  Parser           │  lib/seo/parser    HTML → a bag of plain facts
  └─────────┬─────────┘
            ▼
  ┌───────────────────┐
  │  Check registry   │  lib/seo/checks/   26 independent pure functions
  └─────────┬─────────┘
            ▼
  ┌───────────────────┐
  │  Scorer           │  lib/seo/scoring   the only place a score exists
  └─────────┬─────────┘
            ▼
  ┌───────────────────┐
  │  AuditReport      │  one object
  └─────────┬─────────┘
            │
   ┌────────┼────────┬──────────────┐
   ▼        ▼        ▼              ▼
  Web UI   JSON API  Print/PDF    Database
```

---

## The decisions worth explaining

### One report object, many consumers

`AuditReport` in `lib/seo/types.ts` is the contract. The web dashboard, the
printable page, the JSON API and the stored database row all read the same
structure.

The alternative — each consumer assembling its own view from raw check results
— guarantees that they drift. The API says a page scored 78, the PDF says 76,
and nobody knows which is right. Here there is exactly one score, computed
once, in one place.

### Checks are pure functions of a context object

A check receives a `CheckContext` and returns a `CheckResult`. It does no I/O,
makes no requests, and has no access to anything but the facts it is given.

That buys three things:

1. **Testability.** A check is tested by handing it HTML and asserting on the
   result. No network, no mocking, no fixtures beyond a string.
2. **Isolation.** A check that throws is caught by the orchestrator and
   recorded as "unable to determine" for that one check. It cannot take down
   the audit.
3. **Extensibility.** Adding a check is writing one file and adding one line to
   the registry. Nothing else changes.

### The registry is the single source of truth

`lib/seo/registry.ts` is an array. From it are derived: what the engine runs,
what the homepage advertises, what `/how-it-works` tabulates, what the checker
page lists, what `SEO-CHECKS.md` documents, and what the scorer weighs.

Nothing counts checks by hand. The homepage says "26 checks" because it reads
`CHECK_COUNT`, so that number cannot become a lie.

The registry also throws at module load if two checks share a key — a mistake
that would otherwise silently overwrite a database row and a UI entry.

### Scoring is isolated in one module

`lib/seo/scoring.ts` contains every weight, every deduction and every band.
No React component computes anything about a score. This is why the
"How is this score calculated?" panel in the UI can be trusted: it reads the
same constants the calculation uses, so the explanation cannot describe a
formula the code is not running.

It also validates itself at load: if `CATEGORY_WEIGHTS` does not total 100, the
module throws rather than silently distorting every score.

### Security lives at the boundary, not in the callers

`lib/security/` is the only place that decides whether a URL may be fetched, and
`lib/crawler/fetch-url.ts` is the only place that opens a connection. No other
module calls `fetch` on a user-supplied URL.

Concentrating it means the protection can be audited by reading two files, and
a new feature cannot accidentally bypass it by calling `fetch` directly.

### The parser runs once

Parsing HTML is the expensive step. It happens once per audit, producing a
`PageData` object that all 26 checks read. A design where each check queried the
DOM itself would parse 26 times, or share a mutable document that checks could
corrupt for each other.

---

## Request flows

### Running an audit

```
POST /api/audit/stream                    (the web UI uses this)
  │
  ├─ consume()                            rate limit, before any work
  ├─ Zod schema                           shape of the request body
  │
  └─ executeAudit()                       lib/seo/execute.ts
       ├─ validateUrl()                   layers 1 and 2
       └─ runAudit()                      lib/seo/audit.ts
            ├─ fetchPage()          ──▶ stage event: "fetching"
            ├─ parseHtml()          ──▶ stage event: "parsing"
            ├─ fetchRobotsDocument()──▶ stage event: "robots"
            ├─ analyzeSitemap()     ──▶ stage event: "sitemap"
            ├─ registry.map(run)    ──▶ stage event: "checks"
            ├─ calculateScore()     ──▶ stage event: "scoring"
            └─ assemble AuditReport
       └─ auditStore.saveCompleted()
  │
  └─ SSE: { type: "result", reportUrl }
```

`POST /api/audit` is the same flow without the streaming, for programmatic use.
Both call `executeAudit`, so they cannot diverge.

### Why the progress is real

The audit engine takes an `onStage` callback and fires it as each stage
completes. The streaming route forwards those to the browser as Server-Sent
Events, and the form ticks each item off as it arrives.

This is not decoration. The alternative — a progress bar animating to 100% on a
timer — is fabricated data, and this project does not produce that. We do not
know in advance how long somebody else's server will take to answer, so we do
not pretend to.

### Reading a report

```
GET /audit/[id]  →  auditStore.get(id)  →  <ReportView report={...} />
```

The page is a React Server Component. The report renders on the server and
arrives as HTML. The only client-side JavaScript on it is the filter controls
and the copy buttons — so the report is readable, and printable, with
JavaScript disabled.

---

## Storage

### Why both JSON and columns

`Audit.report` holds the complete report object as JSON, and
`AuditCheck` / `AuditCategoryScore` / `AuditMetadata` hold the same facts as
typed columns.

This looks like duplication, and it is deliberate:

- **The JSON is what the UI renders.** One row, no joins, and — importantly — a
  historical report keeps the exact score it was given, even if the scoring
  weights change in a later release. Recomputing from stored check results
  would silently rewrite history.
- **The columns make the data queryable.** "How many audited pages are missing a
  canonical?" is a `SELECT`, not a JSON scan. This is what an admin view or
  aggregate statistics would need.

Both are written in one transaction from one object, so they cannot drift.

### The memory fallback

`lib/db/audit-store.ts` exposes one interface with two implementations. With no
`DATABASE_URL`, reports go into a bounded in-memory map so the app runs
immediately after cloning.

The map lives on `globalThis`, not in a module-level constant. That is not
stylistic: Next.js compiles route handlers and pages into separate module
graphs and reloads modules on every edit in development. A plain module-level
Map gives the API route and the report page two different stores — you run an
audit successfully and then get "report not found" reading it back. (This
happened during development, which is how the comment in that file came to be
written.)

It still does not cross process boundaries, which is why production requires a
database.

The store also degrades rather than failing: if a database write throws, the
error is logged and the report is kept in memory for that request. A user who
just waited for a page to be analysed still gets their report; losing the saved
copy is the lesser problem.

---

## Synchronous audits, and where that stops

An audit runs inside the request. For a single page that is the right call: the
work is bounded by the crawler's own 10-second budget, and a synchronous
response means no job queue, no polling, and no partial states.

**Where that stops being true:** multi-page crawling. Fifty pages cannot run
inside one request. At that point the shape becomes:

```
POST /api/crawl  →  create a job row, return an id immediately
                 →  worker picks it up, audits pages, updates progress
GET  /api/crawl/[id]  →  progress and partial results
```

The pieces that would change are the API route and a new worker process.
`runAudit` itself would not — it already takes a URL and returns a report, with
no knowledge of who called it or why. That is the seam this design leaves open.

---

## Caching

Only one thing is cached: `robots.txt`, per origin, for five minutes.

The cache holds the **parsed file**, not the verdict. The file is shared by a
whole site, but "is this path allowed?" is per-page, so the verdict is always
recomputed. Caching the verdict would give the second page audited on a site
the first page's answer — a subtle, plausible-looking wrong result.

Failed retrievals are not cached, so a transient blip does not look like a
persistent problem for the next five minutes.

---

## Errors

Two rules:

1. **Expected failures are values, not exceptions.** A page that times out, a
   blocked URL, a 404 — these are ordinary outcomes. `fetchPage` returns a
   discriminated union, so a caller cannot forget to handle failure; the type
   checker will not let them.

2. **Unexpected failures never reach the user.** An exception is caught, logged
   with full detail server-side, and answered with a human sentence and an
   opaque reference id. Stack traces are not user-facing content.

Every failure carries a machine code (`TIMEOUT`, `BLOCKED_URL`,
`RESPONSE_TOO_LARGE`, …) mapped to both an HTTP status and a written message.
The code is for software, the message is for people, and blocked-URL messages
deliberately do not say *why* — see `SECURITY.md`.

---

## Directory map

| Path | Responsibility |
| --- | --- |
| `app/` | Pages and API routes only. No business logic. |
| `components/ui/` | Primitives: button, card, badge, alert, layout. |
| `components/audit/` | The report: form, gauge, check list, print view. |
| `lib/config/` | Brand configuration and validated environment. |
| `lib/security/` | URL and IP rules. No I/O. Fully unit-testable. |
| `lib/crawler/` | Everything that touches the network. |
| `lib/seo/` | Parsing, checks, scoring, orchestration. |
| `lib/db/` | Storage, with the interface and both implementations. |
| `content/` | The SEO guide library as structured data. |
| `scripts/` | `generate-docs.ts`, which derives two docs from the registry. |

The dependency direction is one-way: `app/` depends on `lib/`, and `lib/` never
imports from `app/` or `components/`. The audit engine has no idea it is being
used by a website.
