import "server-only";

import { z } from "zod";
import { revalidateTag } from "next/cache";
import { ACTION_ITEM_STATUSES, canManageActionItem, type ActionItemStatus } from "@/lib/domain/action-items";
import { MANAGEMENT_TASK_AXES, actionItemAxisBand, bandToAxisScore, scoreBand, totalScore, type ManagementTaskAxisScores, type ManagementTaskBand } from "@/lib/domain/management-tasks";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { getMemberRole, isManagerRole } from "@/lib/server/permissions";
import { hasPmPmoAccess } from "@/lib/domain/job-access";
import { assertWorkModuleGroup } from "@/lib/server/items";
import { resolveWbsItemByDisplayId } from "@/lib/server/wbs";
import { listCommonCodes } from "@/lib/server/common-codes";
import { DomainError } from "@/lib/server/errors";
import { managementTaskTag } from "@/lib/server/cache-tags";
import type { Prisma } from "@/lib/generated/prisma/client";

export { DomainError };

// 액션아이템구분 선택지 — 공통코드 설정(/settings/common-codes)에서 관리자가 등록한 값을 그대로 사용한다.
export async function listActionItemCategoryOptions(projectId: string) {
  const codes = await listCommonCodes(projectId, false);
  return codes.filter((code) => code.groupCode === "action_item_category");
}

const optionalDate = z.union([z.string().date(), z.literal(""), z.null()]).optional().transform((value) => (value ? value : null));
const prioritySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
const statusSchema = z.enum(ACTION_ITEM_STATUSES.map((status) => status.value) as [ActionItemStatus, ...ActionItemStatus[]]);
const actionItemBaseSchema = z.object({
  categoryCodeId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  priority: prioritySchema,
  importance: prioritySchema,
  groupId: z.string().uuid(),
  assigneeId: z.string().uuid(),
  dueDate: optionalDate,
  status: statusSchema,
  wbsDisplayId: z.string().trim().max(100).default(""),
  note: z.string().trim().max(2000).default(""),
});
export const createActionItemSchema = actionItemBaseSchema;
export const updateActionItemSchema = actionItemBaseSchema.extend({ version: z.number().int().positive() });
export const archiveActionItemSchema = z.object({ version: z.number().int().positive() });

export type ActionItemRow = {
  id: string; detailItemId: string; sequenceNo: number;
  categoryCodeId: string | null; categoryLabel: string | null;
  name: string; priority: "HIGH" | "MEDIUM" | "LOW"; importance: "HIGH" | "MEDIUM" | "LOW";
  groupId: string; groupLabel: string;
  assigneeId: string; assigneeName: string;
  createdBy: string; createdByName: string;
  dueDate: string | null; status: ActionItemStatus;
  wbsItemId: string | null; wbsItemDisplayId: string | null;
  note: string; version: number; createdAt: string; updatedAt: string;
};
export type ManagementTaskAxisActionItems = { detailItemId: string; axisKey: string; label: string; band: ManagementTaskBand; actionItems: ActionItemRow[] };
export type ProjectActionItemFilters = { q?: string; status?: string; groupId?: string; assigneeId?: string; page?: number; pageSize?: number };
export type ProjectActionItemRow = ActionItemRow & { taskId: string; taskDisplayId: string; taskName: string; axisKey: string; axisLabel: string };

const actionItemInclude = {
  group: true,
  assignee: true,
  creator: true,
  categoryCode: true,
  wbsItem: { select: { id: true, displayId: true } },
} as const;
type ActionItemWithRelations = Prisma.ActionItemGetPayload<{ include: typeof actionItemInclude }>;

const dateStr = (value: Date) => value.toISOString().slice(0, 10);

function toActionItemRow(row: ActionItemWithRelations): ActionItemRow {
  return {
    id: row.id, detailItemId: row.detailItemId, sequenceNo: row.sequenceNo,
    categoryCodeId: row.categoryCodeId, categoryLabel: row.categoryCode?.label ?? null,
    name: row.name, priority: row.priority, importance: row.importance,
    groupId: row.groupId, groupLabel: row.group.label,
    assigneeId: row.assigneeId, assigneeName: row.assignee.name,
    createdBy: row.createdBy, createdByName: row.creator.name,
    dueDate: row.dueDate ? dateStr(row.dueDate) : null, status: row.status,
    wbsItemId: row.wbsItemId, wbsItemDisplayId: row.wbsItem?.displayId ?? null,
    note: row.note, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  } satisfies ActionItemRow;
}

// 액션아이템 등록·수정·보관 권한: 업무그룹 리더 + PM/PMO + 담당자 + 관리자 이상.
async function assertActionItemAccess(projectId: string, userId: string, jobTitle: string | null | undefined, groupLeaderId: string | null, assigneeId: string) {
  const role = await getMemberRole(projectId, userId);
  const allowed = canManageActionItem({
    viewerUserId: userId,
    assigneeId,
    groupLeaderId,
    isPmPmo: hasPmPmoAccess(jobTitle, role),
    isManager: isManagerRole(role),
  });
  if (!allowed) throw new DomainError("FORBIDDEN", "이 작업을 수행할 권한이 없습니다.");
}

async function assertActionItemCategory(projectId: string, codeId: string) {
  const code = await getPrisma().commonCode.findUnique({ where: { id: codeId } });
  if (!code || code.projectId !== projectId || code.groupCode !== "action_item_category" || !code.isActive) throw new DomainError("INVALID_CODE", "선택한 구분을 사용할 수 없습니다.");
}

// 세부항목(축)의 밴드를 액션아이템 상태 분포로 재계산하고, 그 결과를 부모 관리업무항목의 totalScore/band에 반영한다.
// 액션아이템 생성/수정/보관 트랜잭션 마지막 단계에서 항상 호출된다.
async function recomputeBandChain(tx: Prisma.TransactionClient, detailItemId: string) {
  const detail = await tx.managementTaskDetailItem.findUniqueOrThrow({ where: { id: detailItemId }, select: { taskId: true } });
  const items = await tx.actionItem.findMany({ where: { detailItemId, archivedAt: null }, select: { status: true } });
  const band = actionItemAxisBand(items.map((item) => item.status));
  await tx.managementTaskDetailItem.update({ where: { id: detailItemId }, data: { band: band.toUpperCase() as "RED" | "YELLOW" | "GREEN", axisScore: bandToAxisScore(band) } });
  const allDetails = await tx.managementTaskDetailItem.findMany({ where: { taskId: detail.taskId }, select: { axisKey: true, axisScore: true } });
  const axisScores = Object.fromEntries(allDetails.map((item) => [item.axisKey, item.axisScore])) as ManagementTaskAxisScores;
  const score = totalScore(axisScores);
  await tx.managementTask.update({ where: { id: detail.taskId }, data: { totalScore: score, band: scoreBand(score).toUpperCase() as "RED" | "YELLOW" | "GREEN" } });
  return detail.taskId;
}

export async function listManagementTaskActionItems(projectId: string, taskId: string): Promise<ManagementTaskAxisActionItems[] | null> {
  const prisma = getPrisma();
  const task = await prisma.managementTask.findUnique({ where: { id: taskId }, select: { id: true, projectId: true, archivedAt: true } });
  if (!task || task.projectId !== projectId || task.archivedAt) return null;
  const details = await prisma.managementTaskDetailItem.findMany({
    where: { taskId },
    include: { actionItems: { where: { archivedAt: null }, include: actionItemInclude, orderBy: { sequenceNo: "asc" } } },
  });
  return MANAGEMENT_TASK_AXES.map((axis) => {
    const detail = details.find((item) => item.axisKey === axis.key);
    return {
      detailItemId: detail?.id ?? "",
      axisKey: axis.key,
      label: axis.label,
      band: (detail?.band.toLowerCase() ?? "red") as ManagementTaskBand,
      actionItems: (detail?.actionItems ?? []).map(toActionItemRow),
    };
  });
}

export async function listProjectActionItems(projectId: string, filters: ProjectActionItemFilters = {}) {
  const prisma = getPrisma();
  const and: Prisma.ActionItemWhereInput[] = [];
  if (filters.groupId) and.push({ groupId: filters.groupId });
  if (filters.assigneeId) and.push({ assigneeId: filters.assigneeId });
  const statusValues: string[] = ACTION_ITEM_STATUSES.map((status) => status.value);
  if (filters.status && statusValues.includes(filters.status)) and.push({ status: filters.status as ActionItemStatus });
  const q = filters.q?.trim();
  if (q) and.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, { note: { contains: q, mode: "insensitive" } }] });
  const where: Prisma.ActionItemWhereInput = { projectId, archivedAt: null, ...(and.length ? { AND: and } : {}) };
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 30));
  const total = await prisma.actionItem.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const rows = await prisma.actionItem.findMany({
    where,
    include: { ...actionItemInclude, detailItem: { include: { task: { select: { id: true, displayId: true, name: true } } } } },
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return {
    rows: rows.map((row) => ({
      ...toActionItemRow(row),
      taskId: row.detailItem.task.id,
      taskDisplayId: row.detailItem.task.displayId,
      taskName: row.detailItem.task.name,
      axisKey: row.detailItem.axisKey,
      axisLabel: MANAGEMENT_TASK_AXES.find((axis) => axis.key === row.detailItem.axisKey)?.label ?? row.detailItem.axisKey,
    })) satisfies ProjectActionItemRow[],
    total, page, pageSize, totalPages,
  };
}

export async function createActionItem(projectId: string, userId: string, jobTitle: string | null | undefined, taskId: string, detailItemId: string, input: unknown) {
  const data = createActionItemSchema.parse(input);
  const prisma = getPrisma();
  const detail = await prisma.managementTaskDetailItem.findUnique({ where: { id: detailItemId }, include: { task: true } });
  if (!detail || detail.taskId !== taskId || detail.task.projectId !== projectId || detail.task.archivedAt) throw new DomainError("NOT_FOUND", "세부항목을 찾을 수 없습니다.");
  const group = await assertWorkModuleGroup(projectId, data.groupId);
  await assertActionItemAccess(projectId, userId, jobTitle, group.leaderId, data.assigneeId);
  const assigneeCount = await prisma.projectMember.count({ where: { projectId, userId: data.assigneeId, isActive: true, user: { status: "ACTIVE" } } });
  if (!assigneeCount) throw new DomainError("INVALID_CODE", "담당자를 확인할 수 없습니다.");
  if (data.categoryCodeId) await assertActionItemCategory(projectId, data.categoryCodeId);
  const wbsItemId = data.wbsDisplayId ? (await resolveWbsItemByDisplayId(projectId, data.wbsDisplayId)).id : null;
  const actionItem = await prisma.$transaction(async (tx) => {
    const count = await tx.actionItem.count({ where: { detailItemId } });
    const actionItem = await tx.actionItem.create({
      data: {
        detailItemId, projectId, sequenceNo: count + 1,
        categoryCodeId: data.categoryCodeId ?? null, name: data.name, priority: data.priority, importance: data.importance,
        groupId: data.groupId, assigneeId: data.assigneeId, createdBy: userId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null, status: data.status,
        wbsItemId, note: data.note,
      },
    });
    await recomputeBandChain(tx, detailItemId);
    return actionItem;
  });
  await writeAuditLog(projectId, userId, "ACTION_ITEM_INSERT", "action_items", actionItem.id, null, { id: actionItem.id, name: data.name });
  revalidateTag(managementTaskTag(projectId));
  return { id: actionItem.id, taskId, version: actionItem.version };
}

export async function updateActionItem(projectId: string, userId: string, jobTitle: string | null | undefined, taskId: string, actionItemId: string, input: unknown) {
  const data = updateActionItemSchema.parse(input);
  const prisma = getPrisma();
  const before = await prisma.actionItem.findUnique({ where: { id: actionItemId }, include: { group: true, detailItem: { select: { taskId: true } } } });
  if (!before || before.projectId !== projectId || before.archivedAt || before.detailItem.taskId !== taskId) throw new DomainError("NOT_FOUND", "액션아이템을 찾을 수 없습니다.");
  await assertActionItemAccess(projectId, userId, jobTitle, before.group.leaderId, before.assigneeId);
  await assertWorkModuleGroup(projectId, data.groupId);
  if (data.assigneeId !== before.assigneeId) {
    const assigneeCount = await prisma.projectMember.count({ where: { projectId, userId: data.assigneeId, isActive: true, user: { status: "ACTIVE" } } });
    if (!assigneeCount) throw new DomainError("INVALID_CODE", "담당자를 확인할 수 없습니다.");
  }
  if (data.categoryCodeId) await assertActionItemCategory(projectId, data.categoryCodeId);
  const wbsItemId = data.wbsDisplayId ? (await resolveWbsItemByDisplayId(projectId, data.wbsDisplayId)).id : null;
  const parentTaskId = await prisma.$transaction(async (tx) => {
    if (before.version !== data.version) throw new DomainError("VERSION_CONFLICT", "다른 사용자가 먼저 수정했습니다. 최신 내용을 다시 확인해 주세요.");
    await tx.actionItem.update({
      where: { id: actionItemId },
      data: {
        categoryCodeId: data.categoryCodeId ?? null, name: data.name, priority: data.priority, importance: data.importance,
        groupId: data.groupId, assigneeId: data.assigneeId, dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: data.status, wbsItemId, note: data.note, version: { increment: 1 },
      },
    });
    return recomputeBandChain(tx, before.detailItemId);
  });
  await writeAuditLog(projectId, userId, "ACTION_ITEM_UPDATE", "action_items", actionItemId, before, data);
  revalidateTag(managementTaskTag(projectId));
  return { id: actionItemId, taskId: parentTaskId, version: before.version + 1 };
}

export async function archiveActionItem(projectId: string, userId: string, jobTitle: string | null | undefined, taskId: string, actionItemId: string, input: unknown) {
  const data = archiveActionItemSchema.parse(input);
  const prisma = getPrisma();
  const before = await prisma.actionItem.findUnique({ where: { id: actionItemId }, include: { group: true, detailItem: { select: { taskId: true } } } });
  if (!before || before.projectId !== projectId || before.archivedAt || before.detailItem.taskId !== taskId) throw new DomainError("NOT_FOUND", "액션아이템을 찾을 수 없습니다.");
  await assertActionItemAccess(projectId, userId, jobTitle, before.group.leaderId, before.assigneeId);
  const parentTaskId = await prisma.$transaction(async (tx) => {
    if (before.version !== data.version) throw new DomainError("VERSION_CONFLICT", "다른 사용자가 먼저 수정했습니다. 최신 내용을 다시 확인해 주세요.");
    await tx.actionItem.update({ where: { id: actionItemId }, data: { archivedAt: new Date(), version: { increment: 1 } } });
    return recomputeBandChain(tx, before.detailItemId);
  });
  await writeAuditLog(projectId, userId, "ACTION_ITEM_ARCHIVE", "action_items", actionItemId, null, { archived: true });
  revalidateTag(managementTaskTag(projectId));
  return { id: actionItemId, taskId: parentTaskId, version: before.version + 1 };
}
