-- 지연테스크관리 테이블 — 실적종료일 저장 시 지연일자(영업일)가 1 이상이면 자동으로 한 건씩 쌓이는 이력 로그.
-- 테스크명·업무그룹·담당자는 등록 시점 값을 스냅샷으로 보존한다(2026-09-05 사용자 요청).

CREATE TABLE "wbs_delayed_tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wbsItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plannedStartDate" DATE,
    "plannedDueDate" DATE,
    "actualStartDate" DATE,
    "actualDueDate" DATE NOT NULL,
    "delayedCompletionDate" DATE NOT NULL,
    "delayDays" INTEGER NOT NULL,
    "groupLabel" TEXT,
    "ownerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wbs_delayed_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wbs_delayed_tasks_projectId_createdAt_idx" ON "wbs_delayed_tasks"("projectId", "createdAt");

CREATE INDEX "wbs_delayed_tasks_wbsItemId_idx" ON "wbs_delayed_tasks"("wbsItemId");

ALTER TABLE "wbs_delayed_tasks" ADD CONSTRAINT "wbs_delayed_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wbs_delayed_tasks" ADD CONSTRAINT "wbs_delayed_tasks_wbsItemId_fkey" FOREIGN KEY ("wbsItemId") REFERENCES "wbs_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
