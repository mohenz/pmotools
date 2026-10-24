import { describe, expect, it } from "vitest";
import {
  canAssignDefect, canViewDefect, defaultAssignee, defectPermissions, diffFields, fieldGroupOf, forbiddenFields, hasFullDefectView, NO_FACTS,
  type DefectActor, type DefectSubject,
} from "@/lib/domain/defect-access";

const actor = (over: Partial<DefectActor> = {}): DefectActor => ({ userId: "me", role: "MEMBER", jobTitle: null, ...over });
const defect = (over: Partial<DefectSubject> = {}): DefectSubject => ({ createdBy: "writer", assigneeUserId: "worker", groupId: null, caseId: null, ...over });
const facts = (groups: string[] = [], cases: string[] = []) => ({ ledGroupIds: new Set(groups), qcPlCaseIds: new Set(cases) });

describe("조회 범위(설계서 4.3)", () => {
  it("일반 사용자는 본인이 등록했거나 담당인 결함만 본다", () => {
    expect(canViewDefect(actor(), defect({ createdBy: "me" }))).toBe(true);
    expect(canViewDefect(actor(), defect({ assigneeUserId: "me" }))).toBe(true);
    expect(canViewDefect(actor(), defect())).toBe(false);
  });

  it("관리자·슈퍼관리자·운영자·PMO는 프로젝트 전체를 본다", () => {
    for (const a of [actor({ role: "ADMIN" }), actor({ role: "SUPER_ADMIN" }), actor({ role: "OPERATOR" }), actor({ jobTitle: "PMO" }), actor({ jobTitle: "pm" })]) {
      expect(hasFullDefectView(a)).toBe(true);
      expect(canViewDefect(a, defect())).toBe(true);
    }
  });

  it("업무그룹리더는 본인 그룹의 결함을 본다", () => {
    expect(canViewDefect(actor(), defect({ groupId: "g1" }), facts(["g1"]))).toBe(true);
    expect(canViewDefect(actor(), defect({ groupId: "g2" }), facts(["g1"]))).toBe(false);
    expect(canViewDefect(actor(), defect({ groupId: null }), facts(["g1"]))).toBe(false);
  });

  it("QC·PL은 본인이 QC·PL인 케이스의 결함을 본다", () => {
    expect(canViewDefect(actor(), defect({ caseId: "c1" }), facts([], ["c1"]))).toBe(true);
    expect(canViewDefect(actor(), defect({ caseId: "c2" }), facts([], ["c1"]))).toBe(false);
    expect(canViewDefect(actor(), defect({ caseId: null }), facts([], ["c1"]))).toBe(false);
  });
});

describe("조치자 지정·변경 권한", () => {
  it("QC·PL·운영자·그룹리더·PMO·관리자만 지정할 수 있다", () => {
    expect(canAssignDefect(actor(), { groupId: null, caseId: null })).toBe(false);
    expect(canAssignDefect(actor({ role: "OPERATOR" }), { groupId: null, caseId: null })).toBe(true);
    expect(canAssignDefect(actor({ jobTitle: "PMO" }), { groupId: null, caseId: null })).toBe(true);
    expect(canAssignDefect(actor({ role: "ADMIN" }), { groupId: null, caseId: null })).toBe(true);
    expect(canAssignDefect(actor(), { groupId: "g1", caseId: null }, facts(["g1"]))).toBe(true);
    expect(canAssignDefect(actor(), { groupId: null, caseId: "c1" }, facts([], ["c1"]))).toBe(true);
  });

  it("등록자·담당자 본인이라는 이유만으로는 지정할 수 없다", () => {
    expect(canAssignDefect(actor(), { groupId: null, caseId: null })).toBe(false);
    expect(defectPermissions(actor(), defect({ createdBy: "me" })).assign).toBe(false);
    expect(defectPermissions(actor(), defect({ assigneeUserId: "me" })).assign).toBe(false);
  });

  it("그룹·케이스가 다르면 리더·QC·PL이어도 지정할 수 없다", () => {
    expect(canAssignDefect(actor(), { groupId: "g2", caseId: "c2" }, facts(["g1"], ["c1"]))).toBe(false);
  });
});

describe("필드별 수정 권한", () => {
  it("담당자는 조치 항목을 바꿀 수 있고 심각도는 바꿀 수 없다", () => {
    const p = defectPermissions(actor(), defect({ assigneeUserId: "me" }));
    expect(p.editAction).toBe(true);
    expect(p.editBasic).toBe(true);
    expect(p.editSeverity).toBe(false);
    expect(p.delete).toBe(false);
  });

  it("등록자는 일반 항목·심각도·우선순위를 바꿀 수 있고 조치 항목은 바꿀 수 없다", () => {
    const p = defectPermissions(actor(), defect({ createdBy: "me" }));
    expect(p.editBasic).toBe(true);
    expect(p.editSeverity).toBe(true);
    expect(p.editPriority).toBe(true);
    expect(p.editAction).toBe(false);
  });

  it("지정 권한자는 조치·심각도를 바꿀 수 있고 삭제는 관리자만 한다", () => {
    const op = defectPermissions(actor({ role: "OPERATOR" }), defect());
    expect(op.editAction && op.editSeverity && op.assign).toBe(true);
    expect(op.delete).toBe(false);
    expect(defectPermissions(actor({ role: "ADMIN" }), defect()).delete).toBe(true);
    expect(defectPermissions(actor({ role: "SUPER_ADMIN" }), defect()).delete).toBe(true);
  });

  it("볼 수 없는 결함에는 어떤 권한도 없다", () => {
    const p = defectPermissions(actor(), defect());
    expect(Object.values(p).some(Boolean)).toBe(false);
  });

  it("권한이 없는 필드를 골라낸다(알 수 없는 필드는 거부)", () => {
    const p = defectPermissions(actor(), defect({ createdBy: "me" }));
    expect(forbiddenFields(["title", "severityCodeId"], p)).toEqual([]);
    expect(forbiddenFields(["title", "statusCodeId", "actionComment"], p)).toEqual(["statusCodeId", "actionComment"]);
    expect(forbiddenFields(["unknownField"], p)).toEqual(["unknownField"]);
    expect(fieldGroupOf("actionDueDate")).toBe("action");
    expect(fieldGroupOf("assigneeUserId")).toBeNull(); // 담당자 변경은 별도 지정 절차
  });

  it("심각도(결함 속성)와 조치 상태(처리 진행)는 서로 다른 권한 묶음이다", () => {
    expect(fieldGroupOf("severityCodeId")).toBe("severity");
    expect(fieldGroupOf("statusCodeId")).toBe("action");
  });
});

describe("변경 비교와 담당자 기본값", () => {
  it("바뀐 필드만 이력에 모은다(빈 문자열은 비어 있음으로 본다)", () => {
    const before = { title: "A", stepsToRepro: "", actionDueDate: new Date("2026-10-24T00:00:00Z"), severityCodeId: "s1" };
    const after = { title: "B", stepsToRepro: "", actionDueDate: "2026-10-24", severityCodeId: "s2" };
    expect(diffFields(before, after, ["title", "stepsToRepro", "actionDueDate", "severityCodeId"])).toEqual({
      title: { before: "A", after: "B" }, severityCodeId: { before: "s1", after: "s2" },
    });
    expect(diffFields({ title: "A" }, { title: "A" }, ["title"])).toEqual({});
    expect(diffFields({ a: null }, { a: "" }, ["a"])).toEqual({});
  });

  it("후보에 없는 필드는 비교하지 않는다", () => {
    expect(diffFields({ title: "A" }, { }, ["title"])).toEqual({});
  });

  it("조치자 기본값은 WBS 작업자가 활성 구성원일 때만", () => {
    expect(defaultAssignee("u1", new Set(["u1"]))).toBe("u1");
    expect(defaultAssignee("u1", new Set(["u2"]))).toBeNull();
    expect(defaultAssignee(null, new Set(["u1"]))).toBeNull();
  });

  it("NO_FACTS는 비어 있다", () => {
    expect(NO_FACTS.ledGroupIds.size + NO_FACTS.qcPlCaseIds.size).toBe(0);
  });
});
