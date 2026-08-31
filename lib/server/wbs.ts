import "server-only";

import { z } from "zod";
import { revalidateTag } from "next/cache";
import { unstable_cache } from "next/cache";
import { actualProgress, childPath, codeFromPath, isSameOrDescendantPath, levelOf, nextSegment, plannedProgress, progressIndex, rebasePath, rollupProgress, workingDays } from "@/lib/domain/wbs";
import { getPrisma, actorNameOf, writeAuditLog } from "@/lib/server/db-pg";
import { assertManager } from "@/lib/server/permissions";
import { DomainError } from "@/lib/server/errors";
import { wbsTag } from "@/lib/server/cache-tags";
import type { CommonCode } from "@/lib/server/common-codes";
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
  actualStartDate: optionalDate,
  actualDueDate: optionalDate,
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
  ownerUserId: string | null; ownerName: string | null; ownerLoginId: string | null;
  groupId: string | null; groupLabel: string | null; groupCode: string | null;
  startDate: string | null; dueDate: string | null;
  actualStartDate: string | null; actualDueDate: string | null;
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

// WBS의 R&R(지원)(모듈)·역할별 진척등록권한 Track은 다른 모듈(이슈·업무일지 등)이 공유하는 업무그룹(Groups/WORK_MODULE)이
// 아니라, 이 공통코드 그룹("WBS_WORK_GROUP") 하나만 쓴다 — 설정 → 공통코드 화면에서 WBS 전용으로 관리한다.
export const WBS_WORK_GROUP_CODE = "WBS_WORK_GROUP";

export async function listWbsWorkGroups(projectId: string): Promise<CommonCode[]> {
  const codes = await getPrisma().commonCode.findMany({ where: { projectId, group: { code: WBS_WORK_GROUP_CODE } }, include: { group: true }, orderBy: { sortOrder: "asc" } });
  return codes
    .filter((code) => code.isActive && code.group.isActive)
    .map((code) => ({ id: code.id, groupId: code.groupId, groupCode: code.groupCode, groupLabel: code.group.label, code: code.code, label: code.label, sortOrder: code.sortOrder, isActive: code.isActive, minScore: code.minScore }));
}

async function assertWbsWorkGroupCode(projectId: string, codeId: string) {
  const code = await getPrisma().commonCode.findUnique({ where: { id: codeId }, include: { group: true } });
  if (!code || code.projectId !== projectId || code.group.code !== WBS_WORK_GROUP_CODE || !code.isActive) throw new DomainError("INVALID_CODE", "선택한 Track을 사용할 수 없습니다.");
  return code;
}

// 엑셀 원본 A~AU 47개 컬럼 + 사용자ID(신규, R&R(실행) 바로 뒤) — 목록 화면과 엑셀 다운로드/업로드가 이 하나만 공유한다.
// 사용자ID는 로그인 ID를 직접 지정해 담당자를 이름 매칭보다 확실하게 지정하기 위한 컬럼이다(비어 있으면 R&R(실행) 이름으로 매칭).
export const WBS_EXCEL_HEADERS = [
  "wbs_level", "sort", "Project No.", "Confing Status", "Stage", "Task", "Task Description", "TRACK",
  "상세진도(진도관리대상-4레벨)", "R&R(실행)", "사용자ID", "R&R(지원)(모듈)", "StartDate", "DueDate", "Deliverables(이슈 및 사유)",
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
    ownerUserId: row.ownerUserId, ownerName: row.owner?.name ?? (row.ownerNameRaw || null), ownerLoginId: row.owner?.userId ?? (row.ownerLoginId || null),
    groupId: row.groupId, groupLabel: row.group?.label ?? null, groupCode: row.group?.code ?? null,
    startDate: dateStr(start), dueDate: dateStr(due),
    actualStartDate: dateStr(row.actualStartDate), actualDueDate: dateStr(row.actualDueDate),
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

export type WbsListFilters = {
  page?: number; pageSize?: number | "all"; q?: string; assignee?: string;
  startDate?: string; dueDate?: string; groupLabel?: string; leaf?: "" | "y" | "n";
  plannedMin?: number; actualMin?: number; progressMin?: number;
};

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
  const startDate = filters.startDate?.trim() ?? "";
  const dueDate = filters.dueDate?.trim() ?? "";
  const groupLabel = filters.groupLabel?.trim().toLowerCase() ?? "";
  const leaf = filters.leaf ?? "";
  const { plannedMin, actualMin, progressMin } = filters;
  const filteredRows = allRows.filter((row) => {
    const matchesQ = !q || row.code.toLowerCase().includes(q) || row.name.toLowerCase().includes(q) || row.displayId.toLowerCase().includes(q);
    const matchesAssignee = !assignee || (row.ownerName ?? "").toLowerCase().includes(assignee);
    // 시작일·종료일 필터 = 조회 구간 경계 — Task 자신의 StartDate·DueDate가 모두 그 구간 안에 있어야 매치한다(일부만 겹치는 항목은 제외).
    const matchesStartDate = !startDate || (row.startDate !== null && row.startDate >= startDate);
    const matchesDueDate = !dueDate || (row.dueDate !== null && row.dueDate <= dueDate);
    const matchesGroupLabel = !groupLabel || (row.groupLabel ?? "").toLowerCase().includes(groupLabel);
    const matchesLeaf = !leaf || (leaf === "y" ? row.isLeaf : !row.isLeaf);
    const matchesPlanned = plannedMin == null || (row.plannedProgress ?? 0) * 100 >= plannedMin;
    const matchesActual = actualMin == null || row.actualProgress * 100 >= actualMin;
    const matchesProgress = progressMin == null || (row.progressIndex ?? 0) * 100 >= progressMin;
    return matchesQ && matchesAssignee && matchesStartDate && matchesDueDate && matchesGroupLabel && matchesLeaf && matchesPlanned && matchesActual && matchesProgress;
  });
  const total = filteredRows.length;
  const pageSize = filters.pageSize === "all" ? Math.max(1, total) : Math.min(100, Math.max(10, filters.pageSize ?? 20));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, filters.page ?? 1));
  return { rows: filteredRows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, totalPages };
}
export type WbsExcelListResult = Awaited<ReturnType<typeof listWbsItemsExcelColumns>>;

// 작업자별 WBS 현황조회 — 목록 화면의 담당자명 링크(사용자ID를 키로 사용, 사용자ID 자체는 화면에 노출하지 않는다)로 진입한다.
export async function getWbsOwnerStatus(projectId: string, loginId: string) {
  const member = await getPrisma().projectMember.findFirst({ where: { projectId, isActive: true, user: { userId: loginId, status: "ACTIVE" } }, include: { user: true } });
  if (!member) return null;
  const { rows } = await listWbsItemsExcelColumns(projectId, { pageSize: "all" });
  const items = rows.filter((row) => row.ownerUserId === member.userId);
  const leaves = items.filter((row) => row.isLeaf);
  const overall = rollupProgress(leaves.map((row) => ({ weight: row.weight || row.workingDays || 0, planned: row.plannedProgress ?? 0, actual: row.actualProgress })));
  return { owner: { userId: member.userId, loginId, name: member.user.name }, overall, items };
}
export type WbsOwnerStatus = Awaited<ReturnType<typeof getWbsOwnerStatus>>;

export type WbsStageStat = { stage: string; itemCount: number; planned: number; actual: number; delayed: boolean };
export type WbsStats = { overall: ReturnType<typeof rollupProgress>; itemCount: number; delayRate: number; delayedCount: number; delayTrackedCount: number; stages: WbsStageStat[] };

// 통계 화면 — leaf 항목(다른 항목의 상위로 참조되지 않는 행 = 엑셀 "상세진도(진도관리대상)")만 가중치(weight ?? workingDays) 기준으로 롤업한다.
async function loadWbsStats(projectId: string): Promise<WbsStats> {
  const items = await listWbsItems(projectId);
  const parentIds = new Set(items.filter((item) => item.parentId).map((item) => item.parentId!));
  const leaves = items.filter((item) => !parentIds.has(item.id));
  const toRollupInputs = (rows: typeof leaves) => rows.map((item) => ({ weight: item.weight || item.workingDays || 0, planned: item.plannedProgress ?? 0, actual: item.actualProgress }));
  const overall = rollupProgress(toRollupInputs(leaves));
  // 지연율 — 시작·종료일이 있어 계획 진행률을 산출할 수 있는 leaf 항목 중 실적이 목표에 못 미치는 비율.
  const delayTracked = leaves.filter((item) => item.plannedProgress !== null);
  const delayedCount = delayTracked.filter((item) => item.actualProgress < (item.plannedProgress ?? 0)).length;
  const delayRate = delayTracked.length === 0 ? 0 : delayedCount / delayTracked.length;
  // leaves는 listWbsItems가 path 오름차순(=Task 번호 순)으로 반환한 순서를 그대로 유지하므로,
  // 이름순 재정렬 없이 처음 등장한 순서로 Stage를 중복 제거하면 Task 번호 순서가 보존된다.
  const stageNames: string[] = [];
  for (const item of leaves) if (item.stage && !stageNames.includes(item.stage)) stageNames.push(item.stage);
  const stages = stageNames.map((stage) => {
    const rows = leaves.filter((item) => item.stage === stage);
    const rollup = rollupProgress(toRollupInputs(rows));
    return { stage, itemCount: rows.length, planned: rollup.planned, actual: rollup.actual, delayed: rollup.actual < rollup.planned };
  });
  return { overall, itemCount: leaves.length, delayRate, delayedCount, delayTrackedCount: delayTracked.length, stages };
}

// 변동 빈도가 낮은 통계 화면이라 포트폴리오 KPI와 동일하게 30초 캐시하고, WBS 변경(mutation) 시 wbsTag로 무효화한다.
export function getWbsStats(projectId: string) {
  return unstable_cache(loadWbsStats, ["wbs-stats"], { tags: [wbsTag(projectId)], revalidate: 30 })(projectId);
}

// 사용자관리(설정 → 사용자)에서 사용자별로 지정한 업무그룹(Groups/WORK_MODULE)을 WBS 담당자(ownerUserId)를
// 키로 이어붙인다. WBS 항목 자체의 R&R(지원)(모듈)(WBS 전용 공통코드)과는 별개의 축이라 업무그룹별 통계·지연
// Task 조회 양쪽에서 함께 쓴다.
async function loadOwnerGroupLabels(projectId: string) {
  const members = await getPrisma().projectMember.findMany({ where: { projectId, isActive: true, user: { status: "ACTIVE" } }, include: { user: { include: { groupMemberships: { where: { group: { projectId, groupType: "WORK_MODULE" } }, include: { group: true } } } } } });
  const groupLabelByOwner = new Map<string, string>();
  const groupSortKeyByLabel = new Map<string, string>();
  for (const member of members) {
    const memberships = member.user.groupMemberships;
    const label = memberships.length ? memberships.map((m) => m.group.label).join("·") : "미지정";
    groupLabelByOwner.set(member.userId, label);
    if (memberships.length && !groupSortKeyByLabel.has(label)) {
      groupSortKeyByLabel.set(label, [...memberships].map((m) => m.group.code).sort().join("·"));
    }
  }
  return { groupLabelByOwner, groupSortKeyByLabel };
}
function ownerGroupLabelOf(item: { ownerUserId: string | null }, groupLabelByOwner: Map<string, string>) {
  return item.ownerUserId ? (groupLabelByOwner.get(item.ownerUserId) ?? "미지정") : "담당자 없음";
}

export type WbsWorkGroupStat = { groupLabel: string; memberCount: number; itemCount: number; planned: number; actual: number; delayed: boolean; delayRate: number; delayedCount: number; delayTrackedCount: number };
export type WbsWorkGroupStats = { overall: ReturnType<typeof rollupProgress>; delayRate: number; delayedCount: number; delayTrackedCount: number; groups: WbsWorkGroupStat[] };

// 업무그룹별 통계 — leaf 항목을 담당자의 업무그룹 단위로 묶어 계획·실적·지연율을 롤업한다.
async function loadWbsWorkGroupStats(projectId: string): Promise<WbsWorkGroupStats> {
  const [items, { groupLabelByOwner, groupSortKeyByLabel }] = await Promise.all([listWbsItems(projectId), loadOwnerGroupLabels(projectId)]);
  const parentIds = new Set(items.filter((item) => item.parentId).map((item) => item.parentId!));
  const leaves = items.filter((item) => !parentIds.has(item.id));
  const toRollupInputs = (rows: typeof leaves) => rows.map((item) => ({ weight: item.weight || item.workingDays || 0, planned: item.plannedProgress ?? 0, actual: item.actualProgress }));
  const delayStats = (rows: typeof leaves) => {
    const tracked = rows.filter((item) => item.plannedProgress !== null);
    const delayedCount = tracked.filter((item) => item.actualProgress < (item.plannedProgress ?? 0)).length;
    return { delayedCount, delayTrackedCount: tracked.length, delayRate: tracked.length === 0 ? 0 : delayedCount / tracked.length };
  };
  const overall = rollupProgress(toRollupInputs(leaves));
  const overallDelay = delayStats(leaves);

  const leavesByGroup = new Map<string, typeof leaves>();
  for (const item of leaves) {
    const label = ownerGroupLabelOf(item, groupLabelByOwner);
    const bucket = leavesByGroup.get(label) ?? [];
    bucket.push(item);
    leavesByGroup.set(label, bucket);
  }
  const groups = [...leavesByGroup.entries()]
    .map(([groupLabel, rows]) => {
      const rollup = rollupProgress(toRollupInputs(rows));
      const memberCount = new Set(rows.map((row) => row.ownerUserId).filter((id): id is string => !!id)).size;
      return { groupLabel, memberCount, itemCount: rows.length, planned: rollup.planned, actual: rollup.actual, delayed: rollup.actual < rollup.planned, ...delayStats(rows) };
    })
    // 업무그룹 코드(Groups.code) 기준 오름차순. 코드가 없는 "미지정"·"담당자 없음"은 맨 뒤로 보낸다.
    .sort((a, b) => {
      const codeA = groupSortKeyByLabel.get(a.groupLabel);
      const codeB = groupSortKeyByLabel.get(b.groupLabel);
      if (codeA && codeB) return codeA.localeCompare(codeB);
      if (codeA) return -1;
      if (codeB) return 1;
      return a.groupLabel.localeCompare(b.groupLabel, "ko");
    });
  return { overall, delayRate: overallDelay.delayRate, delayedCount: overallDelay.delayedCount, delayTrackedCount: overallDelay.delayTrackedCount, groups };
}

export function getWbsWorkGroupStats(projectId: string) {
  return unstable_cache(loadWbsWorkGroupStats, ["wbs-work-group-stats"], { tags: [wbsTag(projectId)], revalidate: 30 })(projectId);
}

export type WbsWeeklyGroupStat = { groupLabel: string; totalCount: number; plannedCount: number; completedCount: number; delayedCount: number; achievementRate: number; progressRate: number };
export type WbsWeeklyStats = { startDate: string; endDate: string; overall: WbsWeeklyGroupStat; groups: WbsWeeklyGroupStat[] };

// 이번 주 근무일(월요일~금요일)을 조회 기간 기본값으로 계산한다.
export function defaultWbsWeeklyRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=일 ... 6=토
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { startDate: monday.toISOString().slice(0, 10), endDate: friday.toISOString().slice(0, 10) };
}

// 주간 통계 — PMO 주간보고 "진행 사항" 표(총대상/계획/완료/지연/달성률/진척률) 형식을 업무그룹별로 재현한다.
// 완료 시점을 별도로 기록하지 않아 "과거 시점 기준 완료 건수"를 정확히 재현할 수 없으므로, 계획(건)의 조회 기간(시작일~종료일)만
// 사용자가 조정할 수 있고 완료 여부는 항상 현재 실적(actualProgress) 기준으로 판정한다 (2026-08-30 사용자 결정).
// 계획(건) = DueDate가 조회 기간(시작일~종료일) 이내인 leaf 항목, 완료(건) = 그중 실적(actualProgress)이 100%인 항목 —
// 엑셀 일괄 업로드 항목은 status가 항상 not_started로 고정 저장되어 상태값이 아니라 실제로 갱신되는 실적(Track 진도율)을
// 완료 판정 기준으로 쓴다. 달성률 = 완료/계획, 진척률 = 완료/총대상.
async function loadWbsWeeklyStats(projectId: string, startDate: string, endDate: string): Promise<WbsWeeklyStats> {
  const [items, { groupLabelByOwner, groupSortKeyByLabel }] = await Promise.all([listWbsItems(projectId), loadOwnerGroupLabels(projectId)]);
  const parentIds = new Set(items.filter((item) => item.parentId).map((item) => item.parentId!));
  const leaves = items.filter((item) => !parentIds.has(item.id));

  function buildStat(rows: typeof leaves): Omit<WbsWeeklyGroupStat, "groupLabel"> {
    const totalCount = rows.length;
    const plannedRows = rows.filter((item) => item.dueDate !== null && item.dueDate >= startDate && item.dueDate <= endDate);
    const plannedCount = plannedRows.length;
    const completedCount = plannedRows.filter((item) => item.actualProgress >= 1).length;
    const delayedCount = plannedCount - completedCount;
    return {
      totalCount, plannedCount, completedCount, delayedCount,
      achievementRate: plannedCount === 0 ? 0 : completedCount / plannedCount,
      progressRate: totalCount === 0 ? 0 : completedCount / totalCount,
    };
  }

  const leavesByGroup = new Map<string, typeof leaves>();
  for (const item of leaves) {
    const label = ownerGroupLabelOf(item, groupLabelByOwner);
    const bucket = leavesByGroup.get(label) ?? [];
    bucket.push(item);
    leavesByGroup.set(label, bucket);
  }
  const groups = [...leavesByGroup.entries()]
    .map(([groupLabel, rows]) => ({ groupLabel, ...buildStat(rows) }))
    .sort((a, b) => {
      const codeA = groupSortKeyByLabel.get(a.groupLabel);
      const codeB = groupSortKeyByLabel.get(b.groupLabel);
      if (codeA && codeB) return codeA.localeCompare(codeB);
      if (codeA) return -1;
      if (codeB) return 1;
      return a.groupLabel.localeCompare(b.groupLabel, "ko");
    });
  return { startDate, endDate, overall: { groupLabel: "전체", ...buildStat(leaves) }, groups };
}

export function getWbsWeeklyStats(projectId: string, startDate: string, endDate: string) {
  return unstable_cache(loadWbsWeeklyStats, ["wbs-weekly-stats"], { tags: [wbsTag(projectId)], revalidate: 30 })(projectId, startDate, endDate);
}

export type WbsDailyTaskCounts = { plannedTaskCount: number; actualTaskCount: number; totalTaskCount: number; completedTaskCount: number };

// PMO Daily "1. 공정현황" 신규 작성 화면 자동 채움 — leaf 항목을 기준일(asOfDate) 시점으로 집계한다.
// 계획 TASK 수 = DueDate가 기준일 이전(포함)인 leaf 항목(주간 통계의 계획(건)과 동일 기준을 기준일 하루로 적용),
// 실적 TASK 수 = 그중 실적(actualProgress)이 100%인 항목, 완료 TASK = 기준일과 무관하게 실적이 100%인 전체 leaf 항목.
export async function getWbsDailyTaskCounts(projectId: string, asOfDate: string): Promise<WbsDailyTaskCounts> {
  const items = await listWbsItems(projectId);
  const parentIds = new Set(items.filter((item) => item.parentId).map((item) => item.parentId!));
  const leaves = items.filter((item) => !parentIds.has(item.id));
  const plannedRows = leaves.filter((item) => item.dueDate !== null && item.dueDate <= asOfDate);
  return {
    plannedTaskCount: plannedRows.length,
    actualTaskCount: plannedRows.filter((item) => item.actualProgress >= 1).length,
    totalTaskCount: leaves.length,
    completedTaskCount: leaves.filter((item) => item.actualProgress >= 1).length,
  };
}

// 업무그룹별 통계 화면의 업무그룹명·지연율 클릭 진입점 — 해당 업무그룹(담당자 기준) leaf 항목을 그대로 나열한다.
// delayedOnly면 실적이 목표에 못 미치는 항목만 추린다. group을 비우면 프로젝트 전체(모든 그룹) 대상이다.
export async function getWbsGroupTasks(projectId: string, group: string, delayedOnly: boolean) {
  const [items, { groupLabelByOwner }] = await Promise.all([listWbsItems(projectId), loadOwnerGroupLabels(projectId)]);
  const parentIds = new Set(items.filter((item) => item.parentId).map((item) => item.parentId!));
  let leaves = items.filter((item) => !parentIds.has(item.id));
  if (group) leaves = leaves.filter((item) => ownerGroupLabelOf(item, groupLabelByOwner) === group);
  if (delayedOnly) leaves = leaves.filter((item) => item.plannedProgress !== null && item.actualProgress < item.plannedProgress);
  const overall = rollupProgress(leaves.map((item) => ({ weight: item.weight || item.workingDays || 0, planned: item.plannedProgress ?? 0, actual: item.actualProgress })));
  return { group, delayedOnly, overall, items: leaves };
}
export type WbsGroupTasks = Awaited<ReturnType<typeof getWbsGroupTasks>>;

export type WbsOwnerConflict = { itemId: string; code: string; name: string; ownerNameRaw: string; candidates: { userId: string; loginId: string; name: string }[] };

// 동명이인 해소 — 담당자 이름이 여러 사용자와 겹쳐 미지정으로 들어간 항목(ownerUserId null, ownerNameRaw 보존)만
// 골라, 현재 프로젝트 멤버 중 그 이름과 일치하는 후보(2명 이상)를 붙여 관리자가 선택할 수 있게 한다.
export async function listAmbiguousWbsOwners(projectId: string): Promise<WbsOwnerConflict[]> {
  const prisma = getPrisma();
  const [items, members] = await Promise.all([
    prisma.wbsItem.findMany({ where: { projectId, archivedAt: null, ownerUserId: null, ownerNameRaw: { not: "" } }, orderBy: { path: "asc" } }),
    prisma.projectMember.findMany({ where: { projectId, isActive: true, user: { status: "ACTIVE" } }, include: { user: true } }),
  ]);
  const membersByName = new Map<string, { userId: string; loginId: string; name: string }[]>();
  for (const member of members) {
    const list = membersByName.get(member.user.name) ?? [];
    list.push({ userId: member.user.id, loginId: member.user.userId, name: member.user.name });
    membersByName.set(member.user.name, list);
  }
  return items
    .map((item) => ({ itemId: item.id, code: codeFromPath(item.path), name: item.name, ownerNameRaw: item.ownerNameRaw, candidates: membersByName.get(item.ownerNameRaw) ?? [] }))
    .filter((row) => row.candidates.length > 1);
}

const resolveOwnerAmbiguitySchema = z.object({ ownerUserId: z.string().uuid() });

export async function resolveWbsOwnerAmbiguity(projectId: string, userId: string, wbsItemId: string, input: unknown) {
  const data = resolveOwnerAmbiguitySchema.parse(input), requestId = crypto.randomUUID();
  await assertOwner(projectId, data.ownerUserId);
  const prisma = getPrisma();
  const actorName = await actorNameOf(userId);
  const before = await prisma.wbsItem.findUnique({ where: { id: wbsItemId } });
  if (!before || before.projectId !== projectId) throw new DomainError("NOT_FOUND", "WBS 항목을 찾을 수 없습니다.");
  if (before.ownerUserId) throw new DomainError("INVALID_CODE", "이미 담당자가 지정된 항목입니다.");
  await prisma.wbsItem.update({ where: { id: wbsItemId }, data: { ownerUserId: data.ownerUserId, ownerNameRaw: "", version: { increment: 1 } } });
  await prisma.wbsItemEvent.create({ data: { wbsItemId, eventType: "edited", actorId: userId, actorName, body: "동명이인 담당자 선택으로 확정" } });
  await writeAuditLog(projectId, userId, "WBS_ITEM_UPDATE", "wbs_items", wbsItemId, before, { ownerUserId: data.ownerUserId });
  revalidateTag(wbsTag(projectId));
  return { id: wbsItemId, requestId };
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
    listWbsWorkGroups(projectId),
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
    data.groupId ? assertWbsWorkGroupCode(projectId, data.groupId) : Promise.resolve(),
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
        actualStartDate: data.actualStartDate ? new Date(data.actualStartDate) : null, actualDueDate: data.actualDueDate ? new Date(data.actualDueDate) : null,
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
    data.groupId ? assertWbsWorkGroupCode(projectId, data.groupId) : Promise.resolve(),
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
        actualStartDate: data.actualStartDate ? new Date(data.actualStartDate) : null, actualDueDate: data.actualDueDate ? new Date(data.actualDueDate) : null,
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
  await Promise.all(groupIds.map((groupId) => assertWbsWorkGroupCode(projectId, groupId)));
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
