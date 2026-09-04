-- 이슈진행정보(DETAIL)를 "최초 등록 때와 같은 전체 필드를 갖춘 스냅샷"으로 확장한다.
-- 이제 진행 이력을 추가하는 것이 이슈 정보를 갱신하는 유일한 방법이 되므로, 등록 화면과
-- 동일한 필드 구성(이슈구분/이슈명/이슈내용/중요도/우선순위/해결기한/담당자/대응전략/
-- 에스컬레이션여부/보고라인/비고)을 issue_progress_entries에도 갖춘다.

ALTER TABLE "issue_progress_entries" ADD COLUMN "categoryCodeId" TEXT;
ALTER TABLE "issue_progress_entries" ADD COLUMN "title" TEXT;
ALTER TABLE "issue_progress_entries" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "issue_progress_entries" ADD COLUMN "importance" "ProbabilityLevel";
ALTER TABLE "issue_progress_entries" ADD COLUMN "priority" "ProbabilityLevel";
ALTER TABLE "issue_progress_entries" ADD COLUMN "dueAt" DATE;
ALTER TABLE "issue_progress_entries" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "issue_progress_entries" ADD COLUMN "ownerName" TEXT;
ALTER TABLE "issue_progress_entries" ADD COLUMN "responseContent" TEXT NOT NULL DEFAULT '';
ALTER TABLE "issue_progress_entries" ADD COLUMN "escalated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "issue_progress_entries" ADD COLUMN "remark" TEXT NOT NULL DEFAULT '';

-- 기존 진행 항목은 부모 이슈(당시 최신 상태)의 값으로 백필한다.
UPDATE "issue_progress_entries" pe
SET "categoryCodeId" = i."categoryCodeId", "title" = i."title", "description" = i."description",
    "importance" = i."importance", "priority" = i."priority", "dueAt" = i."dueAt",
    "ownerUserId" = i."ownerUserId", "ownerName" = i."ownerName", "responseContent" = i."responseContent",
    "escalated" = i."escalated", "remark" = i."remark"
FROM "issues" i
WHERE pe."issueId" = i."id";

ALTER TABLE "issue_progress_entries" ALTER COLUMN "categoryCodeId" SET NOT NULL;
ALTER TABLE "issue_progress_entries" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "issue_progress_entries" ALTER COLUMN "importance" SET NOT NULL;
ALTER TABLE "issue_progress_entries" ALTER COLUMN "priority" SET NOT NULL;

ALTER TABLE "issue_progress_entries" DROP COLUMN "content";

ALTER TABLE "issue_progress_entries" ADD CONSTRAINT "issue_progress_entries_categoryCodeId_fkey" FOREIGN KEY ("categoryCodeId") REFERENCES "common_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "issue_progress_entries" ADD CONSTRAINT "issue_progress_entries_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "issue_progress_report_lines" (
    "progressId" TEXT NOT NULL,
    "reportLineCodeId" TEXT NOT NULL,

    CONSTRAINT "issue_progress_report_lines_pkey" PRIMARY KEY ("progressId", "reportLineCodeId")
);

CREATE INDEX "issue_progress_report_lines_reportLineCodeId_idx" ON "issue_progress_report_lines"("reportLineCodeId");

ALTER TABLE "issue_progress_report_lines" ADD CONSTRAINT "issue_progress_report_lines_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "issue_progress_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_progress_report_lines" ADD CONSTRAINT "issue_progress_report_lines_reportLineCodeId_fkey" FOREIGN KEY ("reportLineCodeId") REFERENCES "common_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 기존 진행 항목에는 당시 이슈에 걸려 있던 보고라인을 동일하게 이관한다.
INSERT INTO "issue_progress_report_lines" ("progressId", "reportLineCodeId")
SELECT pe."id", irl."reportLineCodeId"
FROM "issue_progress_entries" pe
JOIN "issue_report_lines" irl ON irl."issueId" = pe."issueId";
