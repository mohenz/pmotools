-- 단위테스트 수행관리 Phase 1 롤백 (마이그레이션 20261020130000_unit_test_mgmt 원복)
-- 실행 전 DB 백업 필수. 운영 데이터가 쌓인 뒤에는 실행 금지(감사 증적 소실).
-- ImportBatchKind 'UT_CASE' 값은 PostgreSQL에서 제거가 어려워 남겨 둔다(미사용 시 무해).
-- 실행 후 _prisma_migrations에서 해당 마이그레이션 행을 삭제해야 재적용할 수 있다.

BEGIN;

-- 20261021090000_wbs_unit_test_target 원복(WBS 단위테스트 대상 체크 값)
ALTER TABLE "wbs_items" DROP COLUMN IF EXISTS "isUnitTestTarget";

DROP TRIGGER IF EXISTS "ut_executions_guard" ON "ut_executions";
DROP TRIGGER IF EXISTS "ut_evidences_insert_only" ON "ut_evidences";
DROP TRIGGER IF EXISTS "ut_defect_actions_insert_only" ON "ut_defect_actions";
DROP TRIGGER IF EXISTS "ut_approvals_guard" ON "ut_approvals";
DROP FUNCTION IF EXISTS ut_execution_guard();
DROP FUNCTION IF EXISTS ut_approval_guard();
DROP FUNCTION IF EXISTS ut_block_update_delete();

DROP TABLE IF EXISTS "ut_defect_actions";
DROP TABLE IF EXISTS "ut_defects";
DROP TABLE IF EXISTS "ut_evidence_views";
DROP TABLE IF EXISTS "ut_evidences";
DROP TABLE IF EXISTS "ut_approvals";
DROP TABLE IF EXISTS "ut_executions";
DROP TABLE IF EXISTS "ut_cases";
DROP TABLE IF EXISTS "ut_wbs_migrations";
DROP TABLE IF EXISTS "ut_scenarios";
DROP TABLE IF EXISTS "ut_wbs_program_maps";
DROP TABLE IF EXISTS "ut_programs";
DROP TABLE IF EXISTS "ut_wbs_milestones";
DROP TABLE IF EXISTS "ut_project_settings";
DROP TABLE IF EXISTS "ut_sequences";

DROP TYPE IF EXISTS "UtPriority";
DROP TYPE IF EXISTS "UtCaseType";
DROP TYPE IF EXISTS "UtScenarioStatus";
DROP TYPE IF EXISTS "UtCaseStatus";
DROP TYPE IF EXISTS "UtVerdict";
DROP TYPE IF EXISTS "UtApprovalStatus";
DROP TYPE IF EXISTS "UtApprovalStep";
DROP TYPE IF EXISTS "UtDecision";
DROP TYPE IF EXISTS "UtProgramType";
DROP TYPE IF EXISTS "UtDefectSeverity";
DROP TYPE IF EXISTS "UtDefectStatus";
DROP TYPE IF EXISTS "UtVerificationResult";
DROP TYPE IF EXISTS "UtDefectActionType";
DROP TYPE IF EXISTS "UtWbsChangeType";

DELETE FROM "common_codes" WHERE "groupCode" IN ('ut_reject_reason', 'ut_env', 'ut_defect_type');
DELETE FROM "common_code_groups" WHERE "code" IN ('ut_reject_reason', 'ut_env', 'ut_defect_type');

DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261020130000_unit_test_mgmt';

COMMIT;
