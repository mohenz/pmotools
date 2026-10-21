-- 케이스 화면ID·화면명 수기 입력(2026-10-21 사용자 확정) — 프로그램 목록 선택(programId)을 대체한다.
-- 미배포 단위테스트 테이블(ut_cases)만 변경. 기존에 프로그램이 지정된 케이스는 그 값을 옮긴 뒤 연결을 지운다.
ALTER TABLE "ut_cases" ADD COLUMN "screenId" TEXT NOT NULL DEFAULT '', ADD COLUMN "screenName" TEXT NOT NULL DEFAULT '';
UPDATE "ut_cases" c SET "screenId" = p."screenId", "screenName" = p."name" FROM "ut_programs" p WHERE p."id" = c."programId";
ALTER TABLE "ut_cases" DROP CONSTRAINT "ut_cases_programId_fkey";
ALTER TABLE "ut_cases" DROP COLUMN "programId";
