-- 결함관리 (설계: docs/결함관리 프로그램 설계서.md, 2026-10-24 승인) — 신규 테이블 추가만 한다.
-- 규칙 1: 단위테스트(ut_*) 테이블과 wbs_items·requirements 에는 외래 키를 만들지 않는다(소프트 참조).
-- 기존 테이블의 컬럼·데이터는 바꾸지 않는다. 롤백: 이 마이그레이션이 만든 테이블·타입·함수 DROP.

-- CreateEnum
CREATE TYPE "DefectSource" AS ENUM ('MANUAL', 'ENTRY', 'WIDGET', 'EXTENSION');

-- CreateEnum
CREATE TYPE "DefectStatusClassType" AS ENUM ('OPEN', 'DONE', 'CLOSED');

-- CreateEnum
CREATE TYPE "DefectHistoryAction" AS ENUM ('CREATE', 'UPDATE', 'ASSIGN', 'STATUS', 'LINK', 'DELETE');

-- CreateTable
CREATE TABLE "defects" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "stepsToRepro" TEXT NOT NULL DEFAULT '',
    "testStageCodeId" TEXT NOT NULL,
    "severityCodeId" TEXT NOT NULL,
    "priorityCodeId" TEXT,
    "statusCodeId" TEXT NOT NULL,
    "identificationCodeId" TEXT,
    "screenPath" TEXT NOT NULL DEFAULT '',
    "menuName" TEXT NOT NULL DEFAULT '',
    "screenName" TEXT NOT NULL DEFAULT '',
    "screenUrl" TEXT NOT NULL DEFAULT '',
    "envInfo" TEXT NOT NULL DEFAULT '',
    "groupId" TEXT,
    "wbsItemId" TEXT,
    "caseId" TEXT,
    "executionId" TEXT,
    "requirementId" TEXT,
    "createdBy" TEXT NOT NULL,
    "assigneeUserId" TEXT,
    "actionComment" TEXT NOT NULL DEFAULT '',
    "actionDueDate" DATE,
    "actionStartDate" DATE,
    "actionEndDate" DATE,
    "sourceType" "DefectSource" NOT NULL DEFAULT 'MANUAL',
    "sourceMeta" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defect_histories" (
    "id" TEXT NOT NULL,
    "defectId" TEXT NOT NULL,
    "action" "DefectHistoryAction" NOT NULL,
    "statusBeforeCodeId" TEXT,
    "statusAfterCodeId" TEXT,
    "changedData" JSONB NOT NULL DEFAULT '{}',
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "defect_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defect_evidences" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "defectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "defect_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defect_status_classes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "statusCodeId" TEXT NOT NULL,
    "statusClass" "DefectStatusClassType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defect_status_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defect_severity_settings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "severityCodeId" TEXT NOT NULL,
    "isMajorImpact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defect_severity_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wbs_item_test_stages" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wbsItemId" TEXT NOT NULL,
    "testStageCodeId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wbs_item_test_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defect_target_sites" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defect_target_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defect_screens" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "pathKey" TEXT NOT NULL,
    "url" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defect_screens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defect_sequences" (
    "scope" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 5000,

    CONSTRAINT "defect_sequences_pkey" PRIMARY KEY ("scope")
);

-- CreateIndex
CREATE INDEX "defects_projectId_isActive_statusCodeId_idx" ON "defects"("projectId", "isActive", "statusCodeId");

-- CreateIndex
CREATE INDEX "defects_projectId_testStageCodeId_idx" ON "defects"("projectId", "testStageCodeId");

-- CreateIndex
CREATE INDEX "defects_projectId_createdAt_idx" ON "defects"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "defects_assigneeUserId_idx" ON "defects"("assigneeUserId");

-- CreateIndex
CREATE INDEX "defects_createdBy_idx" ON "defects"("createdBy");

-- CreateIndex
CREATE INDEX "defects_caseId_idx" ON "defects"("caseId");

-- CreateIndex
CREATE INDEX "defects_wbsItemId_idx" ON "defects"("wbsItemId");

-- CreateIndex
CREATE INDEX "defects_groupId_idx" ON "defects"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "defects_projectId_displayId_key" ON "defects"("projectId", "displayId");

-- CreateIndex
CREATE INDEX "defect_histories_defectId_createdAt_idx" ON "defect_histories"("defectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "defect_evidences_storageKey_key" ON "defect_evidences"("storageKey");

-- CreateIndex
CREATE INDEX "defect_evidences_defectId_idx" ON "defect_evidences"("defectId");

-- CreateIndex
CREATE INDEX "defect_evidences_projectId_idx" ON "defect_evidences"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "defect_status_classes_projectId_statusCodeId_key" ON "defect_status_classes"("projectId", "statusCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "defect_severity_settings_projectId_severityCodeId_key" ON "defect_severity_settings"("projectId", "severityCodeId");

-- CreateIndex
CREATE INDEX "wbs_item_test_stages_projectId_testStageCodeId_idx" ON "wbs_item_test_stages"("projectId", "testStageCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "wbs_item_test_stages_wbsItemId_testStageCodeId_key" ON "wbs_item_test_stages"("wbsItemId", "testStageCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "defect_target_sites_projectId_origin_key" ON "defect_target_sites"("projectId", "origin");

-- CreateIndex
CREATE INDEX "defect_screens_projectId_isActive_idx" ON "defect_screens"("projectId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "defect_screens_projectId_pathKey_key" ON "defect_screens"("projectId", "pathKey");

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_testStageCodeId_fkey" FOREIGN KEY ("testStageCodeId") REFERENCES "common_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_severityCodeId_fkey" FOREIGN KEY ("severityCodeId") REFERENCES "common_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_priorityCodeId_fkey" FOREIGN KEY ("priorityCodeId") REFERENCES "common_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_statusCodeId_fkey" FOREIGN KEY ("statusCodeId") REFERENCES "common_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_identificationCodeId_fkey" FOREIGN KEY ("identificationCodeId") REFERENCES "common_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_histories" ADD CONSTRAINT "defect_histories_defectId_fkey" FOREIGN KEY ("defectId") REFERENCES "defects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_evidences" ADD CONSTRAINT "defect_evidences_defectId_fkey" FOREIGN KEY ("defectId") REFERENCES "defects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_status_classes" ADD CONSTRAINT "defect_status_classes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_status_classes" ADD CONSTRAINT "defect_status_classes_statusCodeId_fkey" FOREIGN KEY ("statusCodeId") REFERENCES "common_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_severity_settings" ADD CONSTRAINT "defect_severity_settings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_severity_settings" ADD CONSTRAINT "defect_severity_settings_severityCodeId_fkey" FOREIGN KEY ("severityCodeId") REFERENCES "common_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_item_test_stages" ADD CONSTRAINT "wbs_item_test_stages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_item_test_stages" ADD CONSTRAINT "wbs_item_test_stages_testStageCodeId_fkey" FOREIGN KEY ("testStageCodeId") REFERENCES "common_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_target_sites" ADD CONSTRAINT "defect_target_sites_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_screens" ADD CONSTRAINT "defect_screens_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- INSERT 전용 강제 — 결함 이력·증적은 수정·삭제할 수 없다(감사 증적). 단위테스트의 ut_block_update_delete 와 별개 함수다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION defect_block_update_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'DEFECT_INSERT_ONLY: % 테이블은 수정·삭제할 수 없습니다(감사 증적).', TG_TABLE_NAME USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "defect_histories_insert_only" BEFORE UPDATE OR DELETE ON "defect_histories" FOR EACH ROW EXECUTE FUNCTION defect_block_update_delete();
CREATE TRIGGER "defect_evidences_insert_only" BEFORE UPDATE OR DELETE ON "defect_evidences" FOR EACH ROW EXECUTE FUNCTION defect_block_update_delete();
