import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * `prisma generate` runs on every `npm install` and must not require a
 * database. When DATABASE_URL is unset we substitute an obvious placeholder:
 * generation succeeds, and any command that genuinely needs a connection
 * (migrate, studio) fails with a connection error naming this host.
 */
const connectionUrl =
  process.env.DATABASE_URL ??
  // Netlify's managed Postgres injects the connection string under its own
  // name, so migrations run during a Netlify build without extra wiring.
  process.env.NETLIFY_DATABASE_URL ??
  "postgresql://user:password@set-DATABASE_URL-in-your-env-file:5432/seo_page_checker";

/**
 * Prisma CLI configuration.
 *
 * From Prisma 7 onwards the connection URL lives here rather than inside
 * schema.prisma. This file is used by the CLI only — `prisma migrate`,
 * `prisma studio`, `prisma db push`. The application itself opens its own
 * connection through the pg driver adapter in lib/db/client.ts.
 *
 * `prisma generate` does not connect to a database, so a missing DATABASE_URL
 * is fine at install time. It only matters when running a migration.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: connectionUrl,
  },
});
