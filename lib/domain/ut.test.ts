import { describe, expect, it } from "vitest";
import {
  afterExecution, applyApproval, applyDefectFix, applyDefectVerify, assertApprover, assertDevConfirm, assertSeparation, canExecuteCase,
  caseDisplayIdError, canEditCase, defectDisplayId, isUtTargetStage, isUtTargetTask, nextRoundNo, utCompletionConditions, validateExecution,
} from "@/lib/domain/ut";

describe("채번 (4.7)", () => {
  it("케이스 ID(수기 입력 검증)·결함 ID", () => {
    expect(caseDisplayIdError("UTC-2026-000123-003")).toBeNull();
    expect(caseDisplayIdError("  ")).not.toBeNull();
    expect(caseDisplayIdError("UTC 001")).not.toBeNull();
    expect(caseDisplayIdError("x".repeat(51))).not.toBeNull();
    expect(defectDisplayId("2026-10-20", 12)).toBe("DF-261020-0012");
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

describe("케이스 수정", () => {
  it("검토·승인 없이 수행 대기 케이스는 첫 수행 등록 전까지만 수정", () => {
    expect(canEditCase("IN_EXECUTION", 0)).toBe(true);
    expect(canEditCase("IN_EXECUTION", 1)).toBe(false);
    expect(canEditCase("QC_PENDING", 0)).toBe(false);
    // 검토 폐지 전 상태도 운영 데이터 변환 전까지 같은 규칙으로 다룬다
    expect(canEditCase("DRAFT", 0)).toBe(true);
    expect(canEditCase("REVIEW_REQUESTED", 0)).toBe(true);
    expect(canEditCase("REJECTED", 1)).toBe(false);
    expect(canExecuteCase("DRAFT")).toBe(true);
  });
});

describe("수행", () => {
  it("수행중(검토 폐지 전 승인 포함) 케이스만 수행, 차수는 최대 + 1", () => {
    expect(canExecuteCase("IN_EXECUTION")).toBe(true);
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
    expect(() => validateExecution({ verdict: "PASS", actualResult: "", naReason: "", evidenceCount: 3 })).not.toThrow();
    expect(() => validateExecution({ verdict: "PASS", actualResult: "", naReason: "", evidenceCount: 4 })).toThrow(/최대 3개/);
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

  it("관리자(anyDesignee)는 지정자·수행자 여부와 관계없이 확인하되 증적 미열람은 막는다", () => {
    const base = { executorId: "dev", qcUserId: "qc", plUserId: "pl", hasViewedEvidence: true, verdict: "PASS" as const, anyDesignee: true };
    expect(() => assertApprover({ ...base, step: "QC", actorId: "admin" })).not.toThrow();
    expect(() => assertApprover({ ...base, step: "PL", actorId: "admin" })).not.toThrow();
    expect(() => assertApprover({ ...base, step: "QC", actorId: "dev" })).not.toThrow();
    expect(() => assertApprover({ ...base, step: "QC", actorId: "admin", hasViewedEvidence: false })).toThrow(/열람/);
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

describe("단위테스트 대상 Task", () => {
  it("개발 단계 Leaf + 대상 체크만 대상", () => {
    expect(isUtTargetTask({ stage: "개발", isUnitTestTarget: true, isLeaf: true })).toBe(true);
    expect(isUtTargetTask({ stage: "개발", isUnitTestTarget: false, isLeaf: true })).toBe(false);
    expect(isUtTargetTask({ stage: "설계", isUnitTestTarget: true, isLeaf: true })).toBe(false);
    expect(isUtTargetTask({ stage: "개발", isUnitTestTarget: true, isLeaf: false })).toBe(false);
  });
});

describe("관리자 강제 처리(force)", () => {
  it("확인 대기 상태가 아니어도 확인 결과를 계산한다", () => {
    expect(() => applyApproval({ approvalStatus: null, verdict: "PASS", step: "QC", decision: "APPROVED" })).toThrow();
    expect(applyApproval({ approvalStatus: null, verdict: "PASS", step: "QC", decision: "APPROVED", force: true })).toEqual({ approvalStatus: "PL_PENDING", caseStatus: "PL_PENDING" });
    expect(applyApproval({ approvalStatus: "APPROVED", verdict: "PASS", step: "PL", decision: "APPROVED", force: true }).caseStatus).toBe("PL_CONFIRMED");
  });

  it("결함 조치·검증은 상태·조치자 제한 없이 처리", () => {
    expect(() => applyDefectFix("VERIFIED")).toThrow();
    expect(applyDefectFix("VERIFIED", true)).toBe("FIXED");
    expect(() => applyDefectVerify({ status: "REGISTERED", result: "PASS", fixedBy: "a", verifierId: "a" })).toThrow();
    expect(applyDefectVerify({ status: "REGISTERED", result: "PASS", fixedBy: "a", verifierId: "a", force: true })).toBe("VERIFIED");
    expect(applyDefectVerify({ status: "FIXED", result: "FAIL", fixedBy: "a", verifierId: "a", force: true })).toBe("REFIX");
  });
});
