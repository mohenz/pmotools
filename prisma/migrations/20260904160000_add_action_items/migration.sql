-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('IDENTIFIED', 'IN_PROGRESS', 'DELAYED', 'ISSUE', 'CLOSED');

-- CreateTable
CREATE TABLE "management_task_detail_items" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "axisKey" TEXT NOT NULL,
    "axisScore" INTEGER NOT NULL DEFAULT 0,
    "band" "ManagementTaskBand" NOT NULL DEFAULT 'RED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "management_task_detail_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_items" (
    "id" TEXT NOT NULL,
    "detailItemId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "categoryCodeId" TEXT,
    "name" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "importance" "Priority" NOT NULL,
    "groupId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "dueDate" DATE,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "wbsItemId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "management_task_detail_items_taskId_idx" ON "management_task_detail_items"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "management_task_detail_items_taskId_axisKey_key" ON "management_task_detail_items"("taskId", "axisKey");

-- CreateIndex
CREATE INDEX "action_items_projectId_archivedAt_idx" ON "action_items"("projectId", "archivedAt");

-- CreateIndex
CREATE INDEX "action_items_projectId_status_idx" ON "action_items"("projectId", "status");

-- CreateIndex
CREATE INDEX "action_items_groupId_idx" ON "action_items"("groupId");

-- CreateIndex
CREATE INDEX "action_items_assigneeId_idx" ON "action_items"("assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "action_items_detailItemId_sequenceNo_key" ON "action_items"("detailItemId", "sequenceNo");

-- AddForeignKey
ALTER TABLE "management_task_detail_items" ADD CONSTRAINT "management_task_detail_items_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "management_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_detailItemId_fkey" FOREIGN KEY ("detailItemId") REFERENCES "management_task_detail_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_wbsItemId_fkey" FOREIGN KEY ("wbsItemId") REFERENCES "wbs_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_categoryCodeId_fkey" FOREIGN KEY ("categoryCodeId") REFERENCES "common_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: 액션아이템구분 CommonCode 그룹 (시스템 그룹, 프로젝트별로 idempotent upsert)
INSERT INTO "common_code_groups" ("id", "projectId", "code", "label", "description", "sortOrder", "isActive", "isSystem", "createdAt", "updatedAt")
SELECT '73000000-0000-4000-8000-000000000001', p."id", 'action_item_category', '액션아이템구분', '집중관리업무 액션아이템 구분', 92, true, true, NOW(), NOW()
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
  ('issue_action', '이슈조치', 1),
  ('risk_response', '리스크대응', 2),
  ('decision_request', '의사결정요청', 3),
  ('deliverable', '산출물작성', 4),
  ('review_approval', '검토승인', 5),
  ('cooperation_request', '협조요청', 6),
  ('etc', '기타', 7)
) AS source("code", "label", "sortOrder") ON true
WHERE g."code" = 'action_item_category'
ON CONFLICT ("groupId", "code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true,
  "updatedAt" = NOW();

-- Backfill: 기존 관리업무항목의 축별 Content/Percent를 세부항목(5축 고정) + 액션아이템 1건으로 변환한다.
-- percent=0이고 content가 비어있는 축은 액션아이템 없이 세부항목만 만들고 기본값(axisScore 0/RED)을 유지한다.
WITH axis_keys("axisKey") AS (
  VALUES ('prep'), ('owner'), ('progress'), ('issue'), ('close')
),
task_axis AS (
  SELECT
    t."id" AS "taskId",
    t."projectId",
    t."groupId",
    t."createdBy",
    a."axisKey",
    CASE a."axisKey"
      WHEN 'prep' THEN t."prepContent"
      WHEN 'owner' THEN t."ownerContent"
      WHEN 'progress' THEN t."progressContent"
      WHEN 'issue' THEN t."issueContent"
      WHEN 'close' THEN t."closeContent"
    END AS "content",
    CASE a."axisKey"
      WHEN 'prep' THEN t."prepPercent"
      WHEN 'owner' THEN t."ownerPercent"
      WHEN 'progress' THEN t."progressPercent"
      WHEN 'issue' THEN t."issuePercent"
      WHEN 'close' THEN t."closePercent"
    END AS "percent"
  FROM "management_tasks" t
  CROSS JOIN axis_keys a
),
inserted_details AS (
  INSERT INTO "management_task_detail_items" ("id", "taskId", "axisKey", "axisScore", "band", "createdAt", "updatedAt")
  SELECT
    gen_random_uuid()::text,
    ta."taskId",
    ta."axisKey",
    CASE
      WHEN ta."percent" = 0 AND coalesce(ta."content", '') = '' THEN 0
      WHEN ta."percent" = 100 THEN 20
      ELSE 10
    END,
    CASE
      WHEN ta."percent" = 0 AND coalesce(ta."content", '') = '' THEN 'RED'
      WHEN ta."percent" = 100 THEN 'GREEN'
      ELSE 'YELLOW'
    END::"ManagementTaskBand",
    NOW(), NOW()
  FROM task_axis ta
  RETURNING "id" AS "detailItemId", "taskId", "axisKey"
)
INSERT INTO "action_items" ("id", "detailItemId", "projectId", "sequenceNo", "name", "priority", "importance", "groupId", "assigneeId", "createdBy", "status", "note", "version", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  d."detailItemId",
  ta."projectId",
  1,
  (CASE ta."axisKey" WHEN 'prep' THEN '일정관리' WHEN 'owner' THEN '범위관리' WHEN 'progress' THEN '자원관리' WHEN 'issue' THEN '소통관리' WHEN 'close' THEN '품질관리' END) || ' 기존 데이터',
  'MEDIUM'::"Priority",
  'MEDIUM'::"Priority",
  ta."groupId",
  ta."createdBy",
  ta."createdBy",
  CASE WHEN ta."percent" = 100 THEN 'CLOSED' WHEN ta."percent" > 0 THEN 'IN_PROGRESS' ELSE 'IDENTIFIED' END::"ActionItemStatus",
  coalesce(ta."content", ''),
  1,
  NOW(), NOW()
FROM inserted_details d
JOIN task_axis ta ON ta."taskId" = d."taskId" AND ta."axisKey" = d."axisKey"
WHERE ta."percent" > 0 OR coalesce(ta."content", '') <> '';

-- AlterTable: 백필이 끝난 뒤에야 레거시 축 Content/Percent 컬럼을 제거한다.
ALTER TABLE "management_tasks" DROP COLUMN "closeContent",
DROP COLUMN "closePercent",
DROP COLUMN "issueContent",
DROP COLUMN "issuePercent",
DROP COLUMN "ownerContent",
DROP COLUMN "ownerPercent",
DROP COLUMN "prepContent",
DROP COLUMN "prepPercent",
DROP COLUMN "progressContent",
DROP COLUMN "progressPercent";
