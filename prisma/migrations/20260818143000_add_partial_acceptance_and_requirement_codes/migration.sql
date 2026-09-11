ALTER TYPE "RequirementAcceptance" ADD VALUE IF NOT EXISTS 'partially_accepted';

ALTER TABLE "requirements"
  ALTER COLUMN "addedAfterConfirmation" DROP DEFAULT,
  ALTER COLUMN "addedAfterConfirmation" DROP NOT NULL;

INSERT INTO "common_code_groups" ("id", "projectId", "code", "label", "description", "sortOrder", "isActive", "isSystem", "createdAt", "updatedAt")
VALUES
  ('71000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'requirement_division', '요구사항구분', '기능·비기능 구분', 40, true, true, NOW(), NOW()),
  ('71000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'requirement_category', '요구사항분류', '신규·기능개선 분류', 41, true, true, NOW(), NOW())
ON CONFLICT ("projectId", "code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "isActive" = true,
  "updatedAt" = NOW();

INSERT INTO "common_codes" ("id", "projectId", "groupId", "groupCode", "code", "label", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT values_to_insert.*
FROM (VALUES
  ('72000000-0000-4000-8000-000000000001'::text, '20000000-0000-4000-8000-000000000001'::text, 'requirement_division'::text, 'functional'::text, '기능'::text, 1),
  ('72000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'requirement_division', 'non_functional', '비기능', 2),
  ('72000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'requirement_category', 'new', '신규', 1),
  ('72000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'requirement_category', 'improvement', '기능개선', 2)
) AS source("id", "projectId", "groupCode", "code", "label", "sortOrder")
JOIN "common_code_groups" AS groups
  ON groups."projectId" = source."projectId" AND groups."code" = source."groupCode"
CROSS JOIN LATERAL (
  SELECT source."id", source."projectId", groups."id" AS "groupId", source."groupCode", source."code", source."label", source."sortOrder", true AS "isActive", NOW() AS "createdAt", NOW() AS "updatedAt"
) AS values_to_insert
ON CONFLICT ("groupId", "code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true,
  "updatedAt" = NOW();
