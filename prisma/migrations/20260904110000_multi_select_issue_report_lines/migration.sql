-- 보고라인을 단일 선택(issues.reportLineCodeId)에서 다중 선택(issue_report_lines 조인 테이블)으로 전환한다.

CREATE TABLE "issue_report_lines" (
    "issueId" TEXT NOT NULL,
    "reportLineCodeId" TEXT NOT NULL,

    CONSTRAINT "issue_report_lines_pkey" PRIMARY KEY ("issueId", "reportLineCodeId")
);

CREATE INDEX "issue_report_lines_reportLineCodeId_idx" ON "issue_report_lines"("reportLineCodeId");

ALTER TABLE "issue_report_lines" ADD CONSTRAINT "issue_report_lines_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_report_lines" ADD CONSTRAINT "issue_report_lines_reportLineCodeId_fkey" FOREIGN KEY ("reportLineCodeId") REFERENCES "common_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 기존에 단일 선택돼 있던 보고라인 값을 조인 테이블로 이관
INSERT INTO "issue_report_lines" ("issueId", "reportLineCodeId")
SELECT "id", "reportLineCodeId" FROM "issues" WHERE "reportLineCodeId" IS NOT NULL;

ALTER TABLE "issues" DROP CONSTRAINT "issues_reportLineCodeId_fkey";
ALTER TABLE "issues" DROP COLUMN "reportLineCodeId";
