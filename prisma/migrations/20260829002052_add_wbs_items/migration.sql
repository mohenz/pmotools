-- CreateEnum
CREATE TYPE "WbsItemStatus" AS ENUM ('not_started', 'in_progress', 'completed', 'on_hold');

-- CreateEnum
CREATE TYPE "WbsItemEventType" AS ENUM ('created', 'edited', 'moved', 'status_changed', 'archived');

-- CreateTable
CREATE TABLE "wbs_items" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "path" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "ownerUserId" TEXT,
    "groupId" TEXT,
    "startDate" DATE,
    "dueDate" DATE,
    "status" "WbsItemStatus" NOT NULL DEFAULT 'not_started',
    "createdBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "wbs_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wbs_item_sequences" (
    "projectId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "wbs_item_sequences_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "wbs_item_events" (
    "id" TEXT NOT NULL,
    "wbsItemId" TEXT NOT NULL,
    "eventType" "WbsItemEventType" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "body" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wbs_item_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wbs_items_displayId_key" ON "wbs_items"("displayId");

-- CreateIndex
CREATE INDEX "wbs_items_projectId_archivedAt_idx" ON "wbs_items"("projectId", "archivedAt");

-- CreateIndex
CREATE INDEX "wbs_items_projectId_path_idx" ON "wbs_items"("projectId", "path");

-- CreateIndex
CREATE INDEX "wbs_items_parentId_idx" ON "wbs_items"("parentId");

-- CreateIndex
CREATE INDEX "wbs_item_events_wbsItemId_createdAt_idx" ON "wbs_item_events"("wbsItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "wbs_items" ADD CONSTRAINT "wbs_items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_items" ADD CONSTRAINT "wbs_items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "wbs_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_items" ADD CONSTRAINT "wbs_items_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_items" ADD CONSTRAINT "wbs_items_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_items" ADD CONSTRAINT "wbs_items_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_item_sequences" ADD CONSTRAINT "wbs_item_sequences_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_item_events" ADD CONSTRAINT "wbs_item_events_wbsItemId_fkey" FOREIGN KEY ("wbsItemId") REFERENCES "wbs_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_item_events" ADD CONSTRAINT "wbs_item_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

