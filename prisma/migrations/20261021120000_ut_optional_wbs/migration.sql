-- WBS ID 없는 단위테스트 등록 허용(2026-10-21 사용자 확정) — UT 테이블 5개의 wbsItemId NOT NULL 해제. 기존 테이블·데이터 변경 없음.
-- AlterTable
ALTER TABLE "ut_scenarios" ALTER COLUMN "wbsItemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ut_cases" ALTER COLUMN "wbsItemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ut_executions" ALTER COLUMN "wbsItemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ut_approvals" ALTER COLUMN "wbsItemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ut_defects" ALTER COLUMN "wbsItemId" DROP NOT NULL;
