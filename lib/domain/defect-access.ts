import { hasPmPmoAccess } from "@/lib/domain/job-access";

// ---------------------------------------------------------------------------
// 결함관리 권한·조회 범위(설계서 4.2·4.3) — 순수 규칙. 단위테스트 코드와 독립이다(규칙 1).
//   조회: 일반 사용자는 본인이 등록했거나 담당인 결함만. 업무그룹리더는 본인 그룹, QC·PL은 본인이 QC·PL인 케이스의 결함도 본다.
//         관리자·슈퍼관리자·운영자·PMO는 프로젝트 전체.
//   조치자 지정·변경: QC, PL, 운영자, 업무그룹리더, PMO, 관리자·슈퍼관리자.
// ---------------------------------------------------------------------------

export type DefectActor = { userId: string; role: string | null | undefined; jobTitle: string | null | undefined };

/** 서버가 읽기 전용으로 조회해 채우는 사실 — 내가 리더인 업무그룹, 내가 QC·PL인 케이스(단위테스트 읽기 전용 조회). */
export type DefectAccessFacts = { ledGroupIds: ReadonlySet<string>; qcPlCaseIds: ReadonlySet<string> };

export type DefectSubject = { createdBy: string; assigneeUserId: string | null; groupId: string | null; caseId: string | null };

export const NO_FACTS: DefectAccessFacts = { ledGroupIds: new Set(), qcPlCaseIds: new Set() };

/** 관리자·슈퍼관리자 — 단위테스트와 같은 원칙으로 모든 기능에 접근한다. */
export const isDefectAdmin = (actor: DefectActor) => actor.role === "ADMIN" || actor.role === "SUPER_ADMIN";
export const isDefectOperator = (actor: DefectActor) => actor.role === "OPERATOR";
/** PMO(PM/PMO 직무). 슈퍼관리자는 직무와 무관하게 포함된다. */
export const isDefectPmo = (actor: DefectActor) => hasPmPmoAccess(actor.jobTitle, actor.role);

/** 프로젝트 전체 결함을 보는 주체: 관리자·슈퍼관리자·운영자·PMO. */
export const hasFullDefectView = (actor: DefectActor) => isDefectAdmin(actor) || isDefectOperator(actor) || isDefectPmo(actor);

export function canViewDefect(actor: DefectActor, d: DefectSubject, facts: DefectAccessFacts = NO_FACTS) {
  if (hasFullDefectView(actor)) return true;
  if (d.createdBy === actor.userId || d.assigneeUserId === actor.userId) return true;
  if (d.groupId && facts.ledGroupIds.has(d.groupId)) return true;
  if (d.caseId && facts.qcPlCaseIds.has(d.caseId)) return true;
  return false;
}

/** 조치자 지정·변경 권한(지정 권한자). 케이스가 없는 결함은 업무단위의 리더와 PMO·운영자·관리자가 지정한다. */
export function canAssignDefect(actor: DefectActor, d: Pick<DefectSubject, "groupId" | "caseId">, facts: DefectAccessFacts = NO_FACTS) {
  if (hasFullDefectView(actor)) return true;
  if (d.groupId && facts.ledGroupIds.has(d.groupId)) return true;
  if (d.caseId && facts.qcPlCaseIds.has(d.caseId)) return true;
  return false;
}

export type DefectPermissions = {
  view: boolean;
  assign: boolean;       // 조치자 지정·변경
  editBasic: boolean;    // 제목·재현 단계·화면 정보 등 일반 항목
  editAction: boolean;   // 상태·결함식별·조치 내용·조치 예정/시작/종료일
  editSeverity: boolean; // 심각도
  editPriority: boolean; // 우선순위
  delete: boolean;       // 논리 삭제
};

export function defectPermissions(actor: DefectActor, d: DefectSubject, facts: DefectAccessFacts = NO_FACTS): DefectPermissions {
  const view = canViewDefect(actor, d, facts);
  if (!view) return { view: false, assign: false, editBasic: false, editAction: false, editSeverity: false, editPriority: false, delete: false };
  const assign = canAssignDefect(actor, d, facts);
  const admin = isDefectAdmin(actor);
  const creator = d.createdBy === actor.userId;
  const assignee = d.assigneeUserId === actor.userId;
  return {
    view,
    assign: admin || assign,
    editBasic: admin || assign || creator || assignee,
    editAction: admin || assign || assignee,
    editSeverity: admin || assign || creator,
    editPriority: admin || assign || creator,
    delete: admin,
  };
}

// ---------------------------------------------------------------------------
// 수정 항목 분류 — 어떤 필드를 바꾸려면 어떤 권한이 필요한지.
// ---------------------------------------------------------------------------

export const DEFECT_FIELD_GROUPS = {
  basic: ["title", "stepsToRepro", "testStageCodeId", "screenPath", "menuName", "screenName", "screenUrl", "envInfo"],
  action: ["statusCodeId", "identificationCodeId", "actionComment", "actionDueDate", "actionStartDate", "actionEndDate"],
  severity: ["severityCodeId"],
  priority: ["priorityCodeId"],
} as const;

export type DefectFieldGroup = keyof typeof DEFECT_FIELD_GROUPS;

export function fieldGroupOf(field: string): DefectFieldGroup | null {
  for (const [group, fields] of Object.entries(DEFECT_FIELD_GROUPS) as [DefectFieldGroup, readonly string[]][]) if (fields.includes(field)) return group;
  return null;
}

const GROUP_PERMISSION: Record<DefectFieldGroup, keyof DefectPermissions> = { basic: "editBasic", action: "editAction", severity: "editSeverity", priority: "editPriority" };

/** 바꾸려는 필드 목록 중 권한이 없는 것. 비어 있으면 모두 허용. 알 수 없는 필드는 허용하지 않는다. */
export function forbiddenFields(changed: readonly string[], perms: DefectPermissions): string[] {
  return changed.filter((field) => {
    const group = fieldGroupOf(field);
    return !group || !perms[GROUP_PERMISSION[group]];
  });
}

// ---------------------------------------------------------------------------
// 변경 비교(이력) — 바뀐 필드만 { before, after }로 모은다. 날짜는 YYYY-MM-DD 문자열로 비교한다.
// ---------------------------------------------------------------------------

type Comparable = string | number | boolean | null | undefined | Date;
const norm = (v: Comparable) => (v instanceof Date ? v.toISOString().slice(0, 10) : v === undefined || v === "" ? null : v);

export function diffFields(before: Record<string, Comparable>, after: Record<string, Comparable>, fields: readonly string[]) {
  const changed: Record<string, { before: string | number | boolean | null; after: string | number | boolean | null }> = {};
  for (const field of fields) {
    if (!(field in after)) continue;
    const b = norm(before[field]); const a = norm(after[field]);
    if (b !== a) changed[field] = { before: b, after: a };
  }
  return changed;
}

/** 담당자 기본값 — WBS Task의 작업자가 이 프로젝트의 활성 구성원이면 그 사람, 아니면 미지정(null). */
export function defaultAssignee(wbsOwnerUserId: string | null | undefined, activeMemberIds: ReadonlySet<string>) {
  return wbsOwnerUserId && activeMemberIds.has(wbsOwnerUserId) ? wbsOwnerUserId : null;
}
