-- 케이스 화면 URL(2026-10-23 사용자 확정) — 테스트 대상 화면의 주소를 수기 입력한다.
-- 기본값이 있는 컬럼 추가만 하므로 기존 행은 빈 값으로 채워진다. 롤백: 컬럼 DROP.
ALTER TABLE "ut_cases" ADD COLUMN "screenUrl" TEXT NOT NULL DEFAULT '';
