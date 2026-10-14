-- 계정 역할 통일(2026-09-29) 데이터 전환 R-3: 프로젝트 운영자 → 계정 운영자
-- 대상: 계정 역할이 일반(MEMBER)이고, 어느 프로젝트에서든 활성 소속의 프로젝트 역할이 운영자(OPERATOR)인 사용자.
-- 프로젝트 관리자(ADMIN)였던 사용자는 자동 전환하지 않는다(R-2, 백오피스에서 직접 지정).
-- 되돌리기용으로 대상자를 감사로그(action USER_ACCOUNT_ROLE_MIGRATION)에 먼저 남긴다.
--   원복: UPDATE "users" SET "role"='MEMBER' WHERE "id" IN (SELECT "targetId" FROM "audit_logs" WHERE "action"='USER_ACCOUNT_ROLE_MIGRATION') AND "role"='OPERATOR';

INSERT INTO "audit_logs" ("id", "projectId", "actorId", "actorName", "action", "targetTable", "targetId", "beforeData", "afterData", "createdAt")
SELECT gen_random_uuid(), NULL, NULL, '시스템(마이그레이션 20260929160000)', 'USER_ACCOUNT_ROLE_MIGRATION', 'users', u."id", '{"role":"MEMBER"}'::jsonb, '{"role":"OPERATOR"}'::jsonb, now()
FROM "users" u
WHERE u."role" = 'MEMBER' AND u."deletedAt" IS NULL
  AND EXISTS (SELECT 1 FROM "project_members" m WHERE m."userId" = u."id" AND m."role" = 'OPERATOR' AND m."isActive");

UPDATE "users" u SET "role" = 'OPERATOR', "updatedAt" = now()
WHERE u."role" = 'MEMBER' AND u."deletedAt" IS NULL
  AND EXISTS (SELECT 1 FROM "project_members" m WHERE m."userId" = u."id" AND m."role" = 'OPERATOR' AND m."isActive");
