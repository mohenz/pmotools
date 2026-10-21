import "server-only";
import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { listWbsItems } from "@/lib/server/mp/wbs";
import { listProjectMembers } from "@/lib/server/users";
import { assertSeparation, caseDisplayIdError, isUtTargetTask, missingCaseFields, nextCaseReviewStatus, type UtCaseStatus } from "@/lib/domain/ut";
import { assertActiveMember, assertNotLocked, dateOnly, isUtManager, listUtCodes, nextSequence, rule, toDate, versionConflict, type UtActor } from "@/lib/server/mp/ut/common";

// ---------------------------------------------------------------------------
// 테스트 케이스 — 작성(개발자) → 검토요청 → PL 승인/반려(설계서 6장 2~3단계, 4.4 PL 수기 지정).
// 시나리오 없이 케이스가 WBS Task(또는 WBS 없음)에 바로 속한다(2026-10-21 사용자 확정).
// ---------------------------------------------------------------------------

const optionalId = z.string().uuid().nullable().optional().transform((v) => v ?? null);
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().transform((v) => v ?? null);

const caseFields = {
  // 케이스 ID — 수기 입력(2026-10-21 사용자 확정)
  displayId: z.string().trim().superRefine((v, ctx) => { const message = caseDisplayIdError(v); if (message) ctx.addIssue({ code: "custom", message }); }),
  groupId: z.string().uuid(),
  screenId: z.string().trim().max(100).default(""), // 화면ID — 수기 입력(2026-10-21 사용자 확정)
  screenName: z.string().trim().max(200).default(""), // 화면명 — 수기 입력
  requirementId: optionalId,
  plUserId: optionalId,
  caseTypeCodeId: z.string({ error: "케이스유형을 선택해 주세요." }).uuid("케이스유형을 선택해 주세요."), // 케이스유형 — 공통코드 ut_case_type(화면·기능·API), 필수(2026-10-21)
  name: z.string().trim().min(1).max(200),
  precondition: z.string().max(2000).default(""),
  steps: z.string().max(4000).default(""),
  inputData: z.string().max(2000).default(""),
  expectedResult: z.string().max(1000).default(""),
  executorId: optionalId,
  plannedDate: optionalDate,
  qcUserId: optionalId,
};
export const caseInputSchema = z.object({ wbsItemId: optionalId, ...caseFields }); // wbsItemId null = WBS 없이 등록
const caseUpdateSchema = z.object({ ...caseFields, version: z.number().int().positive() });

// ---------------------------------------------------------------------------
// 조회
// ---------------------------------------------------------------------------

/** 케이스를 걸 수 있는 WBS Task — WBS 기준으로 읽는다: 보관 제외, 개발 단계 Leaf 중 "단위테스트 대상" 체크(2026-10-21 사용자 확정). */
export async function listUtWbsLeaves(projectId: string) {
  const items = await listWbsItems(projectId);
  const parentIds = new Set(items.filter((i) => i.parentId).map((i) => i.parentId!));
  return items.filter((i) => isUtTargetTask({ ...i, isLeaf: !parentIds.has(i.id) })).map((i) => ({ id: i.id, displayId: i.displayId, code: i.code, name: i.name, stage: i.stage, ownerUserId: i.ownerUserId, ownerName: i.ownerName, dueDate: i.dueDate }));
}

/** 등록·수정 화면 선택지 — 업무단위(업무그룹), 구성원, 프로그램, 요구사항, 공통코드. */
export async function getUtFormOptions(projectId: string) {
  const prisma = getPrisma();
  const [groups, companies, members, requirements, codes] = await Promise.all([
    prisma.groups.findMany({ where: { projectId, groupType: "WORK_MODULE", isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { id: true, code: true, label: true, leaderId: true } }),
    prisma.groups.findMany({ where: { projectId, groupType: "COMPANY", isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { id: true, code: true, label: true } }),
    listProjectMembers(projectId),
    prisma.requirement.findMany({ where: { projectId, archivedAt: null }, orderBy: { displayId: "asc" }, select: { id: true, displayId: true, title: true } }),
    listUtCodes(projectId),
  ]);
  return { groups, companies, members, requirements, codes };
}

/** PL 지정 참고(4.4) — 작성자 소속 업무그룹과 리더. 선택은 사람이 한다. */
export async function getPlReference(projectId: string, writerId: string) {
  const maps = await getPrisma().userGroupMap.findMany({ where: { userId: writerId, group: { projectId, groupType: "WORK_MODULE", isActive: true } }, include: { group: { include: { leader: { select: { id: true, name: true } } } } } });
  return maps.map((m) => ({ groupId: m.group.id, groupLabel: m.group.label, leaderId: m.group.leader?.id ?? null, leaderName: m.group.leader?.name ?? null }));
}

// ---------------------------------------------------------------------------
// 등록·수정·비활성
// ---------------------------------------------------------------------------

async function assertCaseRefs(projectId: string, data: { groupId: string; caseTypeCodeId: string; plUserId: string | null; requirementId: string | null; executorId: string | null; qcUserId: string | null }) {
  const prisma = getPrisma();
  {
    const code = await prisma.commonCode.findUnique({ where: { id: data.caseTypeCodeId }, select: { projectId: true, groupCode: true, isActive: true } });
    if (!code || code.projectId !== projectId || code.groupCode !== "ut_case_type" || !code.isActive) throw new DomainError("INVALID_CODE", "케이스유형을 확인해 주세요.");
  }
  const group = await prisma.groups.findUnique({ where: { id: data.groupId }, select: { projectId: true, groupType: true, isActive: true } });
  if (!group || group.projectId !== projectId || group.groupType !== "WORK_MODULE" || !group.isActive) throw new DomainError("INVALID_CODE", "업무단위(업무그룹)를 확인해 주세요.");
  if (data.requirementId) {
    const req = await prisma.requirement.findUnique({ where: { id: data.requirementId }, select: { projectId: true, archivedAt: true } });
    if (!req || req.projectId !== projectId || req.archivedAt) throw new DomainError("INVALID_CODE", "요구사항을 확인해 주세요.");
  }
  await assertActiveMember(projectId, data.plUserId, "PL 확인자");
  await assertActiveMember(projectId, data.executorId, "수행 담당자");
  await assertActiveMember(projectId, data.qcUserId, "QC 확인자");
  await rule(() => assertSeparation({ executorId: data.executorId, qcUserId: data.qcUserId, plUserId: data.plUserId }));
}

/** 같은 프로젝트에 같은 케이스 ID가 있으면 막는다(대소문자 무시). DB 유일 제약은 동시 저장 대비. */
async function assertUniqueDisplayId(projectId: string, displayId: string, exceptId?: string) {
  const dup = await getPrisma().utCase.findFirst({ where: { projectId, displayId: { equals: displayId, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
  if (dup) throw new DomainError("DUPLICATE_CODE", `이미 사용 중인 케이스 ID입니다: ${displayId}`);
}
const duplicateIdError = (error: unknown, displayId: string) => {
  if ((error as { code?: string })?.code === "P2002") throw new DomainError("DUPLICATE_CODE", `이미 사용 중인 케이스 ID입니다: ${displayId}`);
  throw error;
};

export async function createUtCase(actor: UtActor, input: unknown) {
  const data = caseInputSchema.parse(input);
  await assertNotLocked(actor.projectId);
  const wbs = data.wbsItemId ? (await listUtWbsLeaves(actor.projectId)).find((w) => w.id === data.wbsItemId) ?? null : null;
  if (data.wbsItemId && !wbs) throw new DomainError("INVALID_CODE", "WBS에서 단위테스트 대상으로 체크된 개발 단계 최하위(Leaf) Task만 선택할 수 있습니다.");
  await assertCaseRefs(actor.projectId, data);
  if (data.plUserId === actor.userId) throw new DomainError("FORBIDDEN", "작성자 본인을 PL 확인자로 지정할 수 없습니다.");
  await assertUniqueDisplayId(actor.projectId, data.displayId);
  const created = await getPrisma().$transaction(async (tx) => {
    // seq는 같은 WBS 안의 등록 순서(정렬 보조)로만 쓴다.
    const seq = await nextSequence(tx, data.wbsItemId ? `case:${data.wbsItemId}` : `case:nowbs:${actor.projectId}`);
    return tx.utCase.create({ data: { ...data, plannedDate: toDate(data.plannedDate), projectId: actor.projectId, seq, createdBy: actor.userId } });
  }).catch((error) => duplicateIdError(error, data.displayId));
  await writeAuditLog(actor.projectId, actor.userId, "UT_CASE_INSERT", "ut_cases", created.id, null, { displayId: created.displayId, wbsItemId: data.wbsItemId });
  return { id: created.id, displayId: created.displayId };
}

/** 작성중·반려 상태에서 작성자 또는 PM/PMO만 수정한다. */
async function loadEditableCase(actor: UtActor, caseId: string) {
  const c = await getPrisma().utCase.findUnique({ where: { id: caseId } });
  if (!c || c.projectId !== actor.projectId) throw new DomainError("NOT_FOUND", "케이스를 찾을 수 없습니다.");
  if (c.createdBy !== actor.userId && !isUtManager(actor)) throw new DomainError("FORBIDDEN", "작성자 또는 PM/PMO만 수정할 수 있습니다.");
  await rule(() => nextCaseReviewStatus(c.status, "EDIT"));
  await assertNotLocked(actor.projectId);
  return c;
}

export async function updateUtCase(actor: UtActor, caseId: string, input: unknown) {
  const data = caseUpdateSchema.parse(input);
  const before = await loadEditableCase(actor, caseId);
  await assertCaseRefs(actor.projectId, data);
  if (data.plUserId && data.plUserId === before.createdBy) throw new DomainError("FORBIDDEN", "작성자 본인을 PL 확인자로 지정할 수 없습니다.");
  await assertUniqueDisplayId(actor.projectId, data.displayId, caseId);
  const { version, plannedDate, ...rest } = data;
  const result = await getPrisma().utCase.updateMany({ where: { id: caseId, version }, data: { ...rest, plannedDate: toDate(plannedDate), updatedBy: actor.userId, version: { increment: 1 } } }).catch((error) => duplicateIdError(error, data.displayId));
  if (!result.count) versionConflict();
  await writeAuditLog(actor.projectId, actor.userId, "UT_CASE_UPDATE", "ut_cases", caseId, { displayId: before.displayId, name: before.name, groupId: before.groupId, plUserId: before.plUserId }, { displayId: data.displayId, version: version + 1 });
  return { ok: true };
}

/** PL 변경은 PM/PMO만(4.4) — 상태와 관계없이 미처리 건에 적용, 이미 PL 승인된 차수는 그대로. */
export async function reassignUtCasePl(actor: UtActor, caseId: string, input: unknown) {
  const { plUserId } = z.object({ plUserId: z.string().uuid() }).parse(input);
  if (!isUtManager(actor)) throw new DomainError("FORBIDDEN", "PL 변경은 PM/PMO만 할 수 있습니다.");
  const c = await getPrisma().utCase.findUnique({ where: { id: caseId } });
  if (!c || c.projectId !== actor.projectId) throw new DomainError("NOT_FOUND", "케이스를 찾을 수 없습니다.");
  await assertActiveMember(actor.projectId, plUserId, "PL 확인자");
  if (plUserId === c.createdBy) throw new DomainError("FORBIDDEN", "작성자 본인을 PL 확인자로 지정할 수 없습니다.");
  await rule(() => assertSeparation({ executorId: c.executorId, qcUserId: c.qcUserId, plUserId }));
  await getPrisma().utCase.update({ where: { id: caseId }, data: { plUserId, updatedBy: actor.userId, version: { increment: 1 } } });
  await writeAuditLog(actor.projectId, actor.userId, "UT_CASE_PL_REASSIGN", "ut_cases", caseId, { plUserId: c.plUserId }, { plUserId });
  return { ok: true };
}

/** 비활성(보관) — 수행 이력이 있는 케이스는 비활성으로 돌릴 수 없다(감사 증적). */
export async function setUtCaseActive(actor: UtActor, caseId: string, isActive: boolean) {
  const c = await loadEditableCase(actor, caseId);
  if (!isActive && (await getPrisma().utExecution.count({ where: { caseId } }))) throw new DomainError("INVALID_STATE", "수행 이력이 있는 케이스는 비활성으로 바꿀 수 없습니다.");
  await getPrisma().utCase.update({ where: { id: caseId }, data: { isActive, updatedBy: actor.userId, version: { increment: 1 } } });
  await writeAuditLog(actor.projectId, actor.userId, isActive ? "UT_CASE_ACTIVATE" : "UT_CASE_DEACTIVATE", "ut_cases", caseId, { isActive: c.isActive }, { isActive });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 검토요청 → PL 승인/반려(케이스 단위)
// ---------------------------------------------------------------------------

export async function requestUtCaseReview(actor: UtActor, caseId: string) {
  const c = await loadEditableCase(actor, caseId);
  if (!c.isActive) throw new DomainError("INVALID_STATE", "비활성 케이스는 검토요청할 수 없습니다.");
  if (!c.plUserId) throw new DomainError("INVALID_STATE", "PL 확인자를 지정한 뒤 검토요청할 수 있습니다.");
  const missing = missingCaseFields({ ...c, plannedDate: dateOnly(c.plannedDate) });
  if (missing.length) throw new DomainError("INVALID_STATE", `필수 항목이 비어 있습니다: ${missing.join(", ")}`);
  const next = await rule(() => nextCaseReviewStatus(c.status, "REQUEST"));
  await getPrisma().utCase.update({ where: { id: caseId }, data: { status: next, reviewRequestedAt: new Date(), rejectReason: "", updatedBy: actor.userId, version: { increment: 1 } } });
  await writeAuditLog(actor.projectId, actor.userId, "UT_CASE_REVIEW_REQUEST", "ut_cases", caseId, { status: c.status }, { status: next });
  return { ok: true };
}

export async function decideUtCaseReview(actor: UtActor, caseId: string, input: unknown) {
  const data = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), reason: z.string().trim().max(1000).default("") }).parse(input);
  const c = await getPrisma().utCase.findUnique({ where: { id: caseId } });
  if (!c || c.projectId !== actor.projectId) throw new DomainError("NOT_FOUND", "케이스를 찾을 수 없습니다.");
  if (c.plUserId !== actor.userId) throw new DomainError("FORBIDDEN", "지정된 PL만 검토할 수 있습니다.");
  if (c.createdBy === actor.userId) throw new DomainError("FORBIDDEN", "작성자는 자기 케이스를 승인할 수 없습니다.");
  if (data.decision === "REJECTED" && !data.reason) throw new DomainError("INVALID_STATE", "반려 사유를 입력해 주세요.");
  await assertNotLocked(actor.projectId);
  const next = await rule(() => nextCaseReviewStatus(c.status, data.decision === "APPROVED" ? "APPROVE" : "REJECT"));
  const approved = next === "APPROVED";
  await getPrisma().utCase.update({ where: { id: caseId }, data: approved ? { status: next, approvedAt: new Date(), approvedBy: actor.userId, version: { increment: 1 } } : { status: next, rejectReason: data.reason, version: { increment: 1 } } });
  await writeAuditLog(actor.projectId, actor.userId, approved ? "UT_CASE_APPROVE" : "UT_CASE_REJECT", "ut_cases", caseId, { status: c.status }, { status: next, reason: data.reason || undefined });
  return { ok: true };
}

/** 검토함 — 내가 PL이고 검토요청 상태인 케이스. */
export async function listUtReviewInbox(projectIds: string[], userId: string) {
  const rows = await getPrisma().utCase.findMany({ where: { projectId: { in: projectIds }, isActive: true, status: "REVIEW_REQUESTED" satisfies UtCaseStatus, plUserId: userId }, include: { wbsItem: { select: { displayId: true, name: true } }, creator: { select: { name: true } } }, orderBy: { reviewRequestedAt: "asc" } });
  return rows.map((c) => ({ id: c.id, displayId: c.displayId, name: c.name, wbsItemId: c.wbsItemId, wbsDisplayId: c.wbsItem?.displayId ?? "", wbsName: c.wbsItem?.name ?? "", writerName: c.creator.name, requestedAt: c.reviewRequestedAt?.toISOString() ?? null }));
}
