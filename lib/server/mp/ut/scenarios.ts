import "server-only";
import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { listWbsItems } from "@/lib/server/mp/wbs";
import { listProjectMembers } from "@/lib/server/users";
import { assertSeparation, caseDisplayId, missingCaseFields, nextScenarioStatus, reviewChecklist, scenarioDisplayId, utCompletionConditions, type UtCaseStatus } from "@/lib/domain/ut";
import { assertActiveMember, assertNotLocked, dateOnly, isUtManager, listUtCodes, nextSequence, rule, toDate, versionConflict, type UtActor } from "@/lib/server/mp/ut/common";

// ---------------------------------------------------------------------------
// 시나리오·케이스 — 작성(개발자) → 검토요청 → PL 승인/반려(설계서 6장 2~3단계, 4.4 PL 수기 지정).
// ---------------------------------------------------------------------------

const priority = z.enum(["H", "M", "L"]);
const optionalId = z.string().uuid().nullable().optional().transform((v) => v ?? null);
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().transform((v) => v ?? null);

export const scenarioInputSchema = z.object({
  wbsItemId: z.string().uuid(),
  groupId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  priority: priority.default("M"),
  plUserId: optionalId,
  programId: optionalId,
  requirementId: optionalId,
});
const scenarioUpdateSchema = scenarioInputSchema.omit({ wbsItemId: true }).extend({ version: z.number().int().positive() });

export const caseInputSchema = z.object({
  caseType: z.enum(["NORMAL", "EXCEPTION", "BOUNDARY"]),
  name: z.string().trim().min(1).max(200),
  precondition: z.string().max(2000).default(""),
  steps: z.string().max(4000).default(""),
  inputData: z.string().max(2000).default(""),
  expectedResult: z.string().max(1000).default(""),
  priority: priority.default("M"),
  executorId: optionalId,
  plannedDate: optionalDate,
  qcUserId: optionalId,
});
const caseUpdateSchema = caseInputSchema.extend({ version: z.number().int().positive() });

const EDITABLE: ("DRAFT" | "REJECTED")[] = ["DRAFT", "REJECTED"];

// ---------------------------------------------------------------------------
// 조회
// ---------------------------------------------------------------------------

/** 시나리오를 걸 수 있는 Leaf WBS(보관 제외). */
export async function listUtWbsLeaves(projectId: string) {
  const items = await listWbsItems(projectId);
  const parentIds = new Set(items.filter((i) => i.parentId).map((i) => i.parentId!));
  return items.filter((i) => !parentIds.has(i.id)).map((i) => ({ id: i.id, displayId: i.displayId, code: i.code, name: i.name, stage: i.stage, ownerUserId: i.ownerUserId, ownerName: i.ownerName, dueDate: i.dueDate }));
}

/** 등록·수정 화면 선택지 — 업무단위(업무그룹), 구성원, 프로그램, 요구사항, 공통코드. */
export async function getUtFormOptions(projectId: string) {
  const prisma = getPrisma();
  const [groups, members, programs, requirements, codes] = await Promise.all([
    prisma.groups.findMany({ where: { projectId, groupType: "WORK_MODULE", isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { id: true, code: true, label: true, leaderId: true } }),
    listProjectMembers(projectId),
    prisma.utProgram.findMany({ where: { projectId, archivedAt: null }, orderBy: { programCode: "asc" }, select: { id: true, programCode: true, name: true, screenId: true } }),
    prisma.requirement.findMany({ where: { projectId, archivedAt: null }, orderBy: { displayId: "asc" }, select: { id: true, displayId: true, title: true } }),
    listUtCodes(projectId),
  ]);
  return { groups, members, programs, requirements, codes };
}

/** PL 지정 참고(4.4) — 작성자 소속 업무그룹과 리더. 선택은 사람이 한다. */
export async function getPlReference(projectId: string, writerId: string) {
  const maps = await getPrisma().userGroupMap.findMany({ where: { userId: writerId, group: { projectId, groupType: "WORK_MODULE", isActive: true } }, include: { group: { include: { leader: { select: { id: true, name: true } } } } } });
  return maps.map((m) => ({ groupId: m.group.id, groupLabel: m.group.label, leaderId: m.group.leader?.id ?? null, leaderName: m.group.leader?.name ?? null }));
}

export type UtScenarioFilters = { q?: string; status?: string; wbsItemId?: string; groupId?: string; mine?: string; userId?: string };

export async function listUtScenarios(projectIds: string[], filters: UtScenarioFilters = {}) {
  const q = filters.q?.trim();
  const rows = await getPrisma().utScenario.findMany({
    where: {
      projectId: { in: projectIds }, archivedAt: null,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.wbsItemId ? { wbsItemId: filters.wbsItemId } : {}),
      ...(filters.groupId ? { groupId: filters.groupId } : {}),
      ...(filters.mine && filters.userId ? { OR: [{ writerId: filters.userId }, { plUserId: filters.userId }, { cases: { some: { OR: [{ executorId: filters.userId }, { qcUserId: filters.userId }] } } }] } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { displayId: { contains: q, mode: "insensitive" } }] } : {}),
    },
    include: {
      wbsItem: { select: { displayId: true, name: true, path: true } },
      group: { select: { label: true } }, writer: { select: { name: true } }, pl: { select: { name: true } },
      project: { select: { code: true } },
      cases: { where: { isActive: true }, select: { status: true, caseType: true } },
    },
    orderBy: [{ wbsItem: { path: "asc" } }, { seq: "asc" }],
    take: 500,
  });
  return rows.map((s) => {
    const byStatus = (status: UtCaseStatus) => s.cases.filter((c) => c.status === status).length;
    return {
      id: s.id, displayId: s.displayId, name: s.name, status: s.status, priority: s.priority, projectCode: s.project.code,
      wbsDisplayId: s.wbsItem.displayId, wbsName: s.wbsItem.name, groupLabel: s.group.label, writerName: s.writer.name, plName: s.pl?.name ?? null,
      caseCount: s.cases.length, confirmedCount: byStatus("PL_CONFIRMED"), pendingCount: byStatus("QC_PENDING") + byStatus("PL_PENDING"),
      edgeCount: s.cases.filter((c) => c.caseType !== "NORMAL").length,
    };
  });
}

export async function getUtScenarioDetail(projectIds: string[], scenarioId: string, viewer: UtActor) {
  const prisma = getPrisma();
  const s = await prisma.utScenario.findUnique({
    where: { id: scenarioId },
    include: {
      wbsItem: { select: { id: true, displayId: true, name: true, startDate: true, dueDate: true, ownerUserId: true } },
      group: { select: { id: true, label: true } }, writer: { select: { id: true, name: true } }, pl: { select: { id: true, name: true } },
      approver: { select: { name: true } }, program: { select: { programCode: true, name: true, screenId: true } }, requirement: { select: { displayId: true, title: true } },
      cases: {
        orderBy: { seq: "asc" },
        include: {
          executor: { select: { id: true, name: true } }, qc: { select: { id: true, name: true } },
          executions: { orderBy: { roundNo: "desc" }, include: { evidences: { select: { id: true, fileName: true, sizeBytes: true } }, approvals: { orderBy: { actedAt: "asc" }, include: { approver: { select: { name: true } } } }, executor: { select: { name: true } } } },
          defects: { select: { id: true, displayId: true, status: true, severity: true } },
        },
      },
    },
  });
  if (!s || !projectIds.includes(s.projectId) || s.archivedAt) throw new DomainError("NOT_FOUND", "시나리오를 찾을 수 없습니다.");
  const active = s.cases.filter((c) => c.isActive);
  const checklist = reviewChecklist(active.map((c) => ({ ...c, plannedDate: dateOnly(c.plannedDate) })), { highPriority: s.priority === "H" });
  const conditions = utCompletionConditions(
    s.cases.map((c) => ({ isActive: c.isActive, status: c.status, latest: c.executions[0] ? { verdict: c.executions[0].verdict, approvalStatus: c.executions[0].approvalStatus, evidenceCount: c.executions[0].evidences.length } : null })),
    s.cases.flatMap((c) => c.defects.map((d) => ({ status: d.status, severity: d.severity }))),
  );
  const canEdit = EDITABLE.includes(s.status as never) && (s.writerId === viewer.userId || isUtManager(viewer));
  return {
    id: s.id, projectId: s.projectId, displayId: s.displayId, name: s.name, status: s.status, priority: s.priority, version: s.version,
    wbs: { id: s.wbsItem.id, displayId: s.wbsItem.displayId, name: s.wbsItem.name, startDate: dateOnly(s.wbsItem.startDate), dueDate: dateOnly(s.wbsItem.dueDate) },
    group: s.group, writer: s.writer, pl: s.pl, approverName: s.approver?.name ?? null, approvedAt: s.approvedAt?.toISOString() ?? null, rejectReason: s.rejectReason,
    program: s.program, requirement: s.requirement, programId: s.programId, requirementId: s.requirementId,
    cases: s.cases.map((c) => ({
      id: c.id, displayId: c.displayId, caseType: c.caseType, name: c.name, precondition: c.precondition, steps: c.steps, inputData: c.inputData, expectedResult: c.expectedResult,
      priority: c.priority, executor: c.executor, qc: c.qc, plannedDate: dateOnly(c.plannedDate), status: c.status, isActive: c.isActive, version: c.version,
      missing: missingCaseFields({ ...c, plannedDate: dateOnly(c.plannedDate) }),
      executions: c.executions.map((e) => ({
        id: e.id, roundNo: e.roundNo, verdict: e.verdict, executedOn: dateOnly(e.executedOn), actualResult: e.actualResult, naReason: e.naReason, approvalStatus: e.approvalStatus,
        executorName: e.executor.name, evidences: e.evidences, approvals: e.approvals.map((a) => ({ step: a.step, decision: a.decision, approverName: a.approver.name, comment: a.comment, actedAt: a.actedAt.toISOString() })),
      })),
      defects: c.defects,
    })),
    checklist, conditions,
    permissions: {
      canEdit,
      canRequestReview: canEdit,
      canDecide: s.status === "REVIEW_REQUESTED" && s.plUserId === viewer.userId && s.writerId !== viewer.userId,
      isManager: isUtManager(viewer),
    },
  };
}

// ---------------------------------------------------------------------------
// 시나리오 등록·수정·보관
// ---------------------------------------------------------------------------

async function assertScenarioRefs(projectId: string, data: { groupId: string; plUserId: string | null; programId: string | null; requirementId: string | null }) {
  const prisma = getPrisma();
  const group = await prisma.groups.findUnique({ where: { id: data.groupId }, select: { projectId: true, groupType: true, isActive: true } });
  if (!group || group.projectId !== projectId || group.groupType !== "WORK_MODULE" || !group.isActive) throw new DomainError("INVALID_CODE", "업무단위(업무그룹)를 확인해 주세요.");
  await assertActiveMember(projectId, data.plUserId, "PL 확인자");
  if (data.programId) {
    const program = await prisma.utProgram.findUnique({ where: { id: data.programId }, select: { projectId: true, archivedAt: true } });
    if (!program || program.projectId !== projectId || program.archivedAt) throw new DomainError("INVALID_CODE", "프로그램을 확인해 주세요.");
  }
  if (data.requirementId) {
    const req = await prisma.requirement.findUnique({ where: { id: data.requirementId }, select: { projectId: true, archivedAt: true } });
    if (!req || req.projectId !== projectId || req.archivedAt) throw new DomainError("INVALID_CODE", "요구사항을 확인해 주세요.");
  }
}

export async function createUtScenario(actor: UtActor, input: unknown) {
  const data = scenarioInputSchema.parse(input);
  await assertNotLocked(actor.projectId);
  const leaves = await listUtWbsLeaves(actor.projectId);
  const wbs = leaves.find((w) => w.id === data.wbsItemId);
  if (!wbs) throw new DomainError("INVALID_CODE", "같은 프로젝트의 보관되지 않은 최하위(Leaf) WBS만 선택할 수 있습니다.");
  await assertScenarioRefs(actor.projectId, data);
  if (data.plUserId === actor.userId) throw new DomainError("FORBIDDEN", "작성자 본인을 PL 확인자로 지정할 수 없습니다.");
  const created = await getPrisma().$transaction(async (tx) => {
    const seq = await nextSequence(tx, `scenario:${data.wbsItemId}`);
    return tx.utScenario.create({ data: { ...data, projectId: actor.projectId, displayId: scenarioDisplayId(wbs.displayId, seq), seq, writerId: actor.userId, createdBy: actor.userId } });
  });
  await writeAuditLog(actor.projectId, actor.userId, "UT_SCENARIO_INSERT", "ut_scenarios", created.id, null, { displayId: created.displayId, wbsItemId: data.wbsItemId });
  return { id: created.id, displayId: created.displayId };
}

async function loadEditableScenario(actor: UtActor, scenarioId: string) {
  const s = await getPrisma().utScenario.findUnique({ where: { id: scenarioId } });
  if (!s || s.projectId !== actor.projectId || s.archivedAt) throw new DomainError("NOT_FOUND", "시나리오를 찾을 수 없습니다.");
  if (s.writerId !== actor.userId && !isUtManager(actor)) throw new DomainError("FORBIDDEN", "작성자 또는 PM/PMO만 수정할 수 있습니다.");
  await rule(() => nextScenarioStatus(s.status, "EDIT"));
  await assertNotLocked(actor.projectId);
  return s;
}

export async function updateUtScenario(actor: UtActor, scenarioId: string, input: unknown) {
  const data = scenarioUpdateSchema.parse(input);
  const before = await loadEditableScenario(actor, scenarioId);
  await assertScenarioRefs(actor.projectId, data);
  if (data.plUserId && data.plUserId === before.writerId) throw new DomainError("FORBIDDEN", "작성자 본인을 PL 확인자로 지정할 수 없습니다.");
  const { version, ...rest } = data;
  const result = await getPrisma().utScenario.updateMany({ where: { id: scenarioId, version }, data: { ...rest, updatedBy: actor.userId, version: { increment: 1 } } });
  if (!result.count) versionConflict();
  await writeAuditLog(actor.projectId, actor.userId, "UT_SCENARIO_UPDATE", "ut_scenarios", scenarioId, { name: before.name, groupId: before.groupId, plUserId: before.plUserId }, rest);
  return { ok: true };
}

/** PL 변경은 PM/PMO만(4.4) — 상태와 관계없이 미처리 건에 적용, 이미 PL 승인된 차수는 그대로. */
export async function reassignUtScenarioPl(actor: UtActor, scenarioId: string, input: unknown) {
  const { plUserId } = z.object({ plUserId: z.string().uuid() }).parse(input);
  if (!isUtManager(actor)) throw new DomainError("FORBIDDEN", "PL 변경은 PM/PMO만 할 수 있습니다.");
  const s = await getPrisma().utScenario.findUnique({ where: { id: scenarioId } });
  if (!s || s.projectId !== actor.projectId || s.archivedAt) throw new DomainError("NOT_FOUND", "시나리오를 찾을 수 없습니다.");
  await assertActiveMember(actor.projectId, plUserId, "PL 확인자");
  if (plUserId === s.writerId) throw new DomainError("FORBIDDEN", "작성자 본인을 PL 확인자로 지정할 수 없습니다.");
  const executors = await getPrisma().utCase.findMany({ where: { scenarioId, isActive: true }, select: { executorId: true, qcUserId: true } });
  for (const c of executors) await rule(() => assertSeparation({ executorId: c.executorId, qcUserId: c.qcUserId, plUserId }));
  await getPrisma().utScenario.update({ where: { id: scenarioId }, data: { plUserId, updatedBy: actor.userId, version: { increment: 1 } } });
  await writeAuditLog(actor.projectId, actor.userId, "UT_SCENARIO_PL_REASSIGN", "ut_scenarios", scenarioId, { plUserId: s.plUserId }, { plUserId });
  return { ok: true };
}

export async function archiveUtScenario(actor: UtActor, scenarioId: string) {
  const s = await loadEditableScenario(actor, scenarioId);
  const executed = await getPrisma().utExecution.count({ where: { case: { scenarioId } } });
  if (executed) throw new DomainError("INVALID_STATE", "수행 이력이 있는 시나리오는 보관할 수 없습니다.");
  await getPrisma().utScenario.update({ where: { id: scenarioId }, data: { archivedAt: new Date(), updatedBy: actor.userId } });
  await writeAuditLog(actor.projectId, actor.userId, "UT_SCENARIO_ARCHIVE", "ut_scenarios", scenarioId, { displayId: s.displayId }, null);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 케이스
// ---------------------------------------------------------------------------

async function assertCaseRefs(projectId: string, plUserId: string | null, data: { executorId: string | null; qcUserId: string | null }) {
  await assertActiveMember(projectId, data.executorId, "수행 담당자");
  await assertActiveMember(projectId, data.qcUserId, "QC 확인자");
  await rule(() => assertSeparation({ executorId: data.executorId, qcUserId: data.qcUserId, plUserId }));
}

export async function createUtCase(actor: UtActor, scenarioId: string, input: unknown) {
  const data = caseInputSchema.parse(input);
  const s = await loadEditableScenario(actor, scenarioId);
  await assertCaseRefs(actor.projectId, s.plUserId, data);
  const created = await getPrisma().$transaction(async (tx) => {
    const seq = await nextSequence(tx, `case:${scenarioId}`);
    return tx.utCase.create({ data: { ...data, plannedDate: toDate(data.plannedDate), projectId: s.projectId, scenarioId, wbsItemId: s.wbsItemId, displayId: caseDisplayId(s.displayId, seq), seq, createdBy: actor.userId } });
  });
  await writeAuditLog(actor.projectId, actor.userId, "UT_CASE_INSERT", "ut_cases", created.id, null, { displayId: created.displayId });
  return { id: created.id, displayId: created.displayId };
}

async function loadEditableCase(actor: UtActor, caseId: string) {
  const c = await getPrisma().utCase.findUnique({ where: { id: caseId }, select: { id: true, scenarioId: true, projectId: true, displayId: true, isActive: true } });
  if (!c || c.projectId !== actor.projectId) throw new DomainError("NOT_FOUND", "케이스를 찾을 수 없습니다.");
  const s = await loadEditableScenario(actor, c.scenarioId);
  return { c, s };
}

export async function updateUtCase(actor: UtActor, caseId: string, input: unknown) {
  const data = caseUpdateSchema.parse(input);
  const { s } = await loadEditableCase(actor, caseId);
  await assertCaseRefs(actor.projectId, s.plUserId, data);
  const { version, plannedDate, ...rest } = data;
  const result = await getPrisma().utCase.updateMany({ where: { id: caseId, version }, data: { ...rest, plannedDate: toDate(plannedDate), status: "DRAFT", updatedBy: actor.userId, version: { increment: 1 } } });
  if (!result.count) versionConflict();
  await writeAuditLog(actor.projectId, actor.userId, "UT_CASE_UPDATE", "ut_cases", caseId, null, { version: version + 1 });
  return { ok: true };
}

export async function setUtCaseActive(actor: UtActor, caseId: string, isActive: boolean) {
  const { c } = await loadEditableCase(actor, caseId);
  await getPrisma().utCase.update({ where: { id: caseId }, data: { isActive, updatedBy: actor.userId, version: { increment: 1 } } });
  await writeAuditLog(actor.projectId, actor.userId, isActive ? "UT_CASE_ACTIVATE" : "UT_CASE_DEACTIVATE", "ut_cases", caseId, { isActive: c.isActive }, { isActive });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 검토요청 → PL 승인/반려
// ---------------------------------------------------------------------------

export async function requestUtScenarioReview(actor: UtActor, scenarioId: string) {
  const s = await loadEditableScenario(actor, scenarioId);
  if (!s.plUserId) throw new DomainError("INVALID_STATE", "PL 확인자를 지정한 뒤 검토요청할 수 있습니다.");
  const cases = await getPrisma().utCase.findMany({ where: { scenarioId, isActive: true } });
  if (!cases.length) throw new DomainError("INVALID_STATE", "케이스를 1건 이상 등록해야 합니다.");
  const missing = cases.map((c) => ({ id: c.displayId, fields: missingCaseFields({ ...c, plannedDate: dateOnly(c.plannedDate) }) })).filter((m) => m.fields.length);
  if (missing.length) throw new DomainError("INVALID_STATE", `필수 항목이 비어 있습니다: ${missing.map((m) => `${m.id}(${m.fields.join(", ")})`).join(" / ")}`);
  const next = await rule(() => nextScenarioStatus(s.status, "REQUEST"));
  await getPrisma().$transaction([
    getPrisma().utScenario.update({ where: { id: scenarioId }, data: { status: next, reviewRequestedAt: new Date(), rejectReason: "", updatedBy: actor.userId, version: { increment: 1 } } }),
    getPrisma().utCase.updateMany({ where: { scenarioId, isActive: true }, data: { status: "REVIEW_REQUESTED" } }),
  ]);
  await writeAuditLog(actor.projectId, actor.userId, "UT_SCENARIO_REVIEW_REQUEST", "ut_scenarios", scenarioId, { status: s.status }, { status: next });
  return { ok: true };
}

export async function decideUtScenarioReview(actor: UtActor, scenarioId: string, input: unknown) {
  const data = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), reason: z.string().trim().max(1000).default("") }).parse(input);
  const s = await getPrisma().utScenario.findUnique({ where: { id: scenarioId } });
  if (!s || s.projectId !== actor.projectId || s.archivedAt) throw new DomainError("NOT_FOUND", "시나리오를 찾을 수 없습니다.");
  if (s.plUserId !== actor.userId) throw new DomainError("FORBIDDEN", "지정된 PL만 검토할 수 있습니다.");
  if (s.writerId === actor.userId) throw new DomainError("FORBIDDEN", "작성자는 자기 시나리오를 승인할 수 없습니다.");
  if (data.decision === "REJECTED" && !data.reason) throw new DomainError("INVALID_STATE", "반려 사유를 입력해 주세요.");
  await assertNotLocked(actor.projectId);
  const next = await rule(() => nextScenarioStatus(s.status, data.decision === "APPROVED" ? "APPROVE" : "REJECT"));
  const approved = next === "APPROVED";
  await getPrisma().$transaction([
    getPrisma().utScenario.update({ where: { id: scenarioId }, data: approved ? { status: next, approvedAt: new Date(), approvedBy: actor.userId, version: { increment: 1 } } : { status: next, rejectReason: data.reason, version: { increment: 1 } } }),
    getPrisma().utCase.updateMany({ where: { scenarioId, isActive: true, status: "REVIEW_REQUESTED" }, data: { status: approved ? "APPROVED" : "DRAFT" } }),
  ]);
  await writeAuditLog(actor.projectId, actor.userId, approved ? "UT_SCENARIO_APPROVE" : "UT_SCENARIO_REJECT", "ut_scenarios", scenarioId, { status: s.status }, { status: next, reason: data.reason || undefined });
  return { ok: true };
}

/** 검토함 — 내가 PL이고 검토요청 상태인 시나리오. */
export async function listUtReviewInbox(projectIds: string[], userId: string) {
  const rows = await getPrisma().utScenario.findMany({ where: { projectId: { in: projectIds }, archivedAt: null, status: "REVIEW_REQUESTED", plUserId: userId }, include: { wbsItem: { select: { displayId: true, name: true } }, writer: { select: { name: true } }, _count: { select: { cases: { where: { isActive: true } } } } }, orderBy: { reviewRequestedAt: "asc" } });
  return rows.map((s) => ({ id: s.id, displayId: s.displayId, name: s.name, wbsDisplayId: s.wbsItem.displayId, wbsName: s.wbsItem.name, writerName: s.writer.name, caseCount: s._count.cases, requestedAt: s.reviewRequestedAt?.toISOString() ?? null }));
}
