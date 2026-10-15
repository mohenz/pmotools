-- 감사로그 projectId NOT NULL 해제 (2026-10-15)
-- 스키마(projectId String?)는 처음부터 null 허용인데 init 마이그레이션이 NOT NULL로 만들어 DB와 어긋나 있었다.
-- 프로젝트에 속하지 않는 감사로그(프로젝트 순서 변경, 전역 공통코드 등록·수정)가 운영 DB에서 P2011로 실패하던 원인.
-- 제약 완화만 하며 기존 데이터 변경 없음. 이미 null 허용인 DB(로컬 등)에서는 아무 변화 없이 통과한다.
-- 롤백: ALTER TABLE "audit_logs" ALTER COLUMN "projectId" SET NOT NULL; (그 사이 생긴 projectId null 행을 먼저 정리해야 함)
ALTER TABLE "audit_logs" ALTER COLUMN "projectId" DROP NOT NULL;
