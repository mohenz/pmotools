CREATE TYPE "PmoDelayedTaskStatus" AS ENUM ('IDENTIFIED', 'ACTION_IN_PROGRESS', 'NORMALIZED', 'CLOSED');

CREATE TABLE "pmo_daily_snapshots" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "reportDate" DATE NOT NULL,
  "plannedProgress" INTEGER NOT NULL DEFAULT 0,
  "actualProgress" INTEGER NOT NULL DEFAULT 0,
  "totalTaskCount" INTEGER NOT NULL DEFAULT 0,
  "completedTaskCount" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pmo_daily_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pmo_delayed_tasks" (
  "id" TEXT NOT NULL,
  "displayId" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "plannedProgress" INTEGER NOT NULL,
  "actualProgress" INTEGER NOT NULL,
  "plannedEndDate" DATE,
  "delayReason" TEXT NOT NULL DEFAULT '',
  "responsePlan" TEXT NOT NULL DEFAULT '',
  "status" "PmoDelayedTaskStatus" NOT NULL DEFAULT 'IDENTIFIED',
  "createdBy" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "pmo_delayed_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pmo_delayed_task_assignees" (
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "pmo_delayed_task_assignees_pkey" PRIMARY KEY ("taskId", "userId")
);

CREATE TABLE "pmo_delayed_task_sequences" (
  "projectId" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "pmo_delayed_task_sequences_pkey" PRIMARY KEY ("projectId")
);

CREATE UNIQUE INDEX "pmo_daily_snapshots_projectId_reportDate_key" ON "pmo_daily_snapshots"("projectId", "reportDate");
CREATE INDEX "pmo_daily_snapshots_projectId_reportDate_idx" ON "pmo_daily_snapshots"("projectId", "reportDate");
CREATE UNIQUE INDEX "pmo_delayed_tasks_displayId_key" ON "pmo_delayed_tasks"("displayId");
CREATE INDEX "pmo_delayed_tasks_snapshotId_archivedAt_idx" ON "pmo_delayed_tasks"("snapshotId", "archivedAt");
CREATE INDEX "pmo_delayed_tasks_groupId_idx" ON "pmo_delayed_tasks"("groupId");
CREATE INDEX "pmo_delayed_task_assignees_userId_idx" ON "pmo_delayed_task_assignees"("userId");

ALTER TABLE "pmo_daily_snapshots" ADD CONSTRAINT "pmo_daily_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pmo_daily_snapshots" ADD CONSTRAINT "pmo_daily_snapshots_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pmo_delayed_tasks" ADD CONSTRAINT "pmo_delayed_tasks_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "pmo_daily_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pmo_delayed_tasks" ADD CONSTRAINT "pmo_delayed_tasks_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pmo_delayed_tasks" ADD CONSTRAINT "pmo_delayed_tasks_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pmo_delayed_task_assignees" ADD CONSTRAINT "pmo_delayed_task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "pmo_delayed_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pmo_delayed_task_assignees" ADD CONSTRAINT "pmo_delayed_task_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pmo_delayed_task_sequences" ADD CONSTRAINT "pmo_delayed_task_sequences_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
