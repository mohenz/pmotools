CREATE TYPE "WorkLogStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

CREATE TABLE "work_logs" (
  "id" TEXT NOT NULL,
  "displayId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "groupId" TEXT NOT NULL,
  "assigneeId" TEXT NOT NULL,
  "wbsNumber" TEXT NOT NULL DEFAULT '',
  "status" "WorkLogStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "workContent" TEXT NOT NULL,
  "referenceContent" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "work_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_log_sequences" (
  "projectId" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "work_log_sequences_pkey" PRIMARY KEY ("projectId")
);

CREATE UNIQUE INDEX "work_logs_displayId_key" ON "work_logs"("displayId");
CREATE INDEX "work_logs_projectId_workDate_idx" ON "work_logs"("projectId", "workDate");
CREATE INDEX "work_logs_projectId_assigneeId_workDate_idx" ON "work_logs"("projectId", "assigneeId", "workDate");
CREATE INDEX "work_logs_groupId_idx" ON "work_logs"("groupId");

ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_log_sequences" ADD CONSTRAINT "work_log_sequences_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
