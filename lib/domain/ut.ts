// ---------------------------------------------------------------------------
// 단위테스트 수행관리 — 순수 도메인 규칙(설계서: docs/단위테스트 수행관리 프로그램 설계서.md).
// 1단계는 수기 관리라 "판정·반영 자동화"는 넣지 않는다(11장). 여기 있는 것은 입력 검증·상태 전이·직무 분리·
// 채번·조회용 집계뿐이며, 11장 "유지한 시스템 처리"에 해당한다.
// ---------------------------------------------------------------------------

export type UtCaseStatus = "DRAFT" | "REVIEW_REQUESTED" | "APPROVED" | "REJECTED" | "IN_EXECUTION" | "QC_PENDING" | "PL_PENDING" | "PL_CONFIRMED";
export type UtVerdict = "PASS" | "FAIL" | "BLOCKED" | "NA";
export type UtApprovalStatus = "QC_PENDING" | "PL_PENDING" | "APPROVED" | "REJECTED";
export type UtApprovalStep = "QC" | "PL";
export type UtDecision = "APPROVED" | "REJECTED";
export type UtDefectStatus = "REGISTERED" | "FIXED" | "VERIFIED" | "REFIX";
export type UtVerificationResult = "PASS" | "FAIL";

export const UT_CASE_STATUS_LABEL: Record<UtCaseStatus, string> = { DRAFT: "작성중", REVIEW_REQUESTED: "검토요청", APPROVED: "승인", REJECTED: "반려", IN_EXECUTION: "수행중", QC_PENDING: "Pass(QC대기)", PL_PENDING: "QC확인(PL대기)", PL_CONFIRMED: "PL확인완료" };
export const UT_VERDICT_LABEL: Record<UtVerdict, string> = { PASS: "Pass", FAIL: "Fail", BLOCKED: "Blocked", NA: "N/A" };
export const UT_DEFECT_STATUS_LABEL: Record<UtDefectStatus, string> = { REGISTERED: "등록", FIXED: "조치완료", VERIFIED: "검증완료", REFIX: "재조치" };
export const UT_VERIFICATION_LABEL: Record<UtVerificationResult, string> = { PASS: "적합", FAIL: "부적합" };

/** 단위테스트 대상 Stage(2026-10-20 사용자 확정) — 최상위 WBS 이름이 "개발"인 단계의 Leaf Task만 대상. */
export const UT_TARGET_STAGE = "개발";
export function isUtTargetStage(stage: string | null | undefined) {
  return (stage ?? "").trim() === UT_TARGET_STAGE;
}

/** 목록·트리·등록 화면에서 "WBS 없음"(WBS 없이 등록한 테스트, 2026-10-21 사용자 확정)을 나타내는 값. */
export const UT_NO_WBS = "none";

/** 단위테스트 대상 Task(2026-10-21 사용자 확정) — WBS 기준: 개발 단계 Leaf이면서 WBS에서 "단위테스트 대상"이 체크된 Task.
 *  대상 여부는 WBS 항목에만 저장하고, 단위테스트 관리는 이를 읽기만 한다(별도 대상 테이블 없음). */
export function isUtTargetTask(item: { stage: string | null | undefined; isUnitTestTarget: boolean; isLeaf: boolean }) {
  return item.isLeaf && item.isUnitTestTarget && isUtTargetStage(item.stage);
}

export class UtRuleError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

// ---------------------------------------------------------------------------
// 채번(4.7)
// ---------------------------------------------------------------------------

/** 케이스 ID는 작성자가 직접 입력한다(2026-10-21 사용자 확정) — 프로젝트 안에서 유일(대소문자 무시), 공백 불가, 50자 이내. */
export const CASE_DISPLAY_ID_MAX = 50;
export function caseDisplayIdError(value: string): string | null {
  const v = value.trim();
  if (!v) return "케이스 ID를 입력해 주세요.";
  if (v.length > CASE_DISPLAY_ID_MAX) return `케이스 ID는 ${CASE_DISPLAY_ID_MAX}자 이내로 입력해 주세요.`;
  if (/\s/.test(v)) return "케이스 ID에는 공백을 넣을 수 없습니다.";
  return null;
}

/** DF-{yyMMdd}-{순번 4자리}. date는 "YYYY-MM-DD" */
export function defectDisplayId(date: string, seq: number) {
  return `DF-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}-${String(seq).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// 직무 분리(4.3 규칙 5) — 입력 검증
// ---------------------------------------------------------------------------

export function assertSeparation(input: { executorId?: string | null; qcUserId?: string | null; plUserId?: string | null }) {
  const { executorId, qcUserId, plUserId } = input;
  if (executorId && qcUserId && executorId === qcUserId) throw new UtRuleError("SEPARATION", "수행 담당자와 QC 확인자는 같은 사람일 수 없습니다.");
  if (executorId && plUserId && executorId === plUserId) throw new UtRuleError("SEPARATION", "수행 담당자와 PL 확인자는 같은 사람일 수 없습니다.");
  if (qcUserId && plUserId && qcUserId === plUserId) throw new UtRuleError("SEPARATION", "QC 확인자와 PL 확인자는 같은 사람일 수 없습니다.");
}

// ---------------------------------------------------------------------------
// 케이스 수정 — 검토·승인 없음(2026-10-23 사용자 확정). 등록 즉시 수행 대기(IN_EXECUTION)이며 첫 수행 등록 전까지만 수정한다.
// ---------------------------------------------------------------------------

/** 검토·승인 폐지(2026-10-23) 이전 상태 — 운영 데이터 변환 전에도 수행 대기 케이스와 똑같이 다룬다. */
export const UT_LEGACY_PRE_EXECUTION_STATUSES: UtCaseStatus[] = ["DRAFT", "REVIEW_REQUESTED", "REJECTED"];
const isPreExecution = (status: UtCaseStatus) => status === "IN_EXECUTION" || UT_LEGACY_PRE_EXECUTION_STATUSES.includes(status);

export function canEditCase(status: UtCaseStatus, executionCount: number) {
  return isPreExecution(status) && executionCount === 0;
}

// ---------------------------------------------------------------------------
// 수행(6장 4단계) — 차수, 판정 입력 검증, 승인 상태 초기값
// ---------------------------------------------------------------------------

/** APPROVED는 검토 폐지(2026-10-23) 이전에 승인된 케이스 — 계속 수행 가능. */
export function canExecuteCase(status: UtCaseStatus) {
  return status === "APPROVED" || isPreExecution(status);
}

export function nextRoundNo(existingRounds: number[]) {
  return existingRounds.length ? Math.max(...existingRounds) + 1 : 1;
}

/** 수행 1회에 올릴 수 있는 증적 파일 수(2026-10-23 사용자 확정). */
export const UT_EVIDENCE_MAX_FILES = 3;

export function validateExecution(input: { verdict: UtVerdict; actualResult: string; naReason: string; evidenceCount: number }) {
  const { verdict, actualResult, naReason, evidenceCount } = input;
  if (verdict === "FAIL" && !actualResult.trim()) throw new UtRuleError("REQUIRED", "Fail 판정은 실제결과를 입력해야 합니다.");
  if (verdict === "NA" && !naReason.trim()) throw new UtRuleError("REQUIRED", "N/A 판정은 사유를 입력해야 합니다.");
  if (evidenceCount > UT_EVIDENCE_MAX_FILES) throw new UtRuleError("EVIDENCE_LIMIT", `증적은 최대 ${UT_EVIDENCE_MAX_FILES}개까지 첨부할 수 있습니다.`);
  if ((verdict === "PASS" || verdict === "FAIL") && evidenceCount < 1) throw new UtRuleError("EVIDENCE_REQUIRED", "Pass·Fail 판정은 증적을 1건 이상 첨부해야 합니다.");
}

/** 판정 직후 상태 — PASS: QC대기, N/A: PL 사유 승인 대기(QC 생략), FAIL·BLOCKED: 재수행 대기. */
export function afterExecution(verdict: UtVerdict): { approvalStatus: UtApprovalStatus | null; caseStatus: UtCaseStatus } {
  if (verdict === "PASS") return { approvalStatus: "QC_PENDING", caseStatus: "QC_PENDING" };
  if (verdict === "NA") return { approvalStatus: "PL_PENDING", caseStatus: "PL_PENDING" };
  return { approvalStatus: null, caseStatus: "IN_EXECUTION" };
}

// ---------------------------------------------------------------------------
// 결과 확인(6장 5~6단계) — QC → PL. 반려 시 차수 종료, 재수행은 roundNo + 1.
// ---------------------------------------------------------------------------

export function applyApproval(input: { approvalStatus: UtApprovalStatus | null; verdict: UtVerdict; step: UtApprovalStep; decision: UtDecision; rejectReasonCodeId?: string | null; comment?: string; force?: boolean }) {
  const { approvalStatus, verdict, step, decision } = input;
  const expected: UtApprovalStatus = step === "QC" ? "QC_PENDING" : "PL_PENDING";
  if (approvalStatus !== expected && !input.force) throw new UtRuleError("INVALID_TRANSITION", step === "QC" ? "QC 확인 대기 상태가 아닙니다." : "PL 확인 대기 상태가 아닙니다.");
  if (step === "QC" && verdict === "NA" && !input.force) throw new UtRuleError("INVALID_TRANSITION", "N/A 판정은 QC 확인 없이 PL이 사유를 승인합니다.");
  if (decision === "REJECTED" && (!input.rejectReasonCodeId || !input.comment?.trim())) throw new UtRuleError("REQUIRED", "반려 시 사유코드와 의견을 입력해야 합니다.");
  if (decision === "REJECTED") return { approvalStatus: "REJECTED" as const, caseStatus: "IN_EXECUTION" as const };
  return step === "QC" ? { approvalStatus: "PL_PENDING" as const, caseStatus: "PL_PENDING" as const } : { approvalStatus: "APPROVED" as const, caseStatus: "PL_CONFIRMED" as const };
}

/** 확인자 자격 — 수행자는 확인할 수 없고, 지정된 확인자 본인만 처리(관리자·슈퍼관리자는 anyDesignee로 지정·직무 분리 검사를 모두 생략). */
export function assertApprover(input: { step: UtApprovalStep; actorId: string; executorId: string; qcUserId: string | null; plUserId: string | null; hasViewedEvidence: boolean; verdict: UtVerdict; anyDesignee?: boolean }) {
  const { step, actorId, executorId, qcUserId, plUserId } = input;
  if (actorId === executorId && !input.anyDesignee) throw new UtRuleError("SEPARATION", "수행자는 자신의 결과를 확인할 수 없습니다.");
  if (step === "QC" && !input.anyDesignee && actorId !== qcUserId) throw new UtRuleError("FORBIDDEN", "지정된 QC 확인자만 처리할 수 있습니다.");
  if (step === "PL" && !input.anyDesignee && actorId !== plUserId) throw new UtRuleError("FORBIDDEN", "지정된 PL 확인자만 처리할 수 있습니다.");
  if (input.verdict !== "NA" && !input.hasViewedEvidence) throw new UtRuleError("EVIDENCE_NOT_VIEWED", "증적을 열람한 뒤 확인할 수 있습니다.");
}

// ---------------------------------------------------------------------------
// 결함 조치·검증(5.1, C9)
// ---------------------------------------------------------------------------

export function applyDefectFix(status: UtDefectStatus, force = false): UtDefectStatus {
  if (status === "REGISTERED" || status === "REFIX" || force) return "FIXED";
  throw new UtRuleError("INVALID_TRANSITION", `현재 상태(${UT_DEFECT_STATUS_LABEL[status]})에서는 조치를 등록할 수 없습니다.`);
}

export function applyDefectVerify(input: { status: UtDefectStatus; result: UtVerificationResult; fixedBy: string | null; verifierId: string; force?: boolean }): UtDefectStatus {
  if (input.force) return input.result === "PASS" ? "VERIFIED" : "REFIX";
  if (input.status !== "FIXED") throw new UtRuleError("INVALID_TRANSITION", "조치완료 상태에서만 검증할 수 있습니다.");
  if (input.fixedBy && input.fixedBy === input.verifierId) throw new UtRuleError("SEPARATION", "조치자는 같은 결함을 검증할 수 없습니다.");
  return input.result === "PASS" ? "VERIFIED" : "REFIX";
}

export function isOpenDefect(status: UtDefectStatus) {
  return status !== "VERIFIED";
}

// ---------------------------------------------------------------------------
// UT완료 4개 조건 현황(2장) — 조회 표시용. 판정·차단하지 않는다(AU-04 보류). PL이 보고 수기 기록.
// ---------------------------------------------------------------------------

export type UtConditionCase = { isActive: boolean; status: UtCaseStatus; latest: { verdict: UtVerdict; approvalStatus: UtApprovalStatus | null; evidenceCount: number } | null };
export type UtConditionDefect = { status: UtDefectStatus; severity: "CRITICAL" | "MAJOR" | "MINOR" | "TRIVIAL" };

export function utCompletionConditions(cases: UtConditionCase[], defects: UtConditionDefect[]) {
  const active = cases.filter((c) => c.isActive);
  const approvedStatuses: UtCaseStatus[] = ["APPROVED", "IN_EXECUTION", "QC_PENDING", "PL_PENDING", "PL_CONFIRMED"];
  const approved = active.filter((c) => approvedStatuses.includes(c.status));
  const target = approved.filter((c) => !(c.latest?.verdict === "NA" && c.latest.approvalStatus === "APPROVED")); // N/A는 PL 승인 시 제외
  const executed = target.filter((c) => c.latest !== null);
  const passed = target.filter((c) => c.latest?.verdict === "PASS");
  const evidenced = passed.filter((c) => (c.latest?.evidenceCount ?? 0) > 0);
  const confirmed = passed.filter((c) => c.status === "PL_CONFIRMED");
  const openDefects = defects.filter((d) => isOpenDefect(d.status));
  const blockingOpen = openDefects.filter((d) => d.severity !== "MINOR" && d.severity !== "TRIVIAL");
  return {
    approvedCount: approved.length, activeCount: active.length,
    targetCount: target.length, executedCount: executed.length, passedCount: passed.length,
    evidencedCount: evidenced.length, confirmedCount: confirmed.length,
    openDefectCount: openDefects.length, blockingOpenDefectCount: blockingOpen.length,
    conditions: {
      c1Approved: approved.length > 0 && approved.length === active.length,
      c2AllExecuted: target.length > 0 && executed.length === target.length,
      c3AllPassedNoOpenDefect: target.length > 0 && passed.length === target.length && blockingOpen.length === 0,
      c4EvidenceAndConfirmed: passed.length > 0 && evidenced.length === passed.length && confirmed.length === passed.length,
    },
  };
}

// ---------------------------------------------------------------------------
// 이정표(2.1) — 수기 기록. 선언자 ≠ 확인자.
// ---------------------------------------------------------------------------

export function assertDevConfirm(input: { declaredBy: string | null; confirmerId: string }) {
  if (!input.declaredBy) throw new UtRuleError("INVALID_TRANSITION", "개발완료 선언이 없습니다.");
  if (input.declaredBy === input.confirmerId) throw new UtRuleError("SEPARATION", "개발완료를 선언한 사람은 확인할 수 없습니다.");
}
