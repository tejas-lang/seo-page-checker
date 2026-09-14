# Deployment

Step-by-step instructions for putting this online. Written for someone who has
not deployed a Next.js application before.

---

## Before you start

You need:

- The code in a Git repository (GitHub, GitLab or Bitbucket).
- A [Vercel](https://vercel.com) account — free tier is enough to start.
- A PostgreSQL database. [Neon](https://neon.tech) and
  [Supabase](https://supabase.com) both have free tiers.

Total time: about 20 minutes.

---

## Step 1 — Create the database

### Using Neon

1. Sign up at [neon.tech](https://neon.tech) and create a project.
2. On the dashboard, find **Connection string** and copy it. It looks like:

   ```
   postgresql://user:password@ep-cool-name-123.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

3. Keep it somewhere safe for the next step. **This is a password. Never commit
   it.**

### Using Supabase

1. Sign up at [supabase.com](https://supabase.com) and create a project.
2. Go to **Project Settings → Database → Connection string → URI**.
3. Replace `[YOUR-PASSWORD]` in the string with your database password.

> **A note on connection poolers.** Supabase offers a pooled connection (port
> `6543`) and a direct one (port `5432`). Use the **direct** connection for
> running migrations, and either for the application. If you use the pooler for
> the app, append `?pgbouncer=true&connection_limit=1`.

---

## Step 2 — Create the tables

An initial migration ships with the repository, so there is nothing to
generate. From your own machine, with the connection string in `.env`:

```bash
# .env
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
```

Then:

```bash
npm run db:deploy
```

This creates the tables and records the migration as applied. You only do this
once per database.

To verify it worked:

```bash
npm run db:studio
```

A browser window opens showing your (empty) tables: `audits`, `audit_checks`,
`audit_category_scores`, `audit_metadata` and `users`.

---

## Step 3 — Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your repository.
2. Vercel detects Next.js automatically. **Do not change the build settings.**
3. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | Your connection string from step 1 |
   | `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` |
   | `APP_URL` | `https://your-project.vercel.app` |

4. Click **Deploy**.

The first build takes two to three minutes. `npm install` runs
`prisma generate` automatically via the `postinstall` script, so the database
client is created during the build.

### After the first deploy

Once you know your real URL (or have attached a custom domain), go back to
**Settings → Environment Variables** and correct `NEXT_PUBLIC_APP_URL` and
`APP_URL`. These are used for canonical URLs, the sitemap, social card metadata
and the crawler's User-Agent — a wrong value here means wrong canonicals on
your own site, which is a poor advertisement for an SEO tool.

Then **redeploy**, because `NEXT_PUBLIC_` variables are baked in at build time.

---

## Step 4 — Applying migrations on later deploys

When you change `prisma/schema.prisma`, create a new migration locally:

```bash
npm run db:migrate
```

Commit the generated folder in `prisma/migrations/`. Then make production apply
it. Either run it manually once:

```bash
DATABASE_URL="your-production-url" npm run db:deploy
```

Or add it to the Vercel build command
(**Settings → General → Build Command**):

```
prisma migrate deploy && next build
```

The second is more automatic; the first gives you a moment to think before a
schema change hits production. Pick one deliberately.

---

## Step 5 — Optional configuration

All optional. Set them in **Settings → Environment Variables** and redeploy.

| Variable | Why you might set it |
| --- | --- |
| `NEXT_PUBLIC_BRAND_NAME` | Rename the product without touching code |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Shown on the contact page. Without it, the page honestly says no address is configured |
| `CONTACT_WEBHOOK_URL` | Makes the contact form actually deliver messages. Any JSON endpoint: a Slack or Discord incoming webhook, Zapier, Formspree |
| `CRAWLER_USER_AGENT` | Customise how the crawler identifies itself. **Keep a contact URL in it, and never impersonate Googlebot** |
| `RATE_LIMIT_MAX` | Audits per client per hour. Default 5 |
| `AUDIT_RETENTION_DAYS` | How long reports are kept. Default 7 |

### Setting up the contact form

Without `CONTACT_WEBHOOK_URL` the form tells visitors it is not connected,
rather than accepting messages and silently dropping them. To connect it:

- **Slack:** create an Incoming Webhook and paste the URL. The payload includes
  a `text` field, so it renders correctly with no further work.
- **Discord:** create a webhook in a channel's settings. Same payload.
- **Anything else:** the endpoint receives
  `{ text, name, email, message, receivedAt }` as JSON.

---

## Step 6 — Deleting expired reports

Reports carry an `expiresAt` date and are treated as gone once it passes. The
row itself is removed by `auditStore.purgeExpired()`, which needs something to
call it.

On Vercel, add a cron job. Create `app/api/cron/purge/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auditStore } from "@/lib/db/audit-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // Vercel sends this header on scheduled invocations. Without the check,
  // anyone could trigger the job.
  const secret = request.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await auditStore.purgeExpired();
  return NextResponse.json({ deleted });
}
```

Add `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/purge", "schedule": "0 3 * * *" }]
}
```

Then set a `CRON_SECRET` environment variable to a long random string.

This is left out of the default build because not every host supports cron, and
a route that silently does nothing is worse than one you added deliberately.

---

## Hosting other than Vercel

### Will it work?

Yes, on any host that runs Node. The application is a standard Next.js server.
Two things to check:

1. **The runtime must be Node, not Edge.** The crawler needs DNS resolution and
   raw sockets, which the Edge runtime does not provide. Every API route
   already declares `export const runtime = "nodejs"`.

2. **Requests need about 15 seconds.** An audit is bounded by a 10-second crawl
   budget plus overhead. A host that caps requests at 10 seconds will time out
   on slow websites.

### Vercel specifically

Works well. Function duration on the Hobby plan is 10 seconds by default, which
is tight against a 10-second crawl budget. Either raise `maxDuration` in
`vercel.json`:

```json
{ "functions": { "app/api/audit/**": { "maxDuration": 30 } } }
```

...or lower `CRAWL_TIMEOUT` to about 8000ms so the audit always finishes first.

**Note on rate limiting:** Vercel runs multiple instances, each with its own
in-memory counters, so the effective limit is higher than configured. For
accurate limiting, replace the Map in `lib/rate-limit.ts` with Upstash Redis —
it is the only file that changes.

### Railway, Render, Fly.io

Good fits, arguably better than serverless for this workload. They run a
persistent Node process, which means:

- Long-running requests are not a problem.
- The in-memory rate limiter is **accurate**, because there is one process.
- The robots.txt cache is shared across all requests rather than per-instance.

Deployment is the same: connect the repository, set the environment variables,
and use `npm run build` then `npm start`.

### Docker

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t seo-page-checker .
docker run -p 3000:3000 -e DATABASE_URL="..." -e APP_URL="..." seo-page-checker
```

---

## Pre-launch checklist

```bash
npm run typecheck     # no type errors
npm run lint          # no lint errors
npm test              # 301 unit tests pass
npm run build         # production build succeeds
```

Then, manually, on the deployed site:

- [ ] Run an audit on a real page. Confirm the report renders and the category
      scores add up to the total.
- [ ] Run an audit on `http://127.0.0.1/`. Confirm it is refused.
- [ ] Run an audit on a domain that does not exist. Confirm the error is human.
- [ ] Open a report link in a private window. Confirm it loads.
- [ ] Open `/audit/[id]/print` and print to PDF. Confirm it is readable.
- [ ] Check `/robots.txt` and `/sitemap.xml` both respond.
- [ ] Check `NEXT_PUBLIC_APP_URL` matches your real domain — view source on the
      homepage and confirm the canonical URL is right.
- [ ] Open the site at 375px wide. Confirm nothing scrolls horizontally.
- [ ] Run the audit tool **on your own homepage**. It should score well; if it
      does not, fix that before launching an SEO tool.

---

## Monitoring

The application writes structured JSON logs, one object per line, which every
major host indexes automatically.

Events worth alerting on:

| Event | Meaning |
| --- | --- |
| `audit.completed` | Normal. Carries score and duration |
| `audit.fetch_failed` | A page could not be fetched. Some volume is normal |
| `api.audit_crashed` | **A bug.** Should be zero |
| `db.save_failed` | The database is unreachable. Reports are being lost |
| `crawler.blocked_url` | An SSRF attempt was refused. A spike is worth looking at |
| `api.rate_limited` | Someone hit the limit. A spike may mean abuse |

Logs never contain cookies, tokens, page content or visitor IP addresses.

---

## Troubleshooting

**"Report not found" straight after running an audit**
`DATABASE_URL` is not set or is wrong, and different processes have different
in-memory stores. Check the variable and look for `db.save_failed` in the logs.

**Every audit times out**
Your host's function duration limit is shorter than `CRAWL_TIMEOUT`. Either
raise the limit or lower the timeout.

**`Cannot find module './generated/prisma/client'`**
`prisma generate` did not run. It is in `postinstall`, so a clean
`npm install` fixes it. On a host with a cached build, clear the build cache.

**The rate limit lets through more than configured**
Several instances, each counting separately. Expected on serverless. Use Redis
for exact limiting.

**Canonical URLs on your own site point at `yourdomain.com`**
`NEXT_PUBLIC_APP_URL` is still the placeholder. Set it and redeploy —
`NEXT_PUBLIC_` variables are baked in at build time.
