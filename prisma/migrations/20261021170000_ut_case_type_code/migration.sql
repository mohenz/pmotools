-- 케이스유형을 공통코드로 관리(2026-10-21 사용자 확정) — 항목: 화면·기능·API.
-- 기존 케이스유형(정상·예외·경계)과 우선순위(H·M·L)는 화면에서 삭제하기로 해 칼럼·enum을 제거한다(미배포 단위테스트 테이블만 변경).

ALTER TABLE "ut_cases" DROP COLUMN "caseType", DROP COLUMN "priority", ADD COLUMN "caseTypeCodeId" TEXT;
DROP TYPE "UtPriority";
DROP TYPE "UtCaseType";
ALTER TABLE "ut_cases" ADD CONSTRAINT "ut_cases_caseTypeCodeId_fkey" FOREIGN KEY ("caseTypeCodeId") REFERENCES "common_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 공통코드 그룹 ut_case_type 시딩 — 기존 프로젝트 전체. 이후 생성되는 프로젝트는 서버가 처음 사용할 때 생성한다.
INSERT INTO "common_code_groups" ("id", "projectId", "code", "label", "description", "sortOrder", "isActive", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", 'ut_case_type', '단위테스트 케이스유형', '단위테스트 케이스 분류(화면·기능·API)', 903, true, true, now(), now()
FROM "projects" p
WHERE NOT EXISTS (SELECT 1 FROM "common_code_groups" cg WHERE cg."projectId" = p."id" AND cg."code" = 'ut_case_type');

INSERT INTO "common_codes" ("id", "projectId", "groupId", "groupCode", "code", "label", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), cg."projectId", cg."id", cg."code", v.code, v.label, v.sort_order, true, now(), now()
FROM "common_code_groups" cg
JOIN (VALUES ('SCREEN', '화면', 0), ('FUNCTION', '기능', 1), ('API', 'API', 2)) AS v(code, label, sort_order) ON cg."code" = 'ut_case_type'
WHERE cg."projectId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "common_codes" c WHERE c."groupId" = cg."id" AND c."code" = v.code);
