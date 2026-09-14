/**
 * Where audit reports are kept.
 *
 * WHAT IT IS: one interface with two implementations — PostgreSQL via Prisma,
 * and an in-memory map. The rest of the application calls `auditStore` and
 * does not care which one is active.
 *
 * WHY THE MEMORY FALLBACK EXISTS: so the app runs the moment you clone it,
 * before PostgreSQL is set up. It is a real store, not a mock — audits are
 * saved and can be reloaded — but it lives in one process's memory, so
 * results vanish on restart and are not shared between server instances. The
 * UI says so. It is for local development, never for production.
 *
 * PRIVACY: we store the report and nothing else. No IP addresses, no cookies,
 * no page HTML. Anonymous audits carry an expiry date and are deleted after
 * AUDIT_RETENTION_DAYS.
 */

import type { AuditReport, CheckResult } from "@/lib/seo/types";
import type { FetchErrorCode } from "@/lib/seo/types";
import { env } from "@/lib/config/env";
import { getPrisma, isDatabaseConfigured } from "./client";
import { logger } from "@/lib/logger";
import { TtlCache } from "@/lib/utils/cache";

/** What a stored audit looks like when read back. */
export interface StoredAudit {
  id: string;
  url: string;
  finalUrl: string | null;
  state: "COMPLETED" | "FAILED";
  createdAt: string;
  expiresAt: string | null;
  /** Present when state is COMPLETED. */
  report: AuditReport | null;
  /** Present when state is FAILED. */
  error: { code: FetchErrorCode; message: string } | null;
}

export interface AuditStore {
  readonly kind: "postgres" | "memory";
  saveCompleted(report: AuditReport): Promise<void>;
  saveFailed(input: {
    id: string;
    url: string;
    code: FetchErrorCode;
    message: string;
  }): Promise<void>;
  get(id: string): Promise<StoredAudit | null>;
  /** Remove records past their expiry. Returns how many were deleted. */
  purgeExpired(): Promise<number>;
}

function expiryDate(): Date {
  return new Date(Date.now() + env.AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/* ------------------------------------------------------------------ */
/* In-memory implementation                                            */
/* ------------------------------------------------------------------ */

/**
 * The map lives on `globalThis`, not in a module-level constant.
 *
 * This is not a style choice. Next.js compiles route handlers and pages into
 * separate module graphs, and reloads modules on every edit in development, so
 * a plain module-level Map would give the API route and the report page two
 * different stores — you would run an audit successfully and then get "report
 * not found" when the page tried to read it. Hanging it off globalThis gives
 * the whole process one store.
 *
 * It still does not cross PROCESS boundaries. On a platform where each route
 * runs in its own serverless instance, this fallback cannot work at all, which
 * is why DATABASE_URL is required in production.
 */
const globalForStore = globalThis as unknown as {
  seoPageCheckerAudits?: TtlCache<StoredAudit>;
};

function memoryEntries(): TtlCache<StoredAudit> {
  globalForStore.seoPageCheckerAudits ??= new TtlCache<StoredAudit>(
    env.AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    500,
  );
  return globalForStore.seoPageCheckerAudits;
}

class MemoryAuditStore implements AuditStore {
  readonly kind = "memory" as const;

  // Bounded so a busy dev server cannot grow without limit.
  private get entries(): TtlCache<StoredAudit> {
    return memoryEntries();
  }

  async saveCompleted(report: AuditReport): Promise<void> {
    this.entries.set(report.id, {
      id: report.id,
      url: report.requestedUrl,
      finalUrl: report.finalUrl,
      state: "COMPLETED",
      createdAt: report.createdAt,
      expiresAt: expiryDate().toISOString(),
      report,
      error: null,
    });
  }

  async saveFailed(input: {
    id: string;
    url: string;
    code: FetchErrorCode;
    message: string;
  }): Promise<void> {
    this.entries.set(input.id, {
      id: input.id,
      url: input.url,
      finalUrl: null,
      state: "FAILED",
      createdAt: new Date().toISOString(),
      expiresAt: expiryDate().toISOString(),
      report: null,
      error: { code: input.code, message: input.message },
    });
  }

  async get(id: string): Promise<StoredAudit | null> {
    return this.entries.get(id) ?? null;
  }

  async purgeExpired(): Promise<number> {
    const before = this.entries.size;
    this.entries.prune();
    return before - this.entries.size;
  }
}

/* ------------------------------------------------------------------ */
/* PostgreSQL implementation                                           */
/* ------------------------------------------------------------------ */

type PrismaCheckState = "PASS" | "WARNING" | "ERROR" | "INFO" | "UNAVAILABLE";
type PrismaSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

function toCheckRow(auditId: string, check: CheckResult) {
  return {
    auditId,
    category: check.category,
    checkKey: check.key,
    status: check.status as PrismaCheckState,
    severity: check.severity as PrismaSeverity,
    // Keep the columns bounded; the full text is in the report JSON.
    value: check.value?.slice(0, 500) ?? null,
    message: check.message.slice(0, 2000),
    recommendation: check.recommendation?.slice(0, 2000) ?? null,
  };
}

class PostgresAuditStore implements AuditStore {
  readonly kind = "postgres" as const;

  async saveCompleted(report: AuditReport): Promise<void> {
    const prisma = getPrisma();
    if (!prisma) throw new Error("Database is not configured.");

    // One transaction, so a report is never half-written.
    await prisma.$transaction([
      prisma.audit.create({
        data: {
          id: report.id,
          url: report.requestedUrl,
          finalUrl: report.finalUrl,
          state: "COMPLETED",
          score: report.score.total,
          scoreBand: report.score.band.id,
          httpStatus: report.http.finalStatus,
          redirectCount: report.http.redirectCount,
          durationMs: report.durationMs,
          report: report as unknown as object,
          createdAt: new Date(report.createdAt),
          completedAt: new Date(report.completedAt),
          expiresAt: expiryDate(),
        },
      }),
      prisma.auditCheck.createMany({
        data: report.checks.map((check) => toCheckRow(report.id, check)),
      }),
      prisma.auditCategoryScore.createMany({
        data: report.score.categories.map((category) => ({
          auditId: report.id,
          category: category.category,
          score: category.score,
          max: category.max,
        })),
      }),
      prisma.auditMetadata.create({
        data: {
          auditId: report.id,
          httpStatus: report.http.finalStatus,
          redirectCount: report.http.redirectCount,
          title: report.metadata.title?.slice(0, 500) ?? null,
          titleLength: report.metadata.titleLength,
          metaDescription: report.metadata.metaDescription?.slice(0, 1000) ?? null,
          metaDescriptionLength: report.metadata.metaDescriptionLength,
          canonical: report.metadata.canonical?.slice(0, 1000) ?? null,
          h1Count: report.metadata.h1Count,
          wordCount: report.metadata.wordCount,
          internalLinks: report.metadata.internalLinks,
          externalLinks: report.metadata.externalLinks,
          imageCount: report.metadata.imageCount,
          imagesMissingAlt: report.metadata.imagesMissingAlt,
          schemaCount: report.metadata.schemaTypes.length,
          lang: report.metadata.lang?.slice(0, 35) ?? null,
          isHttps: report.metadata.isHttps,
          isNoindex: report.metadata.isNoindex,
        },
      }),
    ]);
  }

  async saveFailed(input: {
    id: string;
    url: string;
    code: FetchErrorCode;
    message: string;
  }): Promise<void> {
    const prisma = getPrisma();
    if (!prisma) throw new Error("Database is not configured.");

    await prisma.audit.create({
      data: {
        id: input.id,
        url: input.url,
        state: "FAILED",
        errorCode: input.code,
        errorMessage: input.message.slice(0, 1000),
        completedAt: new Date(),
        expiresAt: expiryDate(),
      },
    });
  }

  async get(id: string): Promise<StoredAudit | null> {
    const prisma = getPrisma();
    if (!prisma) return null;

    const row = await prisma.audit.findUnique({ where: { id } });
    if (!row) return null;

    // Expired rows are treated as gone even before the purge job removes them.
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

    return {
      id: row.id,
      url: row.url,
      finalUrl: row.finalUrl,
      state: row.state === "COMPLETED" ? "COMPLETED" : "FAILED",
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      report: (row.report as AuditReport | null) ?? null,
      error:
        row.errorCode === null
          ? null
          : {
              code: row.errorCode as FetchErrorCode,
              message: row.errorMessage ?? "This audit could not be completed.",
            },
    };
  }

  async purgeExpired(): Promise<number> {
    const prisma = getPrisma();
    if (!prisma) return 0;

    const result = await prisma.audit.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}

/* ------------------------------------------------------------------ */
/* Selection + a safety net                                            */
/* ------------------------------------------------------------------ */

const memoryStore = new MemoryAuditStore();
const postgresStore = new PostgresAuditStore();

/**
 * The active store.
 *
 * When PostgreSQL is configured but a write fails, we log it and fall back to
 * memory for that request rather than failing the audit. A user who just
 * waited for a page to be analysed should still get their report; losing the
 * saved copy is the lesser problem.
 */
export const auditStore: AuditStore = {
  get kind() {
    return isDatabaseConfigured() ? postgresStore.kind : memoryStore.kind;
  },

  async saveCompleted(report) {
    if (!isDatabaseConfigured()) return memoryStore.saveCompleted(report);

    try {
      await postgresStore.saveCompleted(report);
    } catch (error) {
      logger.error("db.save_failed", {
        auditId: report.id,
        message: error instanceof Error ? error.message : String(error),
      });
      await memoryStore.saveCompleted(report);
    }
  },

  async saveFailed(input) {
    if (!isDatabaseConfigured()) return memoryStore.saveFailed(input);

    try {
      await postgresStore.saveFailed(input);
    } catch (error) {
      logger.error("db.save_failed", {
        auditId: input.id,
        message: error instanceof Error ? error.message : String(error),
      });
      await memoryStore.saveFailed(input);
    }
  },

  async get(id) {
    if (!isDatabaseConfigured()) return memoryStore.get(id);

    try {
      const stored = await postgresStore.get(id);
      if (stored) return stored;
    } catch (error) {
      logger.error("db.read_failed", {
        auditId: id,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    // Covers reports written to memory while the database was unavailable.
    return memoryStore.get(id);
  },

  async purgeExpired() {
    const fromMemory = await memoryStore.purgeExpired();
    if (!isDatabaseConfigured()) return fromMemory;

    try {
      return fromMemory + (await postgresStore.purgeExpired());
    } catch (error) {
      logger.error("db.purge_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      return fromMemory;
    }
  },
};
