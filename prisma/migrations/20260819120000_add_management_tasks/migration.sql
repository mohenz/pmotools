-- CreateEnum
CREATE TYPE "ManagementTaskBand" AS ENUM ('RED', 'YELLOW', 'GREEN');

-- CreateTable
CREATE TABLE "management_tasks" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationDate" DATE NOT NULL,
    "prepContent" TEXT NOT NULL DEFAULT '',
    "prepPercent" INTEGER NOT NULL DEFAULT 0,
    "ownerContent" TEXT NOT NULL DEFAULT '',
    "ownerPercent" INTEGER NOT NULL DEFAULT 0,
    "progressContent" TEXT NOT NULL DEFAULT '',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "issueContent" TEXT NOT NULL DEFAULT '',
    "issuePercent" INTEGER NOT NULL DEFAULT 0,
    "closeContent" TEXT NOT NULL DEFAULT '',
    "closePercent" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "band" "ManagementTaskBand" NOT NULL DEFAULT 'RED',
    "createdBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "management_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_task_sequences" (
    "projectId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "management_task_sequences_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "management_task_links" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "predecessorId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "management_task_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "management_tasks_displayId_key" ON "management_tasks"("displayId");

-- CreateIndex
CREATE INDEX "management_tasks_projectId_archivedAt_idx" ON "management_tasks"("projectId", "archivedAt");

-- CreateIndex
CREATE INDEX "management_tasks_projectId_groupId_idx" ON "management_tasks"("projectId", "groupId");

-- CreateIndex
CREATE INDEX "management_tasks_projectId_band_idx" ON "management_tasks"("projectId", "band");

-- CreateIndex
CREATE INDEX "management_task_links_projectId_predecessorId_idx" ON "management_task_links"("projectId", "predecessorId");

-- CreateIndex
CREATE INDEX "management_task_links_projectId_successorId_idx" ON "management_task_links"("projectId", "successorId");

-- CreateIndex
CREATE UNIQUE INDEX "management_task_links_predecessorId_successorId_key" ON "management_task_links"("predecessorId", "successorId");

-- AddForeignKey
ALTER TABLE "management_tasks" ADD CONSTRAINT "management_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_tasks" ADD CONSTRAINT "management_tasks_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_tasks" ADD CONSTRAINT "management_tasks_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_task_sequences" ADD CONSTRAINT "management_task_sequences_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_task_links" ADD CONSTRAINT "management_task_links_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_task_links" ADD CONSTRAINT "management_task_links_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "management_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_task_links" ADD CONSTRAINT "management_task_links_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "management_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_task_links" ADD CONSTRAINT "management_task_links_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

