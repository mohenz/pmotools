-- 단위테스트 시나리오 제거(2026-10-21 사용자 확정: 단위테스트 단계에는 시나리오 ID 불필요)
-- 시나리오가 갖던 업무단위·프로그램·요구사항·PL·검토 이력을 케이스로 옮기고 ut_scenarios를 삭제한다.
-- 대상은 미배포 단위테스트 테이블뿐이며, 기존 업무 테이블(wbs_items·groups·users 등)의 구조·데이터는 바꾸지 않는다.
-- 케이스 ID는 UTC-{WBS 번호}-{순번 3자리}(WBS 없음: UTC-NOWBS-{순번 4자리})로 다시 매긴다(수행·결함은 케이스 id로 연결되어 영향 없음).

-- 1) 케이스 상태에 '반려' 추가(케이스 단위 PL 검토)
ALTER TYPE "UtCaseStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- 2) 케이스에 시나리오 값 칼럼 추가 후 복사
ALTER TABLE "ut_cases"
  ADD COLUMN "groupId" TEXT,
  ADD COLUMN "programId" TEXT,
  ADD COLUMN "requirementId" TEXT,
  ADD COLUMN "plUserId" TEXT,
  ADD COLUMN "reviewRequestedAt" TIMESTAMP(3),
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedBy" TEXT,
  ADD COLUMN "rejectReason" TEXT NOT NULL DEFAULT '';

UPDATE "ut_cases" c SET
  "groupId" = s."groupId", "programId" = s."programId", "requirementId" = s."requirementId", "plUserId" = s."plUserId",
  "reviewRequestedAt" = s."reviewRequestedAt", "approvedAt" = s."approvedAt", "approvedBy" = s."approvedBy", "rejectReason" = s."rejectReason",
  "wbsItemId" = s."wbsItemId",
  -- 보관된 시나리오의 케이스는 비활성으로 남긴다.
  "isActive" = c."isActive" AND s."archivedAt" IS NULL
FROM "ut_scenarios" s WHERE s."id" = c."scenarioId";

-- 3) 케이스 ID 재채번 — WBS별(없으면 프로젝트별) 기존 ID 순서대로
WITH ranked AS (
  SELECT c."id", c."wbsItemId", c."projectId", w."displayId" AS "wbsDisplayId",
         ROW_NUMBER() OVER (PARTITION BY c."projectId", COALESCE(c."wbsItemId", '') ORDER BY c."displayId") AS rn
  FROM "ut_cases" c LEFT JOIN "wbs_items" w ON w."id" = c."wbsItemId"
)
UPDATE "ut_cases" c SET
  "seq" = r.rn,
  "displayId" = CASE WHEN r."wbsItemId" IS NULL THEN 'UTC-NOWBS-' || LPAD(r.rn::text, 4, '0')
                     ELSE 'UTC-' || REGEXP_REPLACE(r."wbsDisplayId", '^WBS-', '') || '-' || LPAD(r.rn::text, 3, '0') END
FROM ranked r WHERE r."id" = c."id";

-- 4) 채번 순번 — 시나리오 기준 scope를 케이스 기준으로 교체
DELETE FROM "ut_sequences" WHERE "scope" LIKE 'scenario:%' OR "scope" LIKE 'case:%';
INSERT INTO "ut_sequences" ("scope", "value")
SELECT CASE WHEN "wbsItemId" IS NULL THEN 'case:nowbs:' || "projectId" ELSE 'case:' || "wbsItemId" END, MAX("seq")
FROM "ut_cases" GROUP BY "projectId", "wbsItemId";

-- 5) 이관 이력: 시나리오 → 케이스(미구현 기능이라 행 없음)
ALTER TABLE "ut_wbs_migrations" DROP CONSTRAINT "ut_wbs_migrations_scenarioId_fkey";
DELETE FROM "ut_wbs_migrations";
ALTER TABLE "ut_wbs_migrations" DROP COLUMN "scenarioId", ADD COLUMN "caseId" TEXT NOT NULL;

-- 6) 시나리오 연결 제거, 필수 칼럼 확정
ALTER TABLE "ut_cases" DROP CONSTRAINT "ut_cases_scenarioId_fkey";
DROP INDEX "ut_cases_scenarioId_idx";
ALTER TABLE "ut_cases" DROP COLUMN "scenarioId";
ALTER TABLE "ut_cases" ALTER COLUMN "groupId" SET NOT NULL;

-- 7) 시나리오 테이블·상태 enum 삭제
DROP TABLE "ut_scenarios";
DROP TYPE "UtScenarioStatus";

-- 8) 인덱스·외래키
CREATE INDEX "ut_cases_projectId_isActive_status_idx" ON "ut_cases"("projectId", "isActive", "status");
CREATE INDEX "ut_cases_plUserId_status_idx" ON "ut_cases"("plUserId", "status");
ALTER TABLE "ut_cases" ADD CONSTRAINT "ut_cases_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ut_cases" ADD CONSTRAINT "ut_cases_wbsItemId_fkey" FOREIGN KEY ("wbsItemId") REFERENCES "wbs_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ut_cases" ADD CONSTRAINT "ut_cases_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ut_cases" ADD CONSTRAINT "ut_cases_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ut_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ut_cases" ADD CONSTRAINT "ut_cases_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ut_cases" ADD CONSTRAINT "ut_cases_plUserId_fkey" FOREIGN KEY ("plUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ut_cases" ADD CONSTRAINT "ut_cases_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ut_wbs_migrations" ADD CONSTRAINT "ut_wbs_migrations_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ut_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
