/**
 * The database connection.
 *
 * WHAT IT IS: a single, lazily-created Prisma client shared by the whole
 * server process.
 *
 * WHY THE SINGLETON: in development Next.js reloads modules on every edit. If
 * we created a new client each time, we would open a new pool of database
 * connections on every save and exhaust the database within a few minutes.
 * Stashing the client on `globalThis` survives the reload.
 *
 * WHY IT IS OPTIONAL: DATABASE_URL is not required to run this app. With no
 * database configured, `getPrisma()` returns null and the audit store falls
 * back to memory (see audit-store.ts). That means `npm run dev` works
 * immediately after cloning, before anyone has set up PostgreSQL.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { env } from "@/lib/config/env";
import { logger } from "@/lib/logger";

const globalForPrisma = globalThis as unknown as {
  seoPageCheckerPrisma?: PrismaClient | null;
};

/** True when a database connection string is configured. */
export function isDatabaseConfigured(): boolean {
  return typeof env.DATABASE_URL === "string" && env.DATABASE_URL.trim() !== "";
}

/**
 * Get the shared Prisma client, or null when no database is configured.
 * Never throws: a database problem must degrade the app, not break it.
 */
export function getPrisma(): PrismaClient | null {
  if (!isDatabaseConfigured()) return null;

  if (globalForPrisma.seoPageCheckerPrisma !== undefined) {
    return globalForPrisma.seoPageCheckerPrisma;
  }

  try {
    const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
    const client = new PrismaClient({
      adapter,
      log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });

    globalForPrisma.seoPageCheckerPrisma = client;
    return client;
  } catch (error) {
    logger.error("db.client_init_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    globalForPrisma.seoPageCheckerPrisma = null;
    return null;
  }
}
