import "server-only";

import { z } from "zod";
import { revalidateTag } from "next/cache";
import { unstable_cache } from "next/cache";
import { actualProgress, childPath, codeFromPath, isSameOrDescendantPath, levelOf, nextSegment, plannedProgress, progressIndex, rebasePath, rollupProgress, workingDays } from "@/lib/domain/wbs";
import { getPrisma, actorNameOf, writeAuditLog } from "@/lib/server/db-pg";
import { assertWorkModuleGroup } from "@/lib/server/items";
import { assertManager } from "@/lib/server/permissions";
import { DomainError } from "@/lib/server/errors";
import { wbsTag } from "@/lib/server/cache-tags";
import type { Prisma } from "@/lib/generated/prisma/client";

export { DomainError };

const optionalDate = z.union([z.string().date(), z.literal(""), z.null()]).optional().transform((v) => (v ? v : null));
const baseWbsItemSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000).default(""),
  ownerUserId: z.string().uuid().nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
  startDate: optionalDate,
  dueDate: optionalDate,
  status: z.enum(["not_started", "in_progress", "completed", "on_hold"]).default("not_started"),
  configStatus: z.string().trim().max(200).default(""),
  weight: z.number().min(0).max(999_999.99).nullable().optional(),
});
export const createWbsItemSchema = baseWbsItemSchema;
export const updateWbsItemSchema = baseWbsItemSchema.extend({ version: z.number().int().positive() });
export const archiveWbsItemSchema = z.object({ version: z.number().int().positive() });
export const updateWbsAssignmentsSchema = z.object({
  version: z.number().int().positive(),
  assignments: z.array(z.object({ groupId: z.string().uuid(), progressPercent: z.number().int().min(0).max(100) })).max(50),
});
export const updateWbsDeliverableSchema = z.object({
  version: z.number().int().positive(),
  note: z.string().trim().max(5000).default(""),
  isOfficial: z.boolean().default(false),
  fileUrl: z.string().trim().max(1000).default(""),
  templateUrl: z.string().trim().max(1000).default(""),
  reviewerUserId: z.string().uuid().nullable().optional(),
  reviewedAt: optionalDate,
});

export type WbsItemRow = {
  id: string; displayId: string; projectId: string; parentId: string | null; path: string; level: number; code: string; stage: string | null;
  name: string; description: string; configStatus: string;
  ownerUserId: string | null; ownerName: string | null;
  groupId: string | null; groupLabel: string | null; groupCode: string | null;
  startDate: string | null; dueDate: string | null;
  status: "not_started" | "in_progress" | "completed" | "on_hold";
  weight: number | null;
  workingDays: number | null; plannedProgress: number | null; actualProgress: number; progressIndex: number | null;
  createdAt: string; updatedAt: string; version: number;
};
export type WbsItemEventRow = { id: string; eventType: string; actorName: string; body: string | null; beforeData: Record<string, unknown> | null; afterData: Record<string, unknown> | null; createdAt: string };
export type WbsAssignmentRow = { groupId: string; groupLabel: string; groupCode: string; hasPermission: boolean; progressPercent: number };
export type WbsDeliverableRow = { note: string; isOfficial: boolean; fileUrl: string; templateUrl: string; reviewerUserId: string | null; reviewerName: string | null; reviewedAt: string | null; updatedAt: string | null };

// 엑셀 Y1~AH1(진척등록권한) / AI1~AR1(진도율) 원본 10개 역할 헤더 — 순서·이름 그대로.
export const WBS_EXCEL_ROLE_NAMES = ["PMO/IM", "PM", "업무공통", "BO 기획", "FO 기획", "디자인", "퍼블리싱", "개발", "시스템(TECH)", "테스터"] as const;
export type WbsRoleColumn = { role: string; hasPermission: boolean; progressPercent: number };

// 엑셀 원본 A~AU 47개 컬럼과 순서·이름 — 목록 화면과 엑셀 다운로드/업로드가 이 하나만 공유한다.
export const WBS_EXCEL_HEADERS = [
  "wbs_level", "sort", "Project No.", "Confing Status", "Stage", "Task", "Task Description", "TRACK",
  "상세진도(진도관리대상-4레벨)", "R&R(실행)", "R&R(지원)(모듈)", "StartDate", "DueDate", "Deliverables(이슈 및 사유)",
  "공식여부(입력불필요)", "파일위치(입력불필요)", "트랜젝션코드(정렬SEQ)", "산출물템플릿(입력불필요)", "검수자(입력불필요)", "검수실행일(입력불필요)",
  "계산 가중치(입력불필요)", "가중치(입력불필요)", "Sort(Working Day)", "세부진도(입력불필요)",
  ...WBS_EXCEL_ROLE_NAMES.map((role) => `${role}(진척등록권한)`),
  ...WBS_EXCEL_ROLE_NAMES.map((role) => `${role}(진도율)`),
  "목표(today)", "실적", "진척율",
] as const;
// 엑셀 47개 컬럼(A~AU)을 원본 순서·이름 그대로 담은 로우 — 목록 화면 전체 컬럼 보기 전용.
export type WbsExcelRow = WbsItemRow & {
  projectCode: string; sequenceNo: string; isLeaf: boolean;
  deliverable: WbsDeliverableRow | null;
  roles: WbsRoleColumn[];
};

const wbsItemInclude = { owner: true, group: true, assignments: { include: { group: true } }, deliverable: { include: { reviewer: true } } } as const;
type WbsItemWithRelations = Prisma.WbsItemGetPayload<{ include: typeof wbsItemInclude }>;

const dateStr = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

async function loadHolidaySet(projectId: string): Promise<Set<string>> {
  const rows = await getPrisma().holiday.findMany({ where: { OR: [{ projectId }, { projectId: null }] } });
  return new Set(rows.map((row) => dateStr(row.date)!));
}

function toRow(row: WbsItemWithRelations, holidays: Set<string>, today: Date, stage: string | null): WbsItemRow {
  const start = row.startDate, due = row.dueDate;
  const actual = actualProgress(row.assignments.map((a) => a.progressPercent));
  const planned = start && due ? plannedProgress(today, start, due) : null;
  return {
    id: row.id, displayId: row.displayId, projectId: row.projectId, parentId: row.parentId, path: row.path, level: row.level, code: codeFromPath(row.path), stage,
    name: row.name, description: row.description, configStatus: row.configStatus,
    ownerUserId: row.ownerUserId, ownerName: row.owner?.name ?? (row.ownerNameRaw || null),
    groupId: row.groupId, groupLabel: row.group?.label ?? null, groupCode: row.group?.code ?? null,
    startDate: dateStr(start), dueDate: dateStr(due),
    status: row.status, weight: row.weight ? Number(row.weight) : null,
    workingDays: start && due ? workingDays(start, due, holidays) : null,
    plannedProgress: planned, actualProgress: actual, progressIndex: planned !== null ? progressIndex(actual, planned) : null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), version: row.version,
  } satisfies WbsItemRow;
}

function toDeliverableRow(deliverable: WbsItemWithRelations["deliverable"]): WbsDeliverableRow | null {
  return deliverable ? {
    note: deliverable.note, isOfficial: deliverable.isOfficial, fileUrl: deliverable.fileUrl, templateUrl: deliverable.templateUrl,
    reviewerUserId: deliverable.reviewerUserId, reviewerName: deliverable.reviewer?.name ?? null, reviewedAt: dateStr(deliverable.reviewedAt), updatedAt: deliverable.updatedAt.toISOString(),
  } satisfies WbsDeliverableRow : null;
}

// 프로젝트 전체 WBS 트리 — path 오름차순이 곧 전위 순회 순서라 그대로 정렬해 반환한다.
export async function listWbsItems(projectId: string): Promise<WbsItemRow[]> {
  const [rows, holidays] = await Promise.all([
    getPrisma().wbsItem.findMany({ where: { projectId, archivedAt: null }, include: wbsItemInclude, orderBy: { path: "asc" } }),
    loadHolidaySet(projectId),
  ]);
  // Stage(엑셀 E열) = 최상위(레벨1) 조상의 이름 — 별도 저장 없이 path의 첫 세그먼트로 즉석 조회한다.
  const nameByPath = new Map(rows.map((row) => [row.path, row.name]));
  const today = new Date();
  return rows.map((row) => toRow(row, holidays, today, nameByPath.get(row.path.split(".")[0]) ?? null));
}

export type WbsListFilters = { page?: number; pageSize?: number | "all"; q?: string; assignee?: string };

// 엑셀 원본 47개 컬럼(A~AU)을 그대로 담아 반환한다 — 목록 화면의 전체 컬럼 보기, 향후 엑셀 다운로드가 그대로 쓸 형태.
// 업무일지 목록(listWorkLogs)과 동일한 page/pageSize 페이징 규약을 쓴다. Stage·isLeaf·sequenceNo·정렬SEQ는 트리 전체 기준값이라
// 검색·페이지 단위로 잘라 계산하면 틀어지므로, 전체 행을 먼저 만든 뒤 검색 필터링→페이지 슬라이스 순으로 처리한다.
export async function listWbsItemsExcelColumns(projectId: string, filters: WbsListFilters = {}) {
  const [project, rows, holidays] = await Promise.all([
    getPrisma().project.findUnique({ where: { id: projectId }, select: { code: true } }),
    getPrisma().wbsItem.findMany({ where: { projectId, archivedAt: null }, include: wbsItemInclude, orderBy: { path: "asc" } }),
    loadHolidaySet(projectId),
  ]);
  const nameByPath = new Map(rows.map((row) => [row.path, row.name]));
  const parentIds = new Set(rows.filter((row) => row.parentId).map((row) => row.parentId!));
  const today = new Date();
  const allRows = rows.map((row, index) => {
    const roleByLabel = new Map(row.assignments.map((a) => [a.group.label, a]));
    return {
      ...toRow(row, holidays, today, nameByPath.get(row.path.split(".")[0]) ?? null),
      projectCode: project?.code ?? "", sequenceNo: String(index + 1).padStart(4, "0"), isLeaf: !parentIds.has(row.id),
      deliverable: toDeliverableRow(row.deliverable),
      roles: WBS_EXCEL_ROLE_NAMES.map((role) => {
        const assignment = roleByLabel.get(role);
        return { role, hasPermission: !!assignment, progressPercent: assignment?.progressPercent ?? 0 } satisfies WbsRoleColumn;
      }),
    } satisfies WbsExcelRow;
  });
  const q = filters.q?.trim().toLowerCase() ?? "";
  const assignee = filters.assignee?.trim().toLowerCase() ?? "";
  const filteredRows = allRows.filter((row) => {
    const matchesQ = !q || row.code.toLowerCase().includes(q) || row.name.toLowerCase().includes(q) || row.displayId.toLowerCase().includes(q);
    const matchesAssignee = !assignee || (row.ownerName ?? "").toLowerCase().includes(assignee);
    return matchesQ && matchesAssignee;
  });
  const total = filteredRows.length;
  const pageSize = filters.pageSize === "all" ? Math.max(1, total) : Math.min(100, Math.max(10, filters.pageSize ?? 20));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, filters.page ?? 1));
  return { rows: filteredRows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, totalPages };
}
export type WbsExcelListResult = Awaited<ReturnType<typeof listWbsItemsExcelColumns>>;

export type WbsStageStat = { stage: string; planned: number; actual: number; delayed: boolean };
export type WbsStats = { overall: ReturnType<typeof rollupProgress>; stages: WbsStageStat[] };

// 통계 화면 — leaf 항목(다른 항목의 상위로 참조되지 않는 행 = 엑셀 "상세진도(진도관리대상)")만 가중치(weight ?? workingDays) 기준으로 롤업한다.
async function loadWbsStats(projectId: string): Promise<WbsStats> {
  const items = await listWbsItems(projectId);
  const parentIds = new Set(items.filter((item) => item.parentId).map((item) => item.parentId!));
  const leaves = items.filter((item) => !parentIds.has(item.id));
  const toRollupInputs = (rows: typeof leaves) => rows.map((item) => ({ weight: item.weight || item.workingDays || 0, planned: item.plannedProgress ?? 0, actual: item.actualProgress }));
  const overall = rollupProgress(toRollupInputs(leaves));
  const stageNames = [...new Set(leaves.map((item) => item.stage).filter((stage): stage is string => !!stage))];
  const stages = stageNames
    .map((stage) => {
      const rollup = rollupProgress(toRollupInputs(leaves.filter((item) => item.stage === stage)));
      return { stage, planned: rollup.planned, actual: rollup.actual, delayed: rollup.actual < rollup.planned };
    })
    .sort((a, b) => a.stage.localeCompare(b.stage, "ko"));
  return { overall, stages };
}

// 변동 빈도가 낮은 통계 화면이라 포트폴리오 KPI와 동일하게 30초 캐시하고, WBS 변경(mutation) 시 wbsTag로 무효화한다.
export function getWbsStats(projectId: string) {
  return unstable_cache(loadWbsStats, ["wbs-stats"], { tags: [wbsTag(projectId)], revalidate: 30 })(projectId);
}

export async function getWbsItemDetail(projectId: string, id: string) {
  const prisma = getPrisma();
  const item = await prisma.wbsItem.findUnique({ where: { id }, include: wbsItemInclude });
  if (!item || item.projectId !== projectId || item.archivedAt) return null;
  const rootPath = item.path.split(".")[0];
  const [events, parent, children, stageItem, groups, holidays] = await Promise.all([
    prisma.wbsItemEvent.findMany({ where: { wbsItemId: id }, orderBy: { createdAt: "desc" } }),
    item.parentId ? prisma.wbsItem.findUnique({ where: { id: item.parentId } }) : Promise.resolve(null),
    prisma.wbsItem.findMany({ where: { projectId, parentId: id, archivedAt: null }, orderBy: { path: "asc" } }),
    rootPath === item.path ? Promise.resolve(item) : prisma.wbsItem.findFirst({ where: { projectId, path: rootPath } }),
    prisma.groups.findMany({ where: { projectId, groupType: "WORK_MODULE", isActive: true }, orderBy: { sortOrder: "asc" } }),
    loadHolidaySet(projectId),
  ]);
  const assignmentByGroup = new Map(item.assignments.map((a) => [a.groupId, a]));
  return {
    item: toRow(item, holidays, new Date(), stageItem?.name ?? null),
    parent: parent ? { id: parent.id, code: codeFromPath(parent.path), name: parent.name } : null,
    children: children.map((child) => ({ id: child.id, code: codeFromPath(child.path), name: child.name, status: child.status })),
    assignments: groups.map((group) => {
      const existing = assignmentByGroup.get(group.id);
      return { groupId: group.id, groupLabel: group.label, groupCode: group.code, hasPermission: !!existing, progressPercent: existing?.progressPercent ?? 0 } satisfies WbsAssignmentRow;
    }),
    deliverable: toDeliverableRow(item.deliverable),
    events: events.map((event) => ({
      id: event.id, eventType: event.eventType, actorName: event.actorName ?? "-", body: event.body,
      beforeData: event.beforeData as Record<string, unknown> | null, afterData: event.afterData as Record<string, unknown> | null,
      createdAt: event.createdAt.toISOString(),
    } satisfies WbsItemEventRow)),
  };
}
export type WbsItemDetail = Awaited<ReturnType<typeof getWbsItemDetail>>;

function mutationError(item: { archivedAt: Date | null; version: number } | null, version: number) {
  if (!item || item.archivedAt) throw new DomainError("NOT_FOUND", "WBS 항목을 찾을 수 없습니다.");
  if (item.version !== version) throw new DomainError("VERSION_CONFLICT", "다른 사용자가 먼저 수정했습니다. 최신 내용을 다시 확인해 주세요.");
}

async function assertOwner(projectId: string, userId: string | null | undefined) {
  if (!userId) return;
  const member = await getPrisma().projectMember.findFirst({ where: { projectId, userId, isActive: true, user: { status: "ACTIVE" } } });
  if (!member) throw new DomainError("INVALID_CODE", "선택한 담당자가 유효하지 않습니다.");
}

export async function createWbsItem(projectId: string, userId: string, input: unknown) {
  const data = createWbsItemSchema.parse(input), requestId = crypto.randomUUID();
  await Promise.all([
    data.groupId ? assertWorkModuleGroup(projectId, data.groupId) : Promise.resolve(),
    assertOwner(projectId, data.ownerUserId),
  ]);
  const prisma = getPrisma();
  const actorName = await actorNameOf(userId);
  const { item, displayId } = await prisma.$transaction(async (tx) => {
    const parent = data.parentId ? await tx.wbsItem.findUnique({ where: { id: data.parentId } }) : null;
    if (data.parentId && (!parent || parent.projectId !== projectId || parent.archivedAt)) throw new DomainError("NOT_FOUND", "상위 항목을 찾을 수 없습니다.");
    const siblings = await tx.wbsItem.findMany({ where: { projectId, parentId: data.parentId ?? null }, select: { path: true } });
    const path = childPath(parent?.path ?? null, nextSegment(siblings.map((s) => s.path)));
    const level = levelOf(path);
    const sequence = await tx.wbsItemSequence.upsert({ where: { projectId }, create: { projectId, value: 1 }, update: { value: { increment: 1 } } });
    const displayId = `WBS-${new Date().getUTCFullYear()}-${String(sequence.value).padStart(6, "0")}`;
    const item = await tx.wbsItem.create({
      data: {
        displayId, projectId, parentId: data.parentId ?? null, path, level, name: data.name, description: data.description,
        ownerUserId: data.ownerUserId || null, groupId: data.groupId || null,
        startDate: data.startDate ? new Date(data.startDate) : null, dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: data.status, configStatus: data.configStatus, weight: data.weight ?? null, createdBy: userId,
      },
    });
    await tx.wbsItemEvent.create({ data: { wbsItemId: item.id, eventType: "created", actorId: userId, actorName, body: "신규 등록" } });
    return { item, displayId };
  });
  await writeAuditLog(projectId, userId, "WBS_ITEM_INSERT", "wbs_items", item.id, null, { id: item.id, displayId, name: data.name });
  revalidateTag(wbsTag(projectId));
  return { id: item.id, displayId, version: item.version, requestId };
}

export async function updateWbsItem(projectId: string, userId: string, id: string, input: unknown) {
  const data = updateWbsItemSchema.parse(input), requestId = crypto.randomUUID();
  await Promise.all([
    data.groupId ? assertWorkModuleGroup(projectId, data.groupId) : Promise.resolve(),
    assertOwner(projectId, data.ownerUserId),
  ]);
  const prisma = getPrisma();
  const actorName = await actorNameOf(userId);
  const { before, version, moved } = await prisma.$transaction(async (tx) => {
    const before = await tx.wbsItem.findUnique({ where: { id } });
    if (!before || before.projectId !== projectId) throw new DomainError("NOT_FOUND", "WBS 항목을 찾을 수 없습니다.");
    mutationError(before, data.version);
    const nextParentId = data.parentId ?? null;
    const moved = nextParentId !== before.parentId;

    let path = before.path, level = before.level;
    if (moved) {
      const newParent = nextParentId ? await tx.wbsItem.findUnique({ where: { id: nextParentId } }) : null;
      if (nextParentId && (!newParent || newParent.projectId !== projectId || newParent.archivedAt)) throw new DomainError("NOT_FOUND", "상위 항목을 찾을 수 없습니다.");
      if (newParent && isSameOrDescendantPath(before.path, newParent.path)) throw new DomainError("CYCLE_DETECTED", "하위 항목을 상위 항목으로 지정할 수 없습니다.");
      const siblings = await tx.wbsItem.findMany({ where: { projectId, parentId: nextParentId }, select: { path: true } });
      const newPath = childPath(newParent?.path ?? null, nextSegment(siblings.map((s) => s.path)));
      const descendants = await tx.wbsItem.findMany({ where: { projectId, path: { startsWith: `${before.path}.` } } });
      await Promise.all(descendants.map((d) => tx.wbsItem.update({
        where: { id: d.id },
        data: { path: rebasePath(before.path, newPath, d.path), level: levelOf(rebasePath(before.path, newPath, d.path)) },
      })));
      path = newPath; level = levelOf(newPath);
    }

    const version = data.version + 1;
    await tx.wbsItem.update({
      where: { id },
      data: {
        parentId: nextParentId, path, level, name: data.name, description: data.description,
        ownerUserId: data.ownerUserId || null, groupId: data.groupId || null,
        startDate: data.startDate ? new Date(data.startDate) : null, dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: data.status, configStatus: data.configStatus, weight: data.weight ?? null, version,
      },
    });
    await tx.wbsItemEvent.create({
      data: {
        wbsItemId: id, eventType: moved ? "moved" : "edited", actorId: userId, actorName, body: moved ? "상위 항목 변경 및 정보 수정" : "기본 정보 수정",
        beforeData: { name: before.name, status: before.status, parentId: before.parentId } as never,
        afterData: { name: data.name, status: data.status, parentId: nextParentId } as never,
      },
    });
    return { before, version, moved };
  });
  await writeAuditLog(projectId, userId, "WBS_ITEM_UPDATE", "wbs_items", id, before, { ...data, version, moved });
  revalidateTag(wbsTag(projectId));
  return { id, version, requestId };
}

// 삭제는 상태만 바꾼다(archivedAt) — 하위 트리가 부모 없이 남지 않도록 자손도 함께 보관 처리한다.
export async function archiveWbsItem(projectId: string, userId: string, id: string, input: unknown) {
  const data = archiveWbsItemSchema.parse(input), requestId = crypto.randomUUID();
  const prisma = getPrisma();
  const actorName = await actorNameOf(userId);
  const { version } = await prisma.$transaction(async (tx) => {
    const before = await tx.wbsItem.findUnique({ where: { id } });
    if (!before || before.projectId !== projectId) throw new DomainError("NOT_FOUND", "WBS 항목을 찾을 수 없습니다.");
    mutationError(before, data.version);
    const now = new Date();
    const version = data.version + 1;
    await tx.wbsItem.update({ where: { id }, data: { archivedAt: now, version } });
    await tx.wbsItem.updateMany({ where: { projectId, path: { startsWith: `${before.path}.` }, archivedAt: null }, data: { archivedAt: now, version: { increment: 1 } } });
    await tx.wbsItemEvent.create({ data: { wbsItemId: id, eventType: "archived", actorId: userId, actorName, body: "항목 보관(하위 항목 포함)" } });
    return { version };
  });
  await writeAuditLog(projectId, userId, "WBS_ITEM_ARCHIVE", "wbs_items", id, null, { archived: true });
  revalidateTag(wbsTag(projectId));
  return { id, version, requestId };
}

// 데이터 초기화 — archiveWbsItem과 동일한 보관 처리(복구 가능)를 프로젝트 전체 WBS 항목에 일괄 적용한다.
// 건수가 많을 수 있어 항목별 WbsItemEvent는 남기지 않고, 감사로그 1건에 처리 건수를 요약한다.
export async function resetWbsData(projectId: string, userId: string) {
  await assertManager(projectId, userId);
  const requestId = crypto.randomUUID();
  const now = new Date();
  const prisma = getPrisma();
  const result = await prisma.wbsItem.updateMany({ where: { projectId, archivedAt: null }, data: { archivedAt: now, version: { increment: 1 } } });
  await writeAuditLog(projectId, userId, "WBS_DATA_RESET", "wbs_items", projectId, null, { archivedCount: result.count });
  revalidateTag(wbsTag(projectId));
  return { archivedCount: result.count, requestId };
}

// 엑셀 Y~AH(권한) + AI~AR(진도율) — 제출된 목록을 그대로 정답으로 취급해 없는 조합은 삭제, 있는 조합은 upsert한다.
export async function updateWbsAssignments(projectId: string, userId: string, id: string, input: unknown) {
  const data = updateWbsAssignmentsSchema.parse(input), requestId = crypto.randomUUID();
  const groupIds = [...new Set(data.assignments.map((a) => a.groupId))];
  await Promise.all(groupIds.map((groupId) => assertWorkModuleGroup(projectId, groupId)));
  const prisma = getPrisma();
  const actorName = await actorNameOf(userId);
  const { version } = await prisma.$transaction(async (tx) => {
    const before = await tx.wbsItem.findUnique({ where: { id } });
    if (!before || before.projectId !== projectId) throw new DomainError("NOT_FOUND", "WBS 항목을 찾을 수 없습니다.");
    mutationError(before, data.version);
    await tx.wbsAssignment.deleteMany({ where: { wbsItemId: id, groupId: { notIn: groupIds.length ? groupIds : ["-"] } } });
    await Promise.all(data.assignments.map((a) => tx.wbsAssignment.upsert({
      where: { wbsItemId_groupId: { wbsItemId: id, groupId: a.groupId } },
      create: { wbsItemId: id, groupId: a.groupId, progressPercent: a.progressPercent, updatedBy: userId },
      update: { progressPercent: a.progressPercent, updatedBy: userId },
    })));
    const version = data.version + 1;
    await tx.wbsItem.update({ where: { id }, data: { version } });
    await tx.wbsItemEvent.create({ data: { wbsItemId: id, eventType: "edited", actorId: userId, actorName, body: "역할별 진도 갱신" } });
    return { version };
  });
  await writeAuditLog(projectId, userId, "WBS_ASSIGNMENT_UPDATE", "wbs_assignments", id, null, { assignments: data.assignments });
  revalidateTag(wbsTag(projectId));
  return { id, version, requestId };
}

// 엑셀 N(이슈/사유), O(공식여부), P(파일위치), R(산출물템플릿), S(검수자), T(검수실행일) — 항목당 1행이라 upsert로 처리한다.
export async function updateWbsDeliverable(projectId: string, userId: string, id: string, input: unknown) {
  const data = updateWbsDeliverableSchema.parse(input), requestId = crypto.randomUUID();
  await assertOwner(projectId, data.reviewerUserId);
  const prisma = getPrisma();
  const actorName = await actorNameOf(userId);
  const { version } = await prisma.$transaction(async (tx) => {
    const before = await tx.wbsItem.findUnique({ where: { id } });
    if (!before || before.projectId !== projectId) throw new DomainError("NOT_FOUND", "WBS 항목을 찾을 수 없습니다.");
    mutationError(before, data.version);
    const fields = {
      note: data.note, isOfficial: data.isOfficial, fileUrl: data.fileUrl, templateUrl: data.templateUrl,
      reviewerUserId: data.reviewerUserId || null, reviewedAt: data.reviewedAt ? new Date(data.reviewedAt) : null,
    };
    await tx.wbsDeliverable.upsert({ where: { wbsItemId: id }, create: { wbsItemId: id, ...fields }, update: fields });
    const version = data.version + 1;
    await tx.wbsItem.update({ where: { id }, data: { version } });
    await tx.wbsItemEvent.create({ data: { wbsItemId: id, eventType: "edited", actorId: userId, actorName, body: "산출물 정보 갱신" } });
    return { version };
  });
  await writeAuditLog(projectId, userId, "WBS_DELIVERABLE_UPDATE", "wbs_deliverables", id, null, data);
  revalidateTag(wbsTag(projectId));
  return { id, version, requestId };
}
