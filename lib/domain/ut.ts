// ---------------------------------------------------------------------------
// 단위테스트 수행관리 — 순수 도메인 규칙(설계서: docs/단위테스트 수행관리 프로그램 설계서.md).
// 1단계는 수기 관리라 "판정·반영 자동화"는 넣지 않는다(11장). 여기 있는 것은 입력 검증·상태 전이·직무 분리·
// 채번·조회용 집계뿐이며, 11장 "유지한 시스템 처리"에 해당한다.
// ---------------------------------------------------------------------------

export type UtCaseType = "NORMAL" | "EXCEPTION" | "BOUNDARY";
export type UtCaseStatus = "DRAFT" | "REVIEW_REQUESTED" | "APPROVED" | "IN_EXECUTION" | "QC_PENDING" | "PL_PENDING" | "PL_CONFIRMED";
export type UtScenarioStatus = "DRAFT" | "REVIEW_REQUESTED" | "APPROVED" | "REJECTED";
export type UtVerdict = "PASS" | "FAIL" | "BLOCKED" | "NA";
export type UtApprovalStatus = "QC_PENDING" | "PL_PENDING" | "APPROVED" | "REJECTED";
export type UtApprovalStep = "QC" | "PL";
export type UtDecision = "APPROVED" | "REJECTED";
export type UtDefectStatus = "REGISTERED" | "FIXED" | "VERIFIED" | "REFIX";
export type UtVerificationResult = "PASS" | "FAIL";

export const UT_CASE_TYPE_LABEL: Record<UtCaseType, string> = { NORMAL: "정상", EXCEPTION: "예외", BOUNDARY: "경계" };
export const UT_CASE_STATUS_LABEL: Record<UtCaseStatus, string> = { DRAFT: "작성중", REVIEW_REQUESTED: "검토요청", APPROVED: "승인", IN_EXECUTION: "수행중", QC_PENDING: "Pass(QC대기)", PL_PENDING: "QC확인(PL대기)", PL_CONFIRMED: "PL확인완료" };
export const UT_SCENARIO_STATUS_LABEL: Record<UtScenarioStatus, string> = { DRAFT: "작성중", REVIEW_REQUESTED: "검토요청", APPROVED: "승인", REJECTED: "반려" };
export const UT_VERDICT_LABEL: Record<UtVerdict, string> = { PASS: "Pass", FAIL: "Fail", BLOCKED: "Blocked", NA: "N/A" };
export const UT_DEFECT_STATUS_LABEL: Record<UtDefectStatus, string> = { REGISTERED: "등록", FIXED: "조치완료", VERIFIED: "검증완료", REFIX: "재조치" };
export const UT_VERIFICATION_LABEL: Record<UtVerificationResult, string> = { PASS: "적합", FAIL: "부적합" };

export class UtRuleError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

// ---------------------------------------------------------------------------
// 채번(4.7)
// ---------------------------------------------------------------------------

/** UTS-{WBS displayId에서 "WBS-" 제외}-{순번 2자리} */
export function scenarioDisplayId(wbsDisplayId: string, seq: number) {
  return `UTS-${wbsDisplayId.replace(/^WBS-/, "")}-${String(seq).padStart(2, "0")}`;
}

/** {시나리오 ID}-{순번 3자리} */
export function caseDisplayId(scenarioDisplayIdValue: string, seq: number) {
  return `${scenarioDisplayIdValue}-${String(seq).padStart(3, "0")}`;
}

/** DF-{yyMMdd}-{순번 4자리}. date는 "YYYY-MM-DD" */
export function defectDisplayId(date: string, seq: number) {
  return `DF-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}-${String(seq).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// 케이스 작성 — 필수 필드(입력 검증, 유지)와 PL 검토 체크리스트(수기 확인, 차단하지 않음 — AU-06 보류)
// ---------------------------------------------------------------------------

export type UtCaseDraft = {
  displayId?: string;
  caseType: UtCaseType;
  name: string;
  precondition: string;
  steps: string;
  inputData: string;
  expectedResult: string;
  executorId: string | null;
  plannedDate: string | null;
  qcUserId: string | null;
};

export const EXPECTED_RESULT_MAX = 200;
const AMBIGUOUS_WORDS = ["정상 처리", "정상처리", "정상적으로", "확인"];

/** 검토요청 전 필수 필드 누락 — 비어 있으면 검토요청 불가(5장 필수 12개 중 케이스 단위 항목). */
export function missingCaseFields(c: UtCaseDraft): string[] {
  const missing: string[] = [];
  if (!c.name.trim()) missing.push("케이스명");
  if (!c.precondition.trim()) missing.push("사전조건");
  if (!c.steps.trim()) missing.push("테스트스텝");
  if (!c.inputData.trim()) missing.push("입력데이터");
  if (!c.expectedResult.trim()) missing.push("예상결과");
  if (!c.executorId) missing.push("수행 담당자");
  if (!c.plannedDate) missing.push("예정일");
  if (!c.qcUserId) missing.push("QC 확인자");
  return missing;
}

export type UtChecklistItem = { key: string; ok: boolean; message: string };

/** PL 검토 체크리스트(5장) — 결과만 보여 주고 차단하지 않는다. */
export function reviewChecklist(cases: UtCaseDraft[], options: { highPriority: boolean }): UtChecklistItem[] {
  const normal = cases.filter((c) => c.caseType === "NORMAL").length;
  const edge = cases.filter((c) => c.caseType !== "NORMAL").length;
  const ambiguous = cases.filter((c) => {
    const text = c.expectedResult.replace(/\s+/g, " ").trim();
    if (!text) return false;
    const stripped = AMBIGUOUS_WORDS.reduce((acc, w) => acc.split(w).join(""), text).replace(/[\s.,!·]/g, "");
    return stripped.length === 0;
  });
  const tooLong = cases.filter((c) => c.expectedResult.length > EXPECTED_RESULT_MAX);
  const seen = new Map<string, number>();
  for (const c of cases) {
    const key = `${c.inputData.trim()}|${c.expectedResult.trim()}`;
    if (c.inputData.trim() || c.expectedResult.trim()) seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicates = [...seen.values()].filter((n) => n > 1).length;
  const items: UtChecklistItem[] = [
    { key: "normal", ok: normal >= 1, message: `정상 케이스 1건 이상 (현재 ${normal}건)` },
    { key: "edge", ok: edge >= 2, message: `예외+경계 케이스 2건 이상 (현재 ${edge}건)` },
    { key: "ambiguous", ok: ambiguous.length === 0, message: ambiguous.length ? `예상결과가 모호어만으로 된 케이스 ${ambiguous.length}건` : "예상결과 모호어 없음" },
    { key: "length", ok: tooLong.length === 0, message: tooLong.length ? `예상결과 ${EXPECTED_RESULT_MAX}자 초과 ${tooLong.length}건` : `예상결과 ${EXPECTED_RESULT_MAX}자 이내` },
    { key: "duplicate", ok: duplicates === 0, message: duplicates ? `입력데이터·예상결과가 같은 중복 ${duplicates}묶음` : "중복 케이스 없음" },
  ];
  if (options.highPriority) {
    const hasEmptyOrAuth = cases.some((c) => c.caseType === "EXCEPTION" && /빈 ?값|권한 ?없음/.test(`${c.name} ${c.inputData} ${c.precondition}`));
    items.push({ key: "high", ok: hasEmptyOrAuth, message: "H등급: 예외에 '빈 값' 또는 '권한 없음' 포함(권고)" });
  }
  return items;
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
// 시나리오 검토(6장 2~3단계)
// ---------------------------------------------------------------------------

export function nextScenarioStatus(current: UtScenarioStatus, action: "REQUEST" | "APPROVE" | "REJECT" | "EDIT"): UtScenarioStatus {
  switch (action) {
    case "REQUEST":
      if (current === "DRAFT" || current === "REJECTED") return "REVIEW_REQUESTED";
      break;
    case "APPROVE":
    case "REJECT":
      if (current === "REVIEW_REQUESTED") return action === "APPROVE" ? "APPROVED" : "REJECTED";
      break;
    case "EDIT":
      if (current === "DRAFT" || current === "REJECTED") return current;
      break;
  }
  throw new UtRuleError("INVALID_TRANSITION", `현재 상태(${UT_SCENARIO_STATUS_LABEL[current]})에서는 처리할 수 없습니다.`);
}

// ---------------------------------------------------------------------------
// 수행(6장 4단계) — 차수, 판정 입력 검증, 승인 상태 초기값
// ---------------------------------------------------------------------------

export function canExecuteCase(status: UtCaseStatus) {
  return status === "APPROVED" || status === "IN_EXECUTION";
}

export function nextRoundNo(existingRounds: number[]) {
  return existingRounds.length ? Math.max(...existingRounds) + 1 : 1;
}

export function validateExecution(input: { verdict: UtVerdict; actualResult: string; naReason: string; evidenceCount: number }) {
  const { verdict, actualResult, naReason, evidenceCount } = input;
  if (verdict === "FAIL" && !actualResult.trim()) throw new UtRuleError("REQUIRED", "Fail 판정은 실제결과를 입력해야 합니다.");
  if (verdict === "NA" && !naReason.trim()) throw new UtRuleError("REQUIRED", "N/A 판정은 사유를 입력해야 합니다.");
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

export function applyApproval(input: { approvalStatus: UtApprovalStatus | null; verdict: UtVerdict; step: UtApprovalStep; decision: UtDecision; rejectReasonCodeId?: string | null; comment?: string }) {
  const { approvalStatus, verdict, step, decision } = input;
  const expected: UtApprovalStatus = step === "QC" ? "QC_PENDING" : "PL_PENDING";
  if (approvalStatus !== expected) throw new UtRuleError("INVALID_TRANSITION", step === "QC" ? "QC 확인 대기 상태가 아닙니다." : "PL 확인 대기 상태가 아닙니다.");
  if (step === "QC" && verdict === "NA") throw new UtRuleError("INVALID_TRANSITION", "N/A 판정은 QC 확인 없이 PL이 사유를 승인합니다.");
  if (decision === "REJECTED" && (!input.rejectReasonCodeId || !input.comment?.trim())) throw new UtRuleError("REQUIRED", "반려 시 사유코드와 의견을 입력해야 합니다.");
  if (decision === "REJECTED") return { approvalStatus: "REJECTED" as const, caseStatus: "IN_EXECUTION" as const };
  return step === "QC" ? { approvalStatus: "PL_PENDING" as const, caseStatus: "PL_PENDING" as const } : { approvalStatus: "APPROVED" as const, caseStatus: "PL_CONFIRMED" as const };
}

/** 확인자 자격 — 수행자는 확인할 수 없고, 지정된 확인자 본인만 처리(PM/PMO 대리 지정은 서버에서). */
export function assertApprover(input: { step: UtApprovalStep; actorId: string; executorId: string; qcUserId: string | null; plUserId: string | null; hasViewedEvidence: boolean; verdict: UtVerdict }) {
  const { step, actorId, executorId, qcUserId, plUserId } = input;
  if (actorId === executorId) throw new UtRuleError("SEPARATION", "수행자는 자신의 결과를 확인할 수 없습니다.");
  if (step === "QC" && actorId !== qcUserId) throw new UtRuleError("FORBIDDEN", "지정된 QC 확인자만 처리할 수 있습니다.");
  if (step === "PL" && actorId !== plUserId) throw new UtRuleError("FORBIDDEN", "지정된 PL 확인자만 처리할 수 있습니다.");
  if (input.verdict !== "NA" && !input.hasViewedEvidence) throw new UtRuleError("EVIDENCE_NOT_VIEWED", "증적을 열람한 뒤 확인할 수 있습니다.");
}

// ---------------------------------------------------------------------------
// 결함 조치·검증(5.1, C9)
// ---------------------------------------------------------------------------

export function applyDefectFix(status: UtDefectStatus): UtDefectStatus {
  if (status === "REGISTERED" || status === "REFIX") return "FIXED";
  throw new UtRuleError("INVALID_TRANSITION", `현재 상태(${UT_DEFECT_STATUS_LABEL[status]})에서는 조치를 등록할 수 없습니다.`);
}

export function applyDefectVerify(input: { status: UtDefectStatus; result: UtVerificationResult; fixedBy: string | null; verifierId: string }): UtDefectStatus {
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
