import "server-only";
import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma/client";
import { actorNameOf, getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { DEFECT_GROUP, type DefectStatusClassType } from "@/lib/domain/defects";
import {
  defaultAssignee, defectPermissions, diffFields, forbiddenFields, hasFullDefectView, NO_FACTS,
  type DefectAccessFacts, type DefectActor, type DefectSubject,
} from "@/lib/domain/defect-access";
import { assertDefectCode, ensureDefectCommonCodes, getDefectCodes, nextDefectNumber } from "@/lib/server/mp/defects/common";

// ---------------------------------------------------------------------------
// 결함관리 서버(설계서 4·6장) — 등록·수정·조치자 지정·논리 삭제·조회·목록.
// 규칙 1: 단위테스트 테이블(ut_cases, ut_executions)은 읽기 전용으로만 조회하고, 결함은 소프트 참조(caseId, executionId)로 연결한다.
// 모든 쓰기는 같은 트랜잭션에서 이력(defect_histories)을 남긴다.
// ---------------------------------------------------------------------------

export type DefectActorCtx = { projectId: string; userId: string; role: string | null; jobTitle: string | null | undefined };
const asActor = (a: DefectActorCtx): DefectActor => ({ userId: a.userId, role: a.role, jobTitle: a.jobTitle });

const toDate = (value: string | null | undefined) => (value ? new Date(`${value}T00:00:00.000Z`) : null);
const dateOnly = (value: Date | null | undefined) => (value ? value.toISOString().slice(0, 10) : null);

// ---------------------------------------------------------------------------
// 조회 범위·권한 사실(읽기 전용 조회)
// ---------------------------------------------------------------------------

export async function loadAccessFacts(actor: DefectActorCtx): Promise<DefectAccessFacts> {
  if (hasFullDefectView(asActor(actor))) return NO_FACTS;
  const prisma = getPrisma();
  const [groups, cases] = await Promise.all([
    prisma.groups.findMany({ where: { projectId: actor.projectId, leaderId: actor.userId, isActive: true }, select: { id: true } }),
    // 단위테스트 케이스의 QC·PL 지정 — 읽기 전용 조회(규칙 1)
    prisma.utCase.findMany({ where: { projectId: actor.projectId, OR: [{ qcUserId: actor.userId }, { plUserId: actor.userId }] }, select: { id: true } }),
  ]);
  return { ledGroupIds: new Set(groups.map((g) => g.id)), qcPlCaseIds: new Set(cases.map((c) => c.id)) };
}

export function visibilityWhere(actor: DefectActorCtx, facts: DefectAccessFacts): Prisma.DefectWhereInput {
  if (hasFullDefectView(asActor(actor))) return {};
  const or: Prisma.DefectWhereInput[] = [{ createdBy: actor.userId }, { assigneeUserId: actor.userId }];
  if (facts.ledGroupIds.size) or.push({ groupId: { in: [...facts.ledGroupIds] } });
  if (facts.qcPlCaseIds.size) or.push({ caseId: { in: [...facts.qcPlCaseIds] } });
  return { OR: or };
}

async function activeMemberIds(projectId: string) {
  const rows = await getPrisma().projectMember.findMany({ where: { projectId, isActive: true, user: { status: "ACTIVE" } }, select: { userId: true } });
  return new Set(rows.map((r) => r.userId));
}

async function assertActiveMember(projectId: string, userId: string | null | undefined, label: string) {
  if (!userId) return;
  if (!(await activeMemberIds(projectId)).has(userId)) throw new DomainError("INVALID_CODE", `${label}는 이 프로젝트의 활성 구성원이어야 합니다.`);
}

// ---------------------------------------------------------------------------
// 연결 키 검증(읽기 전용) — 같은 프로젝트의 행만 연결한다.
// ---------------------------------------------------------------------------

type LinkInput = { caseId?: string | null; executionId?: string | null; wbsItemId?: string | null; requirementId?: string | null; groupId?: string | null };

async function resolveLinks(projectId: string, input: LinkInput) {
  const prisma = getPrisma();
  const caseId = input.caseId ?? null;
  const executionId = input.executionId ?? null;
  let wbsItemId = input.wbsItemId ?? null;
  let groupId = input.groupId ?? null;
  const requirementId = input.requirementId ?? null;
  if (caseId) {
    const c = await prisma.utCase.findFirst({ where: { id: caseId, projectId }, select: { wbsItemId: true, groupId: true } });
    if (!c) throw new DomainError("INVALID_CODE", "연결할 테스트 케이스를 찾을 수 없습니다.");
    wbsItemId ??= c.wbsItemId;
    groupId ??= c.groupId;
  }
  if (executionId) {
    if (!caseId) throw new DomainError("INVALID_CODE", "수행 차수를 연결하려면 테스트 케이스도 지정해야 합니다.");
    if (!(await prisma.utExecution.findFirst({ where: { id: executionId, caseId }, select: { id: true } }))) throw new DomainError("INVALID_CODE", "연결할 수행 차수를 찾을 수 없습니다.");
  }
  let wbsOwner: string | null = null;
  if (wbsItemId) {
    const w = await prisma.wbsItem.findFirst({ where: { id: wbsItemId, projectId }, select: { ownerUserId: true } });
    if (!w) throw new DomainError("INVALID_CODE", "연결할 WBS Task를 찾을 수 없습니다.");
    wbsOwner = w.ownerUserId ?? null;
  }
  if (requirementId && !(await prisma.requirement.findFirst({ where: { id: requirementId, projectId }, select: { id: true } }))) throw new DomainError("INVALID_CODE", "연결할 요구사항을 찾을 수 없습니다.");
  if (groupId && !(await prisma.groups.findFirst({ where: { id: groupId, projectId, isActive: true }, select: { id: true } }))) throw new DomainError("INVALID_CODE", "선택한 업무단위를 사용할 수 없습니다.");
  return { caseId, executionId, wbsItemId, requirementId, groupId, wbsOwner };
}

// ---------------------------------------------------------------------------
// 입력 검증
// ---------------------------------------------------------------------------

const optionalId = z.string().uuid().nullable().optional().transform((v) => v ?? null);
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식은 YYYY-MM-DD입니다.").nullable().optional().transform((v) => v ?? null);
const httpUrl = z.string().trim().max(1000).refine((v) => v === "" || /^https?:\/\//i.test(v), "화면 URL은 http 또는 https 주소여야 합니다.");

const editable = {
  title: z.string().trim().min(5, "제목은 5자 이상이어야 합니다.").max(255),
  stepsToRepro: z.string().max(20000),
  testStageCodeId: z.string().uuid(),
  severityCodeId: z.string().uuid(),
  priorityCodeId: optionalId,
  identificationCodeId: optionalId,
  screenPath: z.string().trim().max(500),
  menuName: z.string().trim().max(255),
  screenName: z.string().trim().max(255),
  screenUrl: httpUrl,
  envInfo: z.string().trim().max(255),
  actionComment: z.string().max(20000),
  actionDueDate: dateField,
  actionStartDate: dateField,
  actionEndDate: dateField,
};

const sourceMeta = z.object({ pageUrl: z.string().max(2000), pageTitle: z.string().max(500), userAgent: z.string().max(1000) }).partial().strict();

const createSchema = z.object({
  title: editable.title,
  stepsToRepro: editable.stepsToRepro.default(""),
  testStageCodeId: editable.testStageCodeId,
  severityCodeId: editable.severityCodeId,
  priorityCodeId: editable.priorityCodeId,
  identificationCodeId: editable.identificationCodeId,
  screenPath: editable.screenPath.default(""),
  menuName: editable.menuName.default(""),
  screenName: editable.screenName.default(""),
  screenUrl: editable.screenUrl.default(""),
  envInfo: editable.envInfo.default(""),
  actionComment: editable.actionComment.default(""),
  actionDueDate: editable.actionDueDate,
  actionStartDate: editable.actionStartDate,
  actionEndDate: editable.actionEndDate,
  groupId: optionalId, wbsItemId: optionalId, caseId: optionalId, executionId: optionalId, requirementId: optionalId,
  assigneeUserId: optionalId,
  sourceType: z.enum(["MANUAL", "ENTRY", "WIDGET", "EXTENSION"]).default("MANUAL"),
  sourceMeta: sourceMeta.optional(),
});

const updateSchema = z.object({
  title: editable.title, stepsToRepro: editable.stepsToRepro, testStageCodeId: editable.testStageCodeId, severityCodeId: editable.severityCodeId,
  priorityCodeId: editable.priorityCodeId, identificationCodeId: editable.identificationCodeId, screenPath: editable.screenPath, menuName: editable.menuName,
  screenName: editable.screenName, screenUrl: editable.screenUrl, envInfo: editable.envInfo, actionComment: editable.actionComment,
  actionDueDate: editable.actionDueDate, actionStartDate: editable.actionStartDate, actionEndDate: editable.actionEndDate,
  statusCodeId: z.string().uuid(),
}).partial().extend({ version: z.number().int().positive() }).strict();

const FIELD_LABEL: Record<string, string> = {
  title: "제목", stepsToRepro: "재현 단계", testStageCodeId: "테스트 단계", screenPath: "화면경로", menuName: "메뉴명", screenName: "화면명", screenUrl: "화면 URL", envInfo: "환경",
  statusCodeId: "상태", identificationCodeId: "결함식별", actionComment: "조치 내용", actionDueDate: "조치 예정일", actionStartDate: "조치 시작일", actionEndDate: "조치 종료일",
  severityCodeId: "심각도", priorityCodeId: "우선순위",
};

function versionConflict(): never {
  throw new DomainError("VERSION_CONFLICT", "다른 사용자가 먼저 수정했습니다. 최신 내용을 다시 확인해 주세요.");
}

// ---------------------------------------------------------------------------
// 등록
// ---------------------------------------------------------------------------

export async function createDefect(actor: DefectActorCtx, input: unknown) {
  const data = createSchema.parse(input);
  const prisma = getPrisma();
  await ensureDefectCommonCodes(actor.projectId);
  await Promise.all([
    assertDefectCode(actor.projectId, data.testStageCodeId, DEFECT_GROUP.stage, "테스트 단계"),
    assertDefectCode(actor.projectId, data.severityCodeId, DEFECT_GROUP.severity, "심각도"),
    assertDefectCode(actor.projectId, data.priorityCodeId, DEFECT_GROUP.priority, "우선순위"),
    assertDefectCode(actor.projectId, data.identificationCodeId, DEFECT_GROUP.identification, "결함식별"),
  ]);
  const codes = await getDefectCodes(actor.projectId);
  const initialStatus = codes.statuses.find((s) => s.code === "OPEN") ?? codes.statuses.find((s) => s.statusClass === "OPEN");
  if (!initialStatus) throw new DomainError("INVALID_STATE", "사용할 수 있는 초기 상태 코드가 없습니다. 결함관리 설정에서 미조치 상태를 확인해 주세요.");

  const links = await resolveLinks(actor.projectId, data);
  const members = await activeMemberIds(actor.projectId);
  const facts = await loadAccessFacts(actor);

  // 조치자: 지정 권한자만 직접 지정할 수 있고, 그 외에는 WBS Task의 작업자가 기본값이다.
  const perms = defectPermissions(asActor(actor), { createdBy: actor.userId, assigneeUserId: null, groupId: links.groupId, caseId: links.caseId }, facts);
  let assigneeUserId = defaultAssignee(links.wbsOwner, members);
  if (data.assigneeUserId) {
    if (!perms.assign) throw new DomainError("FORBIDDEN", "조치자는 QC·PL·운영자·업무그룹리더·PMO·관리자만 지정할 수 있습니다.");
    if (!members.has(data.assigneeUserId)) throw new DomainError("INVALID_CODE", "조치자는 이 프로젝트의 활성 구성원이어야 합니다.");
    assigneeUserId = data.assigneeUserId;
  }
  // 조치 정보(결함식별·조치 내용·일정)는 담당자나 지정 권한자만 입력한다.
  const hasActionInfo = !!(data.identificationCodeId || data.actionComment || data.actionDueDate || data.actionStartDate || data.actionEndDate);
  if (hasActionInfo && !defectPermissions(asActor(actor), { createdBy: actor.userId, assigneeUserId, groupId: links.groupId, caseId: links.caseId }, facts).editAction) {
    throw new DomainError("FORBIDDEN", "조치 정보는 담당자 또는 지정 권한자만 입력할 수 있습니다.");
  }

  const actorName = (await actorNameOf(actor.userId)) ?? "";
  const created = await prisma.$transaction(async (tx) => {
    const { seq, displayId } = await nextDefectNumber(tx, actor.projectId);
    const row = await tx.defect.create({ data: {
      projectId: actor.projectId, displayId, seq, title: data.title, stepsToRepro: data.stepsToRepro,
      testStageCodeId: data.testStageCodeId, severityCodeId: data.severityCodeId, priorityCodeId: data.priorityCodeId, statusCodeId: initialStatus.id, identificationCodeId: data.identificationCodeId,
      screenPath: data.screenPath, menuName: data.menuName, screenName: data.screenName, screenUrl: data.screenUrl, envInfo: data.envInfo,
      groupId: links.groupId, wbsItemId: links.wbsItemId, caseId: links.caseId, executionId: links.executionId, requirementId: links.requirementId,
      createdBy: actor.userId, assigneeUserId,
      actionComment: data.actionComment, actionDueDate: toDate(data.actionDueDate), actionStartDate: toDate(data.actionStartDate), actionEndDate: toDate(data.actionEndDate),
      sourceType: data.sourceType, sourceMeta: data.sourceMeta ?? undefined,
    } });
    await tx.defectHistory.create({ data: {
      defectId: row.id, action: "CREATE", statusAfterCodeId: initialStatus.id, actorId: actor.userId, actorName,
      changedData: { title: { before: null, after: data.title }, assigneeUserId: { before: null, after: assigneeUserId }, sourceType: { before: null, after: data.sourceType } },
    } });
    return row;
  });
  await writeAuditLog(actor.projectId, actor.userId, "DEFECT_INSERT", "defects", created.id, null, { displayId: created.displayId, caseId: created.caseId, wbsItemId: created.wbsItemId });
  return { id: created.id, displayId: created.displayId };
}

// ---------------------------------------------------------------------------
// 불러오기(권한 확인) — 볼 수 없는 결함은 존재 여부를 알려 주지 않고 NOT_FOUND로 처리한다.
// ---------------------------------------------------------------------------

async function loadVisible(actor: DefectActorCtx, id: string) {
  const row = await getPrisma().defect.findFirst({ where: { id, projectId: actor.projectId, isActive: true } });
  if (!row) throw new DomainError("NOT_FOUND", "결함을 찾을 수 없습니다.");
  const facts = await loadAccessFacts(actor);
  const perms = defectPermissions(asActor(actor), { createdBy: row.createdBy, assigneeUserId: row.assigneeUserId, groupId: row.groupId, caseId: row.caseId }, facts);
  if (!perms.view) throw new DomainError("NOT_FOUND", "결함을 찾을 수 없습니다.");
  return { row, perms };
}

// ---------------------------------------------------------------------------
// 수정 — 필드별 권한 검사, 낙관적 락, 이력(상태가 바뀌면 STATUS)
// ---------------------------------------------------------------------------

export async function updateDefect(actor: DefectActorCtx, id: string, input: unknown) {
  const { version, ...patch } = updateSchema.parse(input);
  const { row, perms } = await loadVisible(actor, id);
  const before = row as unknown as Record<string, string | number | boolean | Date | null>;
  const fields = Object.keys(patch);
  const diff = diffFields(before, patch as Record<string, string | null>, fields);
  const changed = Object.keys(diff);
  if (changed.length === 0) return { ok: true, changed: false };

  const denied = forbiddenFields(changed, perms);
  if (denied.length) throw new DomainError("FORBIDDEN", `다음 항목을 변경할 권한이 없습니다: ${denied.map((f) => FIELD_LABEL[f] ?? f).join(", ")}`);

  await Promise.all([
    "testStageCodeId" in diff ? assertDefectCode(actor.projectId, patch.testStageCodeId, DEFECT_GROUP.stage, "테스트 단계") : undefined,
    "severityCodeId" in diff ? assertDefectCode(actor.projectId, patch.severityCodeId, DEFECT_GROUP.severity, "심각도") : undefined,
    "priorityCodeId" in diff ? assertDefectCode(actor.projectId, patch.priorityCodeId, DEFECT_GROUP.priority, "우선순위") : undefined,
    "identificationCodeId" in diff ? assertDefectCode(actor.projectId, patch.identificationCodeId, DEFECT_GROUP.identification, "결함식별") : undefined,
    "statusCodeId" in diff ? assertDefectCode(actor.projectId, patch.statusCodeId, DEFECT_GROUP.status, "상태") : undefined,
  ]);

  const { actionDueDate, actionStartDate, actionEndDate, ...rest } = patch;
  const data: Prisma.DefectUncheckedUpdateManyInput = { ...rest, version: { increment: 1 } };
  if ("actionDueDate" in patch) data.actionDueDate = toDate(actionDueDate);
  if ("actionStartDate" in patch) data.actionStartDate = toDate(actionStartDate);
  if ("actionEndDate" in patch) data.actionEndDate = toDate(actionEndDate);

  const actorName = (await actorNameOf(actor.userId)) ?? "";
  await getPrisma().$transaction(async (tx) => {
    const result = await tx.defect.updateMany({ where: { id, version, isActive: true }, data });
    if (!result.count) versionConflict();
    await tx.defectHistory.create({ data: {
      defectId: id, action: "statusCodeId" in diff ? "STATUS" : "UPDATE", actorId: actor.userId, actorName, changedData: diff,
      statusBeforeCodeId: "statusCodeId" in diff ? row.statusCodeId : null, statusAfterCodeId: "statusCodeId" in diff ? (patch.statusCodeId ?? null) : null,
    } });
  });
  await writeAuditLog(actor.projectId, actor.userId, "DEFECT_UPDATE", "defects", id, null, { fields: changed });
  return { ok: true, changed: true };
}

// ---------------------------------------------------------------------------
// 조치자 지정·변경(지정 권한자)
// ---------------------------------------------------------------------------

export async function assignDefect(actor: DefectActorCtx, id: string, input: unknown) {
  const data = z.object({ assigneeUserId: z.string().uuid().nullable(), version: z.number().int().positive() }).strict().parse(input);
  const { row, perms } = await loadVisible(actor, id);
  if (!perms.assign) throw new DomainError("FORBIDDEN", "조치자는 QC·PL·운영자·업무그룹리더·PMO·관리자만 지정할 수 있습니다.");
  await assertActiveMember(actor.projectId, data.assigneeUserId, "조치자");
  if ((row.assigneeUserId ?? null) === data.assigneeUserId) return { ok: true, changed: false };
  const actorName = (await actorNameOf(actor.userId)) ?? "";
  await getPrisma().$transaction(async (tx) => {
    const result = await tx.defect.updateMany({ where: { id, version: data.version, isActive: true }, data: { assigneeUserId: data.assigneeUserId, version: { increment: 1 } } });
    if (!result.count) versionConflict();
    await tx.defectHistory.create({ data: { defectId: id, action: "ASSIGN", actorId: actor.userId, actorName, changedData: { assigneeUserId: { before: row.assigneeUserId, after: data.assigneeUserId } } } });
  });
  await writeAuditLog(actor.projectId, actor.userId, "DEFECT_ASSIGN", "defects", id, { assigneeUserId: row.assigneeUserId }, { assigneeUserId: data.assigneeUserId });
  return { ok: true, changed: true };
}

// ---------------------------------------------------------------------------
// 논리 삭제(관리자·슈퍼관리자) — 이력은 남는다.
// ---------------------------------------------------------------------------

export async function deleteDefect(actor: DefectActorCtx, id: string) {
  const { perms } = await loadVisible(actor, id);
  if (!perms.delete) throw new DomainError("FORBIDDEN", "결함 삭제는 관리자만 할 수 있습니다.");
  const actorName = (await actorNameOf(actor.userId)) ?? "";
  await getPrisma().$transaction(async (tx) => {
    const result = await tx.defect.updateMany({ where: { id, isActive: true }, data: { isActive: false, version: { increment: 1 } } });
    if (!result.count) throw new DomainError("NOT_FOUND", "결함을 찾을 수 없습니다.");
    await tx.defectHistory.create({ data: { defectId: id, action: "DELETE", actorId: actor.userId, actorName, changedData: { isActive: { before: true, after: false } } } });
  });
  await writeAuditLog(actor.projectId, actor.userId, "DEFECT_DELETE", "defects", id, null, null);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 조회 — 상세와 목록
// ---------------------------------------------------------------------------

const codeSelect = { select: { id: true, code: true, label: true } } as const;

export async function getDefect(actor: DefectActorCtx, id: string) {
  const { perms } = await loadVisible(actor, id);
  const d = await getPrisma().defect.findUniqueOrThrow({
    where: { id },
    include: {
      testStage: codeSelect, severity: codeSelect, priority: codeSelect, status: codeSelect, identification: codeSelect,
      group: { select: { id: true, label: true } }, creator: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true } },
      histories: { orderBy: { createdAt: "desc" }, take: 200 },
      evidences: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  const [cls, sev] = await Promise.all([
    getPrisma().defectStatusClass.findUnique({ where: { projectId_statusCodeId: { projectId: d.projectId, statusCodeId: d.statusCodeId } }, select: { statusClass: true } }),
    getPrisma().defectSeveritySetting.findUnique({ where: { projectId_severityCodeId: { projectId: d.projectId, severityCodeId: d.severityCodeId } }, select: { isMajorImpact: true } }),
  ]);
  const statusClass = (cls?.statusClass ?? "OPEN") as DefectStatusClassType;
  return {
    id: d.id, displayId: d.displayId, title: d.title, stepsToRepro: d.stepsToRepro, version: d.version,
    testStage: d.testStage, severity: d.severity, priority: d.priority, status: { ...d.status, statusClass }, identification: d.identification,
    screenPath: d.screenPath, menuName: d.menuName, screenName: d.screenName, screenUrl: d.screenUrl, envInfo: d.envInfo,
    group: d.group, wbsItemId: d.wbsItemId, caseId: d.caseId, executionId: d.executionId, requirementId: d.requirementId,
    creator: d.creator, assignee: d.assignee,
    actionComment: d.actionComment, actionDueDate: dateOnly(d.actionDueDate), actionStartDate: dateOnly(d.actionStartDate), actionEndDate: dateOnly(d.actionEndDate),
    sourceType: d.sourceType, sourceMeta: d.sourceMeta, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
    isUnresolvedMajor: statusClass === "OPEN" && !!sev?.isMajorImpact,
    permissions: perms,
    histories: d.histories.map((h) => ({ id: h.id, action: h.action, actorName: h.actorName, changedData: h.changedData, statusBeforeCodeId: h.statusBeforeCodeId, statusAfterCodeId: h.statusAfterCodeId, createdAt: h.createdAt.toISOString() })),
    evidences: d.evidences.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
  };
}

export type DefectListFilters = {
  q?: string; stageId?: string; statusId?: string; statusClass?: string; severityId?: string; priorityId?: string;
  assignee?: string; creator?: string; unassigned?: boolean; from?: string; to?: string; page?: number; pageSize?: number;
};

const listInclude = {
  testStage: { select: { label: true } }, severity: { select: { label: true } }, priority: { select: { label: true } }, status: { select: { id: true, label: true } },
  assignee: { select: { id: true, name: true } }, creator: { select: { name: true } }, group: { select: { label: true } },
} satisfies Prisma.DefectInclude;

type ListRow = Prisma.DefectGetPayload<{ include: typeof listInclude }>;

function toListRow(d: ListRow, classes: Map<string, DefectStatusClassType>) {
  return {
    id: d.id, displayId: d.displayId, title: d.title, testStage: d.testStage.label, severity: d.severity.label, priority: d.priority?.label ?? null,
    status: d.status.label, statusClass: classes.get(d.status.id) ?? ("OPEN" as DefectStatusClassType),
    assignee: d.assignee, creator: d.creator.name, group: d.group?.label ?? null, caseId: d.caseId, wbsItemId: d.wbsItemId,
    screenPath: d.screenPath, createdAt: d.createdAt.toISOString(), actionDueDate: dateOnly(d.actionDueDate),
  };
}

async function statusClassMap(projectId: string) {
  const rows = await getPrisma().defectStatusClass.findMany({ where: { projectId }, select: { statusCodeId: true, statusClass: true } });
  return new Map(rows.map((r) => [r.statusCodeId, r.statusClass as DefectStatusClassType]));
}

export async function listDefects(actor: DefectActorCtx, filters: DefectListFilters = {}) {
  const prisma = getPrisma();
  const facts = await loadAccessFacts(actor);
  const classes = await statusClassMap(actor.projectId);
  const and: Prisma.DefectWhereInput[] = [{ projectId: actor.projectId, isActive: true }, visibilityWhere(actor, facts)];
  const q = filters.q?.trim();
  if (q) and.push({ OR: [{ displayId: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] });
  if (filters.stageId) and.push({ testStageCodeId: filters.stageId });
  if (filters.statusId) and.push({ statusCodeId: filters.statusId });
  if (filters.severityId) and.push({ severityCodeId: filters.severityId });
  if (filters.priorityId) and.push({ priorityCodeId: filters.priorityId });
  if (filters.statusClass) {
    const ids = (cls: DefectStatusClassType) => [...classes].filter(([, v]) => v === cls).map(([k]) => k);
    if (filters.statusClass === "OPEN") and.push({ statusCodeId: { notIn: [...ids("DONE"), ...ids("CLOSED")] } }); // 분류가 없는 상태는 미조치
    else if (filters.statusClass === "DONE" || filters.statusClass === "CLOSED") and.push({ statusCodeId: { in: ids(filters.statusClass) } });
  }
  if (filters.unassigned) and.push({ assigneeUserId: null });
  else if (filters.assignee) and.push({ assigneeUserId: filters.assignee === "me" ? actor.userId : filters.assignee });
  if (filters.creator) and.push({ createdBy: filters.creator === "me" ? actor.userId : filters.creator });
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) and.push({ createdAt: { gte: new Date(`${filters.from}T00:00:00+09:00`) } });
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) and.push({ createdAt: { lt: new Date(new Date(`${filters.to}T00:00:00+09:00`).getTime() + 86_400_000) } });

  const pageSize = Math.min(200, Math.max(1, Math.trunc(filters.pageSize ?? 20)));
  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const where: Prisma.DefectWhereInput = { AND: and };
  const [rows, totalCount] = await Promise.all([
    prisma.defect.findMany({ where, include: listInclude, orderBy: [{ createdAt: "desc" }, { displayId: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.defect.count({ where }),
  ]);
  return { rows: rows.map((d) => toListRow(d, classes)), totalCount, page, pageSize };
}

/** 미배정 결함 — 내가 조치자를 지정할 수 있는 것만. */
export async function listUnassignedDefects(actor: DefectActorCtx) {
  const prisma = getPrisma();
  const facts = await loadAccessFacts(actor);
  const classes = await statusClassMap(actor.projectId);
  const rows = await prisma.defect.findMany({
    where: { AND: [{ projectId: actor.projectId, isActive: true, assigneeUserId: null }, visibilityWhere(actor, facts)] },
    include: listInclude, orderBy: [{ createdAt: "desc" }], take: 500,
  });
  const out = rows.filter((d) => defectPermissions(asActor(actor), { createdBy: d.createdBy, assigneeUserId: d.assigneeUserId, groupId: d.groupId, caseId: d.caseId } satisfies DefectSubject, facts).assign);
  return { rows: out.map((d) => toListRow(d, classes)), totalCount: out.length };
}
