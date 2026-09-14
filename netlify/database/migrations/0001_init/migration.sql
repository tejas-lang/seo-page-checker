-- Schema for SEO Page Checker.
--
-- GENERATED, DO NOT EDIT BY HAND. This is the output of
--     npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
-- mirrored here because Netlify applies migrations from this directory
-- against the database it provisions, using a connection string that is
-- not exposed to the build command.
--
-- prisma/schema.prisma remains the source of truth. After changing it,
-- regenerate both this file and prisma/migrations/.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AuditState" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CheckState" AS ENUM ('PASS', 'WARNING', 'ERROR', 'INFO', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "CheckSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audits" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "finalUrl" TEXT,
    "state" "AuditState" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER,
    "scoreBand" TEXT,
    "httpStatus" INTEGER,
    "redirectCount" INTEGER,
    "durationMs" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "report" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "userId" TEXT,

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_checks" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "checkKey" TEXT NOT NULL,
    "status" "CheckState" NOT NULL,
    "severity" "CheckSeverity" NOT NULL,
    "value" TEXT,
    "message" TEXT NOT NULL,
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_category_scores" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,

    CONSTRAINT "audit_category_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_metadata" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "httpStatus" INTEGER NOT NULL,
    "redirectCount" INTEGER NOT NULL,
    "title" TEXT,
    "titleLength" INTEGER,
    "metaDescription" TEXT,
    "metaDescriptionLength" INTEGER,
    "canonical" TEXT,
    "h1Count" INTEGER NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "internalLinks" INTEGER NOT NULL,
    "externalLinks" INTEGER NOT NULL,
    "imageCount" INTEGER NOT NULL,
    "imagesMissingAlt" INTEGER NOT NULL,
    "schemaCount" INTEGER NOT NULL,
    "lang" TEXT,
    "isHttps" BOOLEAN NOT NULL,
    "isNoindex" BOOLEAN NOT NULL,

    CONSTRAINT "audit_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "audits_createdAt_idx" ON "audits"("createdAt");

-- CreateIndex
CREATE INDEX "audits_expiresAt_idx" ON "audits"("expiresAt");

-- CreateIndex
CREATE INDEX "audits_userId_idx" ON "audits"("userId");

-- CreateIndex
CREATE INDEX "audit_checks_auditId_idx" ON "audit_checks"("auditId");

-- CreateIndex
CREATE INDEX "audit_checks_checkKey_status_idx" ON "audit_checks"("checkKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "audit_checks_auditId_checkKey_key" ON "audit_checks"("auditId", "checkKey");

-- CreateIndex
CREATE UNIQUE INDEX "audit_category_scores_auditId_category_key" ON "audit_category_scores"("auditId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "audit_metadata_auditId_key" ON "audit_metadata"("auditId");

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_checks" ADD CONSTRAINT "audit_checks_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_category_scores" ADD CONSTRAINT "audit_category_scores_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_metadata" ADD CONSTRAINT "audit_metadata_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
