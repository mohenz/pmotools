import { describe, expect, it } from "vitest";
import {
  afterExecution, applyApproval, applyDefectFix, applyDefectVerify, assertApprover, assertDevConfirm, assertSeparation, canExecuteCase, caseDisplayId,
  defectDisplayId, isUtTargetStage, missingCaseFields, nextRoundNo, nextScenarioStatus, reviewChecklist, scenarioDisplayId, utCompletionConditions, validateExecution,
  type UtCaseDraft,
} from "@/lib/domain/ut";

const draft = (over: Partial<UtCaseDraft> = {}): UtCaseDraft => ({ caseType: "NORMAL", name: "수량 검증", precondition: "재고 10개", steps: "1. 수량 입력", inputData: "수량 = 3", expectedResult: "장바구니에 3개 저장", executorId: "dev", plannedDate: "2026-11-01", qcUserId: "qc", ...over });

describe("채번 (4.7)", () => {
  it("시나리오·케이스·결함 ID", () => {
    expect(scenarioDisplayId("WBS-2026-000123", 1)).toBe("UTS-2026-000123-01");
    expect(caseDisplayId("UTS-2026-000123-01", 3)).toBe("UTS-2026-000123-01-003");
    expect(defectDisplayId("2026-10-20", 12)).toBe("DF-261020-0012");
  });
});

describe("케이스 작성", () => {
  it("필수 필드 누락 목록", () => {
    expect(missingCaseFields(draft())).toEqual([]);
    expect(missingCaseFields(draft({ steps: " ", qcUserId: null }))).toEqual(["테스트스텝", "QC 확인자"]);
  });

  it("체크리스트 — 정상 1·예외+경계 2 기준, 차단 없이 결과만", () => {
    const ok = reviewChecklist([draft(), draft({ caseType: "BOUNDARY", inputData: "10" }), draft({ caseType: "EXCEPTION", inputData: "0" })], { highPriority: false });
    expect(ok.every((i) => i.ok)).toBe(true);
    const short = reviewChecklist([draft()], { highPriority: false });
    expect(short.find((i) => i.key === "edge")!.ok).toBe(false);
  });

  it("모호어만 있는 예상결과·중복·H등급 권고", () => {
    const items = reviewChecklist([draft({ expectedResult: "정상 처리 확인" }), draft({ caseType: "EXCEPTION" }), draft({ caseType: "EXCEPTION" })], { highPriority: true });
    expect(items.find((i) => i.key === "ambiguous")!.ok).toBe(false);
    expect(items.find((i) => i.key === "duplicate")!.ok).toBe(false);
    expect(items.find((i) => i.key === "high")!.ok).toBe(false);
  });
});

describe("직무 분리", () => {
  it("수행자·QC·PL은 서로 달라야 한다", () => {
    expect(() => assertSeparation({ executorId: "a", qcUserId: "a" })).toThrow();
    expect(() => assertSeparation({ executorId: "a", plUserId: "a" })).toThrow();
    expect(() => assertSeparation({ qcUserId: "b", plUserId: "b" })).toThrow();
    expect(() => assertSeparation({ executorId: "a", qcUserId: "b", plUserId: "c" })).not.toThrow();
  });
});

describe("시나리오 검토", () => {
  it("작성중·반려 → 검토요청 → 승인/반려", () => {
    expect(nextScenarioStatus("DRAFT", "REQUEST")).toBe("REVIEW_REQUESTED");
    expect(nextScenarioStatus("REJECTED", "REQUEST")).toBe("REVIEW_REQUESTED");
    expect(nextScenarioStatus("REVIEW_REQUESTED", "APPROVE")).toBe("APPROVED");
    expect(nextScenarioStatus("REVIEW_REQUESTED", "REJECT")).toBe("REJECTED");
    expect(() => nextScenarioStatus("APPROVED", "EDIT")).toThrow();
  });
});

describe("수행", () => {
  it("승인·수행중 케이스만 수행, 차수는 최대 + 1", () => {
    expect(canExecuteCase("APPROVED")).toBe(true);
    expect(canExecuteCase("QC_PENDING")).toBe(false);
    expect(nextRoundNo([])).toBe(1);
    expect(nextRoundNo([1, 2])).toBe(3);
  });

  it("판정별 입력 검증", () => {
    expect(() => validateExecution({ verdict: "PASS", actualResult: "", naReason: "", evidenceCount: 0 })).toThrow(/증적/);
    expect(() => validateExecution({ verdict: "FAIL", actualResult: "", naReason: "", evidenceCount: 1 })).toThrow(/실제결과/);
    expect(() => validateExecution({ verdict: "NA", actualResult: "", naReason: "", evidenceCount: 0 })).toThrow(/사유/);
    expect(() => validateExecution({ verdict: "BLOCKED", actualResult: "", naReason: "", evidenceCount: 0 })).not.toThrow();
  });

  it("판정 직후 상태", () => {
    expect(afterExecution("PASS")).toEqual({ approvalStatus: "QC_PENDING", caseStatus: "QC_PENDING" });
    expect(afterExecution("NA")).toEqual({ approvalStatus: "PL_PENDING", caseStatus: "PL_PENDING" });
    expect(afterExecution("FAIL")).toEqual({ approvalStatus: null, caseStatus: "IN_EXECUTION" });
  });
});

describe("결과 확인 QC → PL", () => {
  it("QC 승인 → PL대기, PL 승인 → 승인완료", () => {
    expect(applyApproval({ approvalStatus: "QC_PENDING", verdict: "PASS", step: "QC", decision: "APPROVED" })).toEqual({ approvalStatus: "PL_PENDING", caseStatus: "PL_PENDING" });
    expect(applyApproval({ approvalStatus: "PL_PENDING", verdict: "PASS", step: "PL", decision: "APPROVED" })).toEqual({ approvalStatus: "APPROVED", caseStatus: "PL_CONFIRMED" });
  });

  it("순서 위반·반려 사유 누락 차단, 반려는 재수행 대기", () => {
    expect(() => applyApproval({ approvalStatus: "QC_PENDING", verdict: "PASS", step: "PL", decision: "APPROVED" })).toThrow();
    expect(() => applyApproval({ approvalStatus: "QC_PENDING", verdict: "PASS", step: "QC", decision: "REJECTED" })).toThrow(/사유/);
    expect(applyApproval({ approvalStatus: "QC_PENDING", verdict: "PASS", step: "QC", decision: "REJECTED", rejectReasonCodeId: "r", comment: "증적 불명확" }).caseStatus).toBe("IN_EXECUTION");
  });

  it("확인자 자격 — 수행자 불가, 지정자만, 증적 열람 필요", () => {
    const base = { step: "QC" as const, executorId: "dev", qcUserId: "qc", plUserId: "pl", hasViewedEvidence: true, verdict: "PASS" as const };
    expect(() => assertApprover({ ...base, actorId: "dev" })).toThrow();
    expect(() => assertApprover({ ...base, actorId: "pl" })).toThrow();
    expect(() => assertApprover({ ...base, actorId: "qc", hasViewedEvidence: false })).toThrow(/열람/);
    expect(() => assertApprover({ ...base, actorId: "qc" })).not.toThrow();
  });
});

describe("결함 조치·검증 (C9)", () => {
  it("등록·재조치 → 조치완료 → 적합 검증완료 / 부적합 재조치", () => {
    expect(applyDefectFix("REGISTERED")).toBe("FIXED");
    expect(applyDefectFix("REFIX")).toBe("FIXED");
    expect(() => applyDefectFix("VERIFIED")).toThrow();
    expect(applyDefectVerify({ status: "FIXED", result: "PASS", fixedBy: "dev", verifierId: "qc" })).toBe("VERIFIED");
    expect(applyDefectVerify({ status: "FIXED", result: "FAIL", fixedBy: "dev", verifierId: "qc" })).toBe("REFIX");
  });

  it("조치자는 검증할 수 없다", () => {
    expect(() => applyDefectVerify({ status: "FIXED", result: "PASS", fixedBy: "dev", verifierId: "dev" })).toThrow();
  });
});

describe("UT완료 4개 조건 현황 (조회용)", () => {
  const passed = { isActive: true, status: "PL_CONFIRMED" as const, latest: { verdict: "PASS" as const, approvalStatus: "APPROVED" as const, evidenceCount: 1 } };
  it("전부 충족", () => {
    const r = utCompletionConditions([passed, passed], []);
    expect(Object.values(r.conditions).every(Boolean)).toBe(true);
  });
  it("미수행·Open 결함·N/A 제외 반영", () => {
    const notRun = { isActive: true, status: "APPROVED" as const, latest: null };
    const na = { isActive: true, status: "PL_CONFIRMED" as const, latest: { verdict: "NA" as const, approvalStatus: "APPROVED" as const, evidenceCount: 0 } };
    const r = utCompletionConditions([passed, notRun, na], [{ status: "FIXED", severity: "MAJOR" }]);
    expect(r.targetCount).toBe(2);
    expect(r.conditions.c2AllExecuted).toBe(false);
    expect(r.conditions.c3AllPassedNoOpenDefect).toBe(false);
    expect(utCompletionConditions([passed], [{ status: "REGISTERED", severity: "MINOR" }]).conditions.c3AllPassedNoOpenDefect).toBe(true);
  });
});

describe("이정표", () => {
  it("선언자 ≠ 확인자", () => {
    expect(() => assertDevConfirm({ declaredBy: null, confirmerId: "pl" })).toThrow();
    expect(() => assertDevConfirm({ declaredBy: "dev", confirmerId: "dev" })).toThrow();
    expect(() => assertDevConfirm({ declaredBy: "dev", confirmerId: "pl" })).not.toThrow();
  });
});

describe("단위테스트 대상 Stage", () => {
  it("개발 단계만 대상", () => {
    expect(isUtTargetStage("개발")).toBe(true);
    expect(isUtTargetStage(" 개발 ")).toBe(true);
    expect(isUtTargetStage("설계")).toBe(false);
    expect(isUtTargetStage(null)).toBe(false);
  });
});
