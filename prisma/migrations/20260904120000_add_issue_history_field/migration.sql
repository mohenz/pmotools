-- 이력은 시스템이 자동으로 쌓아가는 로그가 아니라, 사용자가 다른 필드와 동일한 수준으로
-- 직접 관리·갱신하는 단일 정보여야 한다는 요청에 따라 issues.history 컬럼을 추가한다.
ALTER TABLE "issues" ADD COLUMN "history" TEXT NOT NULL DEFAULT '';
