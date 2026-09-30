-- 산출물 확장자를 고정 enum 대신 공통코드(common_codes, groupCode="deliverable_extension")로 관리한다.

ALTER TABLE "work_logs" DROP COLUMN "deliverableExtension";
DROP TYPE "DeliverableExtension";

ALTER TABLE "work_logs" ADD COLUMN "deliverableExtensionCodeId" TEXT;

CREATE INDEX "work_logs_deliverableExtensionCodeId_idx" ON "work_logs"("deliverableExtensionCodeId");

ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_deliverableExtensionCodeId_fkey" FOREIGN KEY ("deliverableExtensionCodeId") REFERENCES "common_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 프로젝트별 "산출물 확장자" 공통코드그룹 + 코드 시딩
INSERT INTO "common_code_groups" ("id", "projectId", "code", "label", "description", "sortOrder", "isActive", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."id", 'deliverable_extension', '산출물 확장자', 'WBS상세내용 산출물의 파일 확장자', 60, true, true, NOW(), NOW()
FROM "projects" p
ON CONFLICT ("projectId", "code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "isActive" = true,
  "updatedAt" = NOW();

INSERT INTO "common_codes" ("id", "projectId", "groupId", "groupCode", "code", "label", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, g."projectId", g."id", g."code", source."code", source."label", source."sortOrder", true, NOW(), NOW()
FROM "common_code_groups" g
JOIN (VALUES
  ('PPTX', 'PPTX', 1),
  ('XLSX', 'XLSX', 2),
  ('DOCX', 'DOCX', 3),
  ('PDF', 'PDF', 4),
  ('MD', 'MD', 5),
  ('TXT', 'TXT', 6)
) AS source("code", "label", "sortOrder") ON true
WHERE g."code" = 'deliverable_extension'
ON CONFLICT ("groupId", "code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true,
  "updatedAt" = NOW();
