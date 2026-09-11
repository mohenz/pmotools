CREATE TYPE "ManagementTaskStatus" AS ENUM ('IDENTIFIED', 'IN_PROGRESS', 'ISSUE_TRANSFERRED', 'RISK_TRANSFERRED', 'CLOSED');

ALTER TABLE "management_tasks"
ADD COLUMN "status" "ManagementTaskStatus" NOT NULL DEFAULT 'IDENTIFIED',
ADD COLUMN "purpose" TEXT NOT NULL DEFAULT '',
ADD COLUMN "impactAnalysis" TEXT NOT NULL DEFAULT '';

CREATE TABLE "management_task_assignees" (
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "management_task_assignees_pkey" PRIMARY KEY ("taskId", "userId")
);

CREATE INDEX "management_task_assignees_userId_idx" ON "management_task_assignees"("userId");

ALTER TABLE "management_task_assignees" ADD CONSTRAINT "management_task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "management_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "management_task_assignees" ADD CONSTRAINT "management_task_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
