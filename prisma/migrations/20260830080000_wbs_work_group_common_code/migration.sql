-- WBS 전용 업무그룹 공통코드 도입.
-- WbsItem.groupId / WbsAssignment.groupId가 참조하던 대상을 다른 모듈(이슈·업무일지 등)과 공유하는
-- 업무그룹(groups, groupType=WORK_MODULE)에서 WBS 전용 공통코드 그룹("WBS_WORK_GROUP")으로 옮긴다.
-- 기존 참조는 라벨이 같은 새 공통코드로 재매핑하고, 새 10개 역할과 라벨이 일치하지 않는 참조는
-- WbsItem은 미지정(NULL)으로, NOT NULL인 WbsAssignment는 삭제한다(2026-08-30 사용자 승인: "이관").

-- 0) 재매핑 중에는 옛 FK(groups 참조)가 새 값(common_codes id) 쓰기를 막으므로 먼저 제거한다.
ALTER TABLE "wbs_items" DROP CONSTRAINT "wbs_items_groupId_fkey";
ALTER TABLE "wbs_assignments" DROP CONSTRAINT "wbs_assignments_groupId_fkey";

-- 1) 프로젝트별 WBS 전용 공통코드 그룹 생성
INSERT INTO "common_code_groups" ("id", "projectId", "code", "label", "description", "sortOrder", "isActive", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", 'WBS_WORK_GROUP', 'WBS 업무그룹', 'WBS Task의 R&R(지원)(모듈)·역할별 진척등록권한 Track 목록 (WBS 전용, 다른 모듈과 공유하지 않음)', 0, true, true, now(), now()
FROM "projects" p
WHERE NOT EXISTS (SELECT 1 FROM "common_code_groups" g WHERE g."projectId" = p."id" AND g."code" = 'WBS_WORK_GROUP');

-- 2) 엑셀 원본 10개 역할(WBS_EXCEL_ROLE_NAMES)을 기본 코드로 시딩
INSERT INTO "common_codes" ("id", "projectId", "groupId", "groupCode", "code", "label", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), g."projectId", g."id", g."code", roles.role_code, roles.role_label, roles.sort_order, true, now(), now()
FROM "common_code_groups" g
CROSS JOIN (VALUES
  ('PMO_IM', 'PMO/IM', 0),
  ('PM', 'PM', 1),
  ('WORK_COMMON', '업무공통', 2),
  ('BO_PLANNING', 'BO 기획', 3),
  ('FO_PLANNING', 'FO 기획', 4),
  ('DESIGN', '디자인', 5),
  ('PUBLISHING', '퍼블리싱', 6),
  ('DEV', '개발', 7),
  ('TECH', '시스템(TECH)', 8),
  ('TESTER', '테스터', 9)
) AS roles(role_code, role_label, sort_order)
WHERE g."code" = 'WBS_WORK_GROUP'
  AND NOT EXISTS (SELECT 1 FROM "common_codes" c WHERE c."groupId" = g."id" AND c."code" = roles.role_code);

-- 3) 기존 wbs_items.groupId를 같은 프로젝트·같은 라벨의 새 공통코드로 재매핑
UPDATE "wbs_items" wi
SET "groupId" = cc."id"
FROM "groups" og
JOIN "common_code_groups" ccg ON ccg."projectId" = og."projectId" AND ccg."code" = 'WBS_WORK_GROUP'
JOIN "common_codes" cc ON cc."groupId" = ccg."id" AND cc."label" = og."label"
WHERE wi."groupId" = og."id";

-- 새 10개 역할 라벨과 일치하지 않는 나머지 참조는 미지정 처리
UPDATE "wbs_items"
SET "groupId" = NULL
WHERE "groupId" IS NOT NULL AND "groupId" NOT IN (SELECT "id" FROM "common_codes");

-- 4) wbs_assignments도 동일하게 재매핑
UPDATE "wbs_assignments" wa
SET "groupId" = cc."id"
FROM "groups" og
JOIN "common_code_groups" ccg ON ccg."projectId" = og."projectId" AND ccg."code" = 'WBS_WORK_GROUP'
JOIN "common_codes" cc ON cc."groupId" = ccg."id" AND cc."label" = og."label"
WHERE wa."groupId" = og."id";

-- groupId가 NOT NULL 필수값이라, 새 10개 역할에 대응하는 항목이 없는 배정은 삭제한다
-- (원래도 WBS_EXCEL_ROLE_NAMES 밖의 라벨은 엑셀 10개 역할 컬럼 어디에도 표시되지 않던 죽은 데이터였다).
DELETE FROM "wbs_assignments"
WHERE "groupId" NOT IN (SELECT "id" FROM "common_codes");

-- 5) 외래키 대상을 common_codes로 새로 건다.
ALTER TABLE "wbs_items" ADD CONSTRAINT "wbs_items_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "common_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wbs_assignments" ADD CONSTRAINT "wbs_assignments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "common_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
