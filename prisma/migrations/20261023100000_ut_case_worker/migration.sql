-- 케이스 작업자(2026-10-23 사용자 확정) — 작성자가 WBS ID를 선택해 저장할 때 그 시점의 WBS Task 담당자를 함께 저장한다(스냅샷).
-- NULL 허용·기본값 컬럼 추가만 하므로 기존 행은 변경되지 않는다. 롤백: 두 컬럼 DROP.
ALTER TABLE "ut_cases" ADD COLUMN "workerUserId" TEXT, ADD COLUMN "workerName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ut_cases" ADD CONSTRAINT "ut_cases_workerUserId_fkey" FOREIGN KEY ("workerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ut_cases_workerUserId_idx" ON "ut_cases"("workerUserId");
