-- CreateEnum
CREATE TYPE "OrderEventKind" AS ENUM ('STATUS', 'NOTE', 'TRACKING');

-- CreateEnum
CREATE TYPE "QuoteEventKind" AS ENUM ('STATUS', 'NOTE', 'ASSIGNED', 'FOLLOW_UP', 'CONVERTED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED');

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "invitedById" TEXT;

-- AlterTable
ALTER TABLE "bulk_quotes" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "convertedOrderId" TEXT,
ADD COLUMN     "followUpAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "colors" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "adminNote" TEXT;

-- AlterTable
ALTER TABLE "order_events" ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "kind" "OrderEventKind" NOT NULL DEFAULT 'STATUS';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "trackingNumber" TEXT;

-- AlterTable: reviews move from a published flag to a moderation status.
-- HAND-EDITED. As generated, this dropped `published` before anything read it,
-- which would have silently sent every live review back to PENDING. Add the new
-- column, carry the old flag across, and only then drop it. An unpublished review
-- was one nobody had looked at yet, so it stays PENDING rather than REJECTED.
ALTER TABLE "reviews" ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedById" TEXT,
ADD COLUMN     "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "reviews" SET "status" = 'PUBLISHED' WHERE "published" = true;

-- DropIndex
DROP INDEX "reviews_published_createdAt_idx";

ALTER TABLE "reviews" DROP COLUMN "published";

-- CreateTable
CREATE TABLE "quote_events" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "kind" "QuoteEventKind" NOT NULL,
    "status" "QuoteStatus",
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quote_events_quoteId_createdAt_idx" ON "quote_events"("quoteId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_logs_entity_entityId_createdAt_idx" ON "admin_audit_logs"("entity", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actorId_createdAt_idx" ON "admin_audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bulk_quotes_convertedOrderId_key" ON "bulk_quotes"("convertedOrderId");

-- CreateIndex
CREATE INDEX "bulk_quotes_assigneeId_status_idx" ON "bulk_quotes"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "bulk_quotes_followUpAt_idx" ON "bulk_quotes"("followUpAt");

-- CreateIndex
CREATE INDEX "orders_placedAt_idx" ON "orders"("placedAt");

-- CreateIndex
CREATE INDEX "orders_status_placedAt_idx" ON "orders"("status", "placedAt");

-- CreateIndex
CREATE INDEX "reviews_status_createdAt_idx" ON "reviews"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_quotes" ADD CONSTRAINT "bulk_quotes_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_quotes" ADD CONSTRAINT "bulk_quotes_convertedOrderId_fkey" FOREIGN KEY ("convertedOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "bulk_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
