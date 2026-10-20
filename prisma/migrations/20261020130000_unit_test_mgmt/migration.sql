-- 단위테스트 수행관리 Phase 1 (설계서: docs/단위테스트 수행관리 프로그램 설계서.md 4장, 2026-10-20)
-- 수기 작성 원칙: 이전 스키마→새 스키마 차이(DB 미사용)로 초안을 만든 뒤 감사. DROP 0건, 기존 테이블 컬럼 변경 0건.
-- 기존 객체 변경은 ImportBatchKind enum 값 추가(UT_CASE) 1건뿐이며 PostgreSQL 특성상 롤백 후에도 값은 남는다(미사용 시 무해).
-- 롤백: docs/단위테스트관리_롤백.sql

-- CreateEnum
CREATE TYPE "UtPriority" AS ENUM ('H', 'M', 'L');

-- CreateEnum
CREATE TYPE "UtCaseType" AS ENUM ('NORMAL', 'EXCEPTION', 'BOUNDARY');

-- CreateEnum
CREATE TYPE "UtScenarioStatus" AS ENUM ('DRAFT', 'REVIEW_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UtCaseStatus" AS ENUM ('DRAFT', 'REVIEW_REQUESTED', 'APPROVED', 'IN_EXECUTION', 'QC_PENDING', 'PL_PENDING', 'PL_CONFIRMED');

-- CreateEnum
CREATE TYPE "UtVerdict" AS ENUM ('PASS', 'FAIL', 'BLOCKED', 'NA');

-- CreateEnum
CREATE TYPE "UtApprovalStatus" AS ENUM ('QC_PENDING', 'PL_PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UtApprovalStep" AS ENUM ('QC', 'PL');

-- CreateEnum
CREATE TYPE "UtDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UtProgramType" AS ENUM ('SCREEN', 'API', 'BATCH', 'REPORT');

-- CreateEnum
CREATE TYPE "UtDefectSeverity" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR', 'TRIVIAL');

-- CreateEnum
CREATE TYPE "UtDefectStatus" AS ENUM ('REGISTERED', 'FIXED', 'VERIFIED', 'REFIX');

-- CreateEnum
CREATE TYPE "UtVerificationResult" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "UtDefectActionType" AS ENUM ('FIX', 'VERIFY');

-- CreateEnum
CREATE TYPE "UtWbsChangeType" AS ENUM ('SPLIT', 'MERGE', 'ARCHIVE', 'LEAF_LOST');

-- AlterEnum
ALTER TYPE "ImportBatchKind" ADD VALUE 'UT_CASE';

-- CreateTable
CREATE TABLE "ut_project_settings" (
    "projectId" TEXT NOT NULL,
    "utStartDate" DATE,
    "utEndDate" DATE,
    "samplingRate" INTEGER NOT NULL DEFAULT 10,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lockReason" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ut_project_settings_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "ut_programs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "programCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "programType" "UtProgramType" NOT NULL DEFAULT 'SCREEN',
    "screenId" TEXT NOT NULL DEFAULT '',
    "groupId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ut_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ut_wbs_program_maps" (
    "wbsItemId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ut_wbs_program_maps_pkey" PRIMARY KEY ("wbsItemId","programId")
);

-- CreateTable
CREATE TABLE "ut_scenarios" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wbsItemId" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "groupId" TEXT NOT NULL,
    "programId" TEXT,
    "requirementId" TEXT,
    "name" TEXT NOT NULL,
    "priority" "UtPriority" NOT NULL DEFAULT 'M',
    "writerId" TEXT NOT NULL,
    "plUserId" TEXT,
    "status" "UtScenarioStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewRequestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectReason" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ut_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ut_cases" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "wbsItemId" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "caseType" "UtCaseType" NOT NULL,
    "name" TEXT NOT NULL,
    "precondition" TEXT NOT NULL DEFAULT '',
    "steps" TEXT NOT NULL DEFAULT '',
    "inputData" TEXT NOT NULL DEFAULT '',
    "expectedResult" TEXT NOT NULL DEFAULT '',
    "priority" "UtPriority" NOT NULL DEFAULT 'M',
    "executorId" TEXT,
    "plannedDate" DATE,
    "qcUserId" TEXT,
    "status" "UtCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ut_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ut_executions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "wbsItemId" TEXT NOT NULL,
    "roundNo" INTEGER NOT NULL,
    "envCodeId" TEXT,
    "executorId" TEXT NOT NULL,
    "executedOn" DATE NOT NULL,
    "actualResult" TEXT NOT NULL DEFAULT '',
    "verdict" "UtVerdict" NOT NULL,
    "naReason" TEXT NOT NULL DEFAULT '',
    "approvalStatus" "UtApprovalStatus",
    "approvalUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ut_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ut_approvals" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "wbsItemId" TEXT NOT NULL,
    "step" "UtApprovalStep" NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" "UtDecision" NOT NULL,
    "rejectReasonCodeId" TEXT,
    "comment" TEXT NOT NULL DEFAULT '',
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ut_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ut_evidences" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ut_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ut_evidence_views" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ut_evidence_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ut_defects" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "wbsItemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "UtDefectSeverity" NOT NULL DEFAULT 'MAJOR',
    "defectTypeCodeId" TEXT,
    "causeGroupId" TEXT,
    "vendorGroupId" TEXT,
    "assigneeId" TEXT,
    "status" "UtDefectStatus" NOT NULL DEFAULT 'REGISTERED',
    "foundAt" DATE NOT NULL,
    "fixedAt" DATE,
    "fixedBy" TEXT,
    "verificationResult" "UtVerificationResult",
    "verifiedAt" DATE,
    "verifiedBy" TEXT,
    "retestExecutionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ut_defects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ut_defect_actions" (
    "id" TEXT NOT NULL,
    "defectId" TEXT NOT NULL,
    "actionType" "UtDefectActionType" NOT NULL,
    "actedBy" TEXT NOT NULL,
    "actedOn" DATE NOT NULL,
    "verificationResult" "UtVerificationResult",
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ut_defect_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ut_wbs_milestones" (
    "wbsItemId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "devCompletedOn" DATE,
    "devDeclaredBy" TEXT,
    "devConfirmedBy" TEXT,
    "devConfirmedAt" TIMESTAMP(3),
    "utCompletedOn" DATE,
    "utRecordedBy" TEXT,
    "utRecordedAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ut_wbs_milestones_pkey" PRIMARY KEY ("wbsItemId")
);

-- CreateTable
CREATE TABLE "ut_wbs_migrations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "fromWbsItemId" TEXT NOT NULL,
    "toWbsItemId" TEXT NOT NULL,
    "changeType" "UtWbsChangeType" NOT NULL,
    "migratedBy" TEXT NOT NULL,
    "migratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ut_wbs_migrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ut_sequences" (
    "scope" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ut_sequences_pkey" PRIMARY KEY ("scope")
);

-- CreateIndex
CREATE UNIQUE INDEX "ut_programs_projectId_programCode_key" ON "ut_programs"("projectId", "programCode");

-- CreateIndex
CREATE INDEX "ut_scenarios_projectId_archivedAt_status_idx" ON "ut_scenarios"("projectId", "archivedAt", "status");

-- CreateIndex
CREATE INDEX "ut_scenarios_wbsItemId_idx" ON "ut_scenarios"("wbsItemId");

-- CreateIndex
CREATE INDEX "ut_scenarios_plUserId_status_idx" ON "ut_scenarios"("plUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ut_scenarios_projectId_displayId_key" ON "ut_scenarios"("projectId", "displayId");

-- CreateIndex
CREATE INDEX "ut_cases_scenarioId_idx" ON "ut_cases"("scenarioId");

-- CreateIndex
CREATE INDEX "ut_cases_wbsItemId_idx" ON "ut_cases"("wbsItemId");

-- CreateIndex
CREATE INDEX "ut_cases_executorId_status_idx" ON "ut_cases"("executorId", "status");

-- CreateIndex
CREATE INDEX "ut_cases_qcUserId_status_idx" ON "ut_cases"("qcUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ut_cases_projectId_displayId_key" ON "ut_cases"("projectId", "displayId");

-- CreateIndex
CREATE INDEX "ut_executions_projectId_approvalStatus_idx" ON "ut_executions"("projectId", "approvalStatus");

-- CreateIndex
CREATE INDEX "ut_executions_wbsItemId_idx" ON "ut_executions"("wbsItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ut_executions_caseId_roundNo_key" ON "ut_executions"("caseId", "roundNo");

-- CreateIndex
CREATE INDEX "ut_approvals_projectId_step_idx" ON "ut_approvals"("projectId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "ut_approvals_executionId_step_key" ON "ut_approvals"("executionId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "ut_evidences_storageKey_key" ON "ut_evidences"("storageKey");

-- CreateIndex
CREATE INDEX "ut_evidences_executionId_idx" ON "ut_evidences"("executionId");

-- CreateIndex
CREATE INDEX "ut_evidence_views_evidenceId_viewerId_idx" ON "ut_evidence_views"("evidenceId", "viewerId");

-- CreateIndex
CREATE INDEX "ut_defects_projectId_status_idx" ON "ut_defects"("projectId", "status");

-- CreateIndex
CREATE INDEX "ut_defects_caseId_idx" ON "ut_defects"("caseId");

-- CreateIndex
CREATE INDEX "ut_defects_assigneeId_status_idx" ON "ut_defects"("assigneeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ut_defects_projectId_displayId_key" ON "ut_defects"("projectId", "displayId");

-- CreateIndex
CREATE INDEX "ut_defect_actions_defectId_idx" ON "ut_defect_actions"("defectId");

-- CreateIndex
CREATE INDEX "ut_wbs_milestones_projectId_idx" ON "ut_wbs_milestones"("projectId");

-- CreateIndex
CREATE INDEX "ut_wbs_migrations_projectId_idx" ON "ut_wbs_migrations"("projectId");

-- AddForeignKey
ALTER TABLE "ut_project_settings" ADD CONSTRAINT "ut_project_settings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_project_settings" ADD CONSTRAINT "ut_project_settings_lockedBy_fkey" FOREIGN KEY ("lockedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_programs" ADD CONSTRAINT "ut_programs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_programs" ADD CONSTRAINT "ut_programs_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_programs" ADD CONSTRAINT "ut_programs_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_wbs_program_maps" ADD CONSTRAINT "ut_wbs_program_maps_wbsItemId_fkey" FOREIGN KEY ("wbsItemId") REFERENCES "wbs_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_wbs_program_maps" ADD CONSTRAINT "ut_wbs_program_maps_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ut_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_scenarios" ADD CONSTRAINT "ut_scenarios_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_scenarios" ADD CONSTRAINT "ut_scenarios_wbsItemId_fkey" FOREIGN KEY ("wbsItemId") REFERENCES "wbs_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_scenarios" ADD CONSTRAINT "ut_scenarios_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_scenarios" ADD CONSTRAINT "ut_scenarios_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ut_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_scenarios" ADD CONSTRAINT "ut_scenarios_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_scenarios" ADD CONSTRAINT "ut_scenarios_writerId_fkey" FOREIGN KEY ("writerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_scenarios" ADD CONSTRAINT "ut_scenarios_plUserId_fkey" FOREIGN KEY ("plUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_scenarios" ADD CONSTRAINT "ut_scenarios_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_scenarios" ADD CONSTRAINT "ut_scenarios_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_cases" ADD CONSTRAINT "ut_cases_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ut_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_cases" ADD CONSTRAINT "ut_cases_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_cases" ADD CONSTRAINT "ut_cases_qcUserId_fkey" FOREIGN KEY ("qcUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_cases" ADD CONSTRAINT "ut_cases_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_executions" ADD CONSTRAINT "ut_executions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ut_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_executions" ADD CONSTRAINT "ut_executions_envCodeId_fkey" FOREIGN KEY ("envCodeId") REFERENCES "common_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_executions" ADD CONSTRAINT "ut_executions_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_approvals" ADD CONSTRAINT "ut_approvals_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ut_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_approvals" ADD CONSTRAINT "ut_approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_approvals" ADD CONSTRAINT "ut_approvals_rejectReasonCodeId_fkey" FOREIGN KEY ("rejectReasonCodeId") REFERENCES "common_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_evidences" ADD CONSTRAINT "ut_evidences_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ut_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_evidences" ADD CONSTRAINT "ut_evidences_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_evidence_views" ADD CONSTRAINT "ut_evidence_views_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "ut_evidences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_evidence_views" ADD CONSTRAINT "ut_evidence_views_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_defects" ADD CONSTRAINT "ut_defects_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ut_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_defects" ADD CONSTRAINT "ut_defects_retestExecutionId_fkey" FOREIGN KEY ("retestExecutionId") REFERENCES "ut_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_defects" ADD CONSTRAINT "ut_defects_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ut_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_defects" ADD CONSTRAINT "ut_defects_defectTypeCodeId_fkey" FOREIGN KEY ("defectTypeCodeId") REFERENCES "common_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_defects" ADD CONSTRAINT "ut_defects_causeGroupId_fkey" FOREIGN KEY ("causeGroupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_defects" ADD CONSTRAINT "ut_defects_vendorGroupId_fkey" FOREIGN KEY ("vendorGroupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_defects" ADD CONSTRAINT "ut_defects_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_defects" ADD CONSTRAINT "ut_defects_fixedBy_fkey" FOREIGN KEY ("fixedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_defects" ADD CONSTRAINT "ut_defects_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_defects" ADD CONSTRAINT "ut_defects_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_defect_actions" ADD CONSTRAINT "ut_defect_actions_defectId_fkey" FOREIGN KEY ("defectId") REFERENCES "ut_defects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_defect_actions" ADD CONSTRAINT "ut_defect_actions_actedBy_fkey" FOREIGN KEY ("actedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_wbs_milestones" ADD CONSTRAINT "ut_wbs_milestones_wbsItemId_fkey" FOREIGN KEY ("wbsItemId") REFERENCES "wbs_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_wbs_milestones" ADD CONSTRAINT "ut_wbs_milestones_devDeclaredBy_fkey" FOREIGN KEY ("devDeclaredBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_wbs_milestones" ADD CONSTRAINT "ut_wbs_milestones_devConfirmedBy_fkey" FOREIGN KEY ("devConfirmedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_wbs_milestones" ADD CONSTRAINT "ut_wbs_milestones_utRecordedBy_fkey" FOREIGN KEY ("utRecordedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_wbs_migrations" ADD CONSTRAINT "ut_wbs_migrations_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ut_scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_wbs_migrations" ADD CONSTRAINT "ut_wbs_migrations_fromWbsItemId_fkey" FOREIGN KEY ("fromWbsItemId") REFERENCES "wbs_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_wbs_migrations" ADD CONSTRAINT "ut_wbs_migrations_toWbsItemId_fkey" FOREIGN KEY ("toWbsItemId") REFERENCES "wbs_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ut_wbs_migrations" ADD CONSTRAINT "ut_wbs_migrations_migratedBy_fkey" FOREIGN KEY ("migratedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- INSERT 전용 강제 (설계서 4.3 규칙 6) — 수행 결과·승인·증적·결함 조치 이력은 수정·삭제 불가.
-- ut_executions는 approvalStatus·approvalUpdatedAt 갱신만 허용한다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ut_block_update_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'UT_INSERT_ONLY: % 테이블은 수정·삭제할 수 없습니다(감사 증적).', TG_TABLE_NAME USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ut_execution_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'UT_INSERT_ONLY: ut_executions 행은 삭제할 수 없습니다(감사 증적).' USING ERRCODE = 'P0001';
  END IF;
  IF (NEW."id", NEW."projectId", NEW."caseId", NEW."wbsItemId", NEW."roundNo", NEW."envCodeId", NEW."executorId", NEW."executedOn", NEW."actualResult", NEW."verdict", NEW."naReason", NEW."createdAt")
     IS DISTINCT FROM
     (OLD."id", OLD."projectId", OLD."caseId", OLD."wbsItemId", OLD."roundNo", OLD."envCodeId", OLD."executorId", OLD."executedOn", OLD."actualResult", OLD."verdict", OLD."naReason", OLD."createdAt") THEN
    -- 예외: WBS 분할·병합 이관(ut_wbs_migrations)은 wbsItemId만 바꿀 수 있다.
    IF (NEW."id", NEW."projectId", NEW."caseId", NEW."roundNo", NEW."envCodeId", NEW."executorId", NEW."executedOn", NEW."actualResult", NEW."verdict", NEW."naReason", NEW."createdAt")
       IS DISTINCT FROM
       (OLD."id", OLD."projectId", OLD."caseId", OLD."roundNo", OLD."envCodeId", OLD."executorId", OLD."executedOn", OLD."actualResult", OLD."verdict", OLD."naReason", OLD."createdAt") THEN
      RAISE EXCEPTION 'UT_INSERT_ONLY: ut_executions는 승인상태(approvalStatus)·이관(wbsItemId) 외에는 수정할 수 없습니다.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ut_executions_guard" BEFORE UPDATE OR DELETE ON "ut_executions" FOR EACH ROW EXECUTE FUNCTION ut_execution_guard();
CREATE TRIGGER "ut_evidences_insert_only" BEFORE UPDATE OR DELETE ON "ut_evidences" FOR EACH ROW EXECUTE FUNCTION ut_block_update_delete();
CREATE TRIGGER "ut_defect_actions_insert_only" BEFORE UPDATE OR DELETE ON "ut_defect_actions" FOR EACH ROW EXECUTE FUNCTION ut_block_update_delete();

-- ut_approvals: 삭제 금지, 수정은 이관(wbsItemId)만 허용
CREATE OR REPLACE FUNCTION ut_approval_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'UT_INSERT_ONLY: ut_approvals 행은 삭제할 수 없습니다(감사 증적).' USING ERRCODE = 'P0001';
  END IF;
  IF (NEW."id", NEW."projectId", NEW."executionId", NEW."step", NEW."approverId", NEW."decision", NEW."rejectReasonCodeId", NEW."comment", NEW."actedAt")
     IS DISTINCT FROM
     (OLD."id", OLD."projectId", OLD."executionId", OLD."step", OLD."approverId", OLD."decision", OLD."rejectReasonCodeId", OLD."comment", OLD."actedAt") THEN
    RAISE EXCEPTION 'UT_INSERT_ONLY: ut_approvals는 이관(wbsItemId) 외에는 수정할 수 없습니다.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ut_approvals_guard" BEFORE UPDATE OR DELETE ON "ut_approvals" FOR EACH ROW EXECUTE FUNCTION ut_approval_guard();

-- ---------------------------------------------------------------------------
-- 공통코드 시딩 (설계서 4.5) — 기존 프로젝트 전체. 이후 생성되는 프로젝트는 서버가 처음 사용할 때 생성한다.
-- ---------------------------------------------------------------------------
INSERT INTO "common_code_groups" ("id", "projectId", "code", "label", "description", "sortOrder", "isActive", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", g.code, g.label, g.description, g.sort_order, true, true, now(), now()
FROM "projects" p
CROSS JOIN (VALUES
  ('ut_reject_reason', '단위테스트 반려 사유', 'QC·PL 결과 확인 반려 사유', 900),
  ('ut_env', '단위테스트 수행 환경', '단위테스트 수행 환경(DEV·STG 등)', 901),
  ('ut_defect_type', '단위테스트 결함 유형', '단위테스트 결함 분류', 902)
) AS g(code, label, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM "common_code_groups" cg WHERE cg."projectId" = p."id" AND cg."code" = g.code);

INSERT INTO "common_codes" ("id", "projectId", "groupId", "groupCode", "code", "label", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), cg."projectId", cg."id", cg."code", v.code, v.label, v.sort_order, true, now(), now()
FROM "common_code_groups" cg
JOIN (VALUES
  ('ut_reject_reason', 'EVIDENCE', '증적 불충분', 0),
  ('ut_reject_reason', 'MISMATCH', '예상결과 불일치', 1),
  ('ut_reject_reason', 'INVALID_CASE', '케이스 부적정', 2),
  ('ut_reject_reason', 'ETC', '기타', 3),
  ('ut_env', 'DEV', 'DEV', 0),
  ('ut_env', 'STG', 'STG', 1),
  ('ut_defect_type', 'FUNCTION', '기능', 0),
  ('ut_defect_type', 'UI', '화면', 1),
  ('ut_defect_type', 'DATA', '데이터', 2),
  ('ut_defect_type', 'INTERFACE', '인터페이스', 3),
  ('ut_defect_type', 'PERFORMANCE', '성능', 4),
  ('ut_defect_type', 'SECURITY', '보안', 5)
) AS v(group_code, code, label, sort_order) ON v.group_code = cg."code"
WHERE cg."projectId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "common_codes" c WHERE c."groupId" = cg."id" AND c."code" = v.code);
