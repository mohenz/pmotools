-- 단위테스트 대상 구분(2026-10-21) — WBS 항목에 체크 값을 두고, 단위테스트 관리는 개발 단계 Leaf 중 체크된 Task만 읽어 쓴다.
-- 기존 테이블 변경은 컬럼 추가 1건뿐이다(DROP 없음, 기존 행은 false).
ALTER TABLE "wbs_items" ADD COLUMN "isUnitTestTarget" BOOLEAN NOT NULL DEFAULT false;
