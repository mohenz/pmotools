-- 이슈관리를 MASTER(issues)/DETAIL(issue_progress_entries) 구조로 전환한다.
-- PM/PMO가 이슈 진행 상황을 시점별로 기록하면(DETAIL), 가장 최근 항목의 상태·작성자·일자가
-- MASTER(issues.status/lastModifiedBy/updatedAt)에 자동 반영된다. 직접 텍스트로만 관리하던
-- issues.history 컬럼은 폐기하고, 구조화된 진행 이력 테이블로 대체한다.

ALTER TABLE "issues" DROP COLUMN "history";
ALTER TABLE "issues" ADD COLUMN "lastModifiedBy" TEXT;
ALTER TABLE "issues" ADD COLUMN "lastModifiedByName" TEXT;

CREATE TABLE "issue_progress_entries" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "status" "IssueStatus" NOT NULL,
    "content" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_progress_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "issue_progress_entries_issueId_entryDate_idx" ON "issue_progress_entries"("issueId", "entryDate");

ALTER TABLE "issues" ADD CONSTRAINT "issues_lastModifiedBy_fkey" FOREIGN KEY ("lastModifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "issue_progress_entries" ADD CONSTRAINT "issue_progress_entries_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_progress_entries" ADD CONSTRAINT "issue_progress_entries_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 기존에 등록된 이슈가 있다면 현재 상태를 최초 진행 항목으로 이관해 "이슈마다 진행 항목이 1건 이상 존재"하는 불변식을 지킨다.
INSERT INTO "issue_progress_entries" ("id", "issueId", "entryDate", "status", "content", "actorId", "actorName", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", "occurredAt", "status", '기존 데이터 이관', "createdBy", NULL, "createdAt", "createdAt"
FROM "issues";

UPDATE "issues" SET "lastModifiedBy" = "createdBy";
