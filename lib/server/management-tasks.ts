import "server-only";

import { z } from "zod";
import { revalidateTag, unstable_cache } from "next/cache";
import { averageScore, scoreBand, totalScore, wouldCreateCycle, type ManagementTaskEdge, type ManagementTaskPercents } from "@/lib/domain/management-tasks";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { assertManager } from "@/lib/server/permissions";
import { assertWorkModuleGroup } from "@/lib/server/items";
import { DomainError } from "@/lib/server/errors";
import { managementTaskTag } from "@/lib/server/cache-tags";
import type { Prisma } from "@/lib/generated/prisma/client";

export { DomainError };

const percentSchema = z.number().int().min(0).max(100);
const contentSchema = z.string().trim().max(2000).default("");
const baseTaskSchema = z.object({
  groupId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  registrationDate: z.string().date(),
  prepContent: contentSchema, prepPercent: percentSchema,
  ownerContent: contentSchema, ownerPercent: percentSchema,
  progressContent: contentSchema, progressPercent: percentSchema,
  issueContent: contentSchema, issuePercent: percentSchema,
  closeContent: contentSchema, closePercent: percentSchema,
});
export const createManagementTaskSchema = baseTaskSchema;
export const updateManagementTaskSchema = baseTaskSchema.extend({ version: z.number().int().positive() });
export const archiveSchema = z.object({ version: z.number().int().positive() });
export const linkTaskSchema = z.object({ targetId: z.string().uuid(), relation: z.enum(["predecessor", "successor"]), version: z.number().int().positive() });
export const unlinkTaskSchema = z.object({ linkId: z.string().uuid(), version: z.number().int().positive() });

export type ManagementTaskRow = {
  id: string; displayId: string; projectId: string; groupId: string; groupLabel: string; groupCode: string;
  name: string; registrationDate: string;
  prepContent: string; prepPercent: number;
  ownerContent: string; ownerPercent: number;
  progressContent: string; progressPercent: number;
  issueContent: string; issuePercent: number;
  closeContent: string; closePercent: number;
  totalScore: number; band: "red" | "yellow" | "green";
  createdAt: string; updatedAt: string; version: number;
};
export type ManagementTaskLinkSummary = { linkId: string; id: string; displayId: string; name: string };
export type ManagementTaskDetail = { task: ManagementTaskRow; predecessors: ManagementTaskLinkSummary[]; successors: ManagementTaskLinkSummary[] };
export type ManagementTaskFilters = { q?: string; groupId?: string; band?: string; page?: number; pageSize?: number };
export type ManagementTaskSearchResult = { id: string; displayId: string; name: string };
export type ManagementTaskDashboard = { summary: { red: number; yellow: number; green: number; total: number }; projectScore: number | null; projectBand: "red" | "yellow" | "green" | null; tasks: ManagementTaskRow[] };

const managementTaskInclude = { group: true } as const;
type ManagementTaskWithGroup = Prisma.ManagementTaskGetPayload<{ include: typeof managementTaskInclude }>;

const dateStr = (value: Date) => value.toISOString().slice(0, 10);

function toRow(row: ManagementTaskWithGroup): ManagementTaskRow {
  return {
    id: row.id, displayId: row.displayId, projectId: row.projectId, groupId: row.groupId, groupLabel: row.group.label, groupCode: row.group.code,
    name: row.name, registrationDate: dateStr(row.registrationDate),
    prepContent: row.prepContent, prepPercent: row.prepPercent,
    ownerContent: row.ownerContent, ownerPercent: row.ownerPercent,
    progressContent: row.progressContent, progressPercent: row.progressPercent,
    issueContent: row.issueContent, issuePercent: row.issuePercent,
    closeContent: row.closeContent, closePercent: row.closePercent,
    totalScore: row.totalScore, band: row.band.toLowerCase() as "red" | "yellow" | "green",
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), version: row.version,
  } satisfies ManagementTaskRow;
}

function percentsOf(data: { prepPercent: number; ownerPercent: number; progressPercent: number; issuePercent: number; closePercent: number }): ManagementTaskPercents {
  return { prep: data.prepPercent, owner: data.ownerPercent, progress: data.progressPercent, issue: data.issuePercent, close: data.closePercent };
}
function computeScore(data: Parameters<typeof percentsOf>[0]) {
  const score = totalScore(percentsOf(data));
  return { totalScore: score, band: scoreBand(score).toUpperCase() as "RED" | "YELLOW" | "GREEN" };
}
function mutationError(task: { archivedAt: Date | null; version: number } | null, version: number) {
  if (!task || task.archivedAt) throw new DomainError("NOT_FOUND", "관리업무항목을 찾을 수 없습니다.");
  if (task.version !== version) throw new DomainError("VERSION_CONFLICT", "다른 사용자가 먼저 수정했습니다. 최신 내용을 다시 확인해 주세요.");
}

export function managementTaskWhere(projectId: string, filters: ManagementTaskFilters): Prisma.ManagementTaskWhereInput {
  const and: Prisma.ManagementTaskWhereInput[] = [];
  const query = filters.q?.trim();
  if (filters.groupId) and.push({ groupId: filters.groupId });
  const band = filters.band && ["red", "yellow", "green"].includes(filters.band) ? (filters.band.toUpperCase() as "RED" | "YELLOW" | "GREEN") : undefined;
  if (band) and.push({ band });
  if (query) and.push({ OR: [{ name: { contains: query, mode: "insensitive" } }, { displayId: { contains: query, mode: "insensitive" } }] });
  return { projectId, archivedAt: null, ...(and.length ? { AND: and } : {}) };
}

export async function listManagementTasks(projectId: string, filters: ManagementTaskFilters = {}) {
  const prisma = getPrisma();
  const where = managementTaskWhere(projectId, filters);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 30));
  const total = await prisma.managementTask.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const rows = await prisma.managementTask.findMany({ where, include: managementTaskInclude, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize });
  return { tasks: rows.map(toRow), total, page, pageSize, totalPages };
}

export async function searchManagementTasks(projectId: string, query: string, excludeId?: string): Promise<ManagementTaskSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  return getPrisma().managementTask.findMany({
    where: { projectId, archivedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}), OR: [{ displayId: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] },
    orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, displayId: true, name: true },
  });
}

export async function getManagementTaskDetail(projectId: string, id: string): Promise<ManagementTaskDetail | null> {
  const prisma = getPrisma();
  const task = await prisma.managementTask.findUnique({ where: { id }, include: managementTaskInclude });
  if (!task || task.projectId !== projectId || task.archivedAt) return null;
  const [predecessorLinks, successorLinks] = await Promise.all([
    prisma.managementTaskLink.findMany({ where: { successorId: id }, include: { predecessor: true } }),
    prisma.managementTaskLink.findMany({ where: { predecessorId: id }, include: { successor: true } }),
  ]);
  return {
    task: toRow(task),
    predecessors: predecessorLinks.map((link) => ({ linkId: link.id, id: link.predecessor.id, displayId: link.predecessor.displayId, name: link.predecessor.name })),
    successors: successorLinks.map((link) => ({ linkId: link.id, id: link.successor.id, displayId: link.successor.displayId, name: link.successor.name })),
  };
}

async function loadManagementTaskDashboard(projectId: string): Promise<ManagementTaskDashboard> {
  const prisma = getPrisma();
  const where = { projectId, archivedAt: null } as const;
  const [rows, red, yellow, green] = await Promise.all([
    prisma.managementTask.findMany({ where, include: managementTaskInclude, orderBy: { updatedAt: "desc" } }),
    prisma.managementTask.count({ where: { ...where, band: "RED" } }),
    prisma.managementTask.count({ where: { ...where, band: "YELLOW" } }),
    prisma.managementTask.count({ where: { ...where, band: "GREEN" } }),
  ]);
  const tasks = rows.map(toRow);
  const projectScore = averageScore(tasks.map((task) => task.totalScore));
  return { summary: { red, yellow, green, total: red + yellow + green }, projectScore, projectBand: projectScore === null ? null : scoreBand(projectScore), tasks };
}
// 대시보드는 여러 화면이 공유하는 읽기 중심 데이터라 30초 캐시하고, 등록/수정/보관/연결 변경 시 즉시 무효화한다.
export function getManagementTaskDashboard(projectId: string) {
  return unstable_cache(loadManagementTaskDashboard, ["management-task-dashboard"], { tags: [managementTaskTag(projectId)], revalidate: 30 })(projectId);
}

export async function createManagementTask(projectId: string, userId: string, input: unknown) {
  const data = createManagementTaskSchema.parse(input);
  await assertManager(projectId, userId);
  await assertWorkModuleGroup(projectId, data.groupId);
  const { totalScore: score, band } = computeScore(data);
  const prisma = getPrisma();
  const { task, displayId } = await prisma.$transaction(async (tx) => {
    const sequence = await tx.managementTaskSequence.upsert({ where: { projectId }, create: { projectId, value: 1 }, update: { value: { increment: 1 } } });
    const displayId = `MT-${new Date().getUTCFullYear()}-${String(sequence.value).padStart(6, "0")}`;
    const task = await tx.managementTask.create({
      data: {
        displayId, projectId, groupId: data.groupId, name: data.name, registrationDate: new Date(data.registrationDate),
        prepContent: data.prepContent, prepPercent: data.prepPercent,
        ownerContent: data.ownerContent, ownerPercent: data.ownerPercent,
        progressContent: data.progressContent, progressPercent: data.progressPercent,
        issueContent: data.issueContent, issuePercent: data.issuePercent,
        closeContent: data.closeContent, closePercent: data.closePercent,
        totalScore: score, band, createdBy: userId,
      },
    });
    return { task, displayId };
  });
  await writeAuditLog(projectId, userId, "MANAGEMENT_TASK_INSERT", "management_tasks", task.id, null, { id: task.id, displayId, name: data.name });
  revalidateTag(managementTaskTag(projectId));
  return { id: task.id, displayId, version: task.version };
}

export async function updateManagementTask(projectId: string, userId: string, id: string, input: unknown) {
  const data = updateManagementTaskSchema.parse(input);
  await assertManager(projectId, userId);
  await assertWorkModuleGroup(projectId, data.groupId);
  const { totalScore: score, band } = computeScore(data);
  const prisma = getPrisma();
  const { before, version } = await prisma.$transaction(async (tx) => {
    const before = await tx.managementTask.findUnique({ where: { id } });
    if (!before || before.projectId !== projectId) throw new DomainError("NOT_FOUND", "관리업무항목을 찾을 수 없습니다.");
    mutationError(before, data.version);
    const version = data.version + 1;
    await tx.managementTask.update({
      where: { id },
      data: {
        groupId: data.groupId, name: data.name, registrationDate: new Date(data.registrationDate),
        prepContent: data.prepContent, prepPercent: data.prepPercent,
        ownerContent: data.ownerContent, ownerPercent: data.ownerPercent,
        progressContent: data.progressContent, progressPercent: data.progressPercent,
        issueContent: data.issueContent, issuePercent: data.issuePercent,
        closeContent: data.closeContent, closePercent: data.closePercent,
        totalScore: score, band, version,
      },
    });
    return { before, version };
  });
  await writeAuditLog(projectId, userId, "MANAGEMENT_TASK_UPDATE", "management_tasks", id, before, { ...data, totalScore: score, band });
  revalidateTag(managementTaskTag(projectId));
  return { id, version };
}

export async function archiveManagementTask(projectId: string, userId: string, id: string, input: unknown) {
  const data = archiveSchema.parse(input);
  await assertManager(projectId, userId);
  const prisma = getPrisma();
  const { version } = await prisma.$transaction(async (tx) => {
    const before = await tx.managementTask.findUnique({ where: { id } });
    if (!before || before.projectId !== projectId) throw new DomainError("NOT_FOUND", "관리업무항목을 찾을 수 없습니다.");
    mutationError(before, data.version);
    const version = data.version + 1;
    await tx.managementTask.update({ where: { id }, data: { archivedAt: new Date(), version } });
    return { version };
  });
  await writeAuditLog(projectId, userId, "MANAGEMENT_TASK_ARCHIVE", "management_tasks", id, null, { archived: true });
  revalidateTag(managementTaskTag(projectId));
  return { id, version };
}

export async function linkManagementTasks(projectId: string, userId: string, id: string, input: unknown) {
  const data = linkTaskSchema.parse(input);
  await assertManager(projectId, userId);
  if (data.targetId === id) throw new DomainError("INVALID_STATE", "같은 항목을 선후행으로 지정할 수 없습니다.");
  const predecessorId = data.relation === "predecessor" ? data.targetId : id;
  const successorId = data.relation === "predecessor" ? id : data.targetId;
  const prisma = getPrisma();
  const version = await prisma.$transaction(async (tx) => {
    const [current, target] = await Promise.all([tx.managementTask.findUnique({ where: { id } }), tx.managementTask.findUnique({ where: { id: data.targetId } })]);
    if (!current || current.projectId !== projectId) throw new DomainError("NOT_FOUND", "관리업무항목을 찾을 수 없습니다.");
    if (!target || target.projectId !== projectId || target.archivedAt) throw new DomainError("INVALID_CODE", "연결할 관리업무항목을 찾을 수 없습니다.");
    mutationError(current, data.version);
    const existing = await tx.managementTaskLink.findUnique({ where: { predecessorId_successorId: { predecessorId, successorId } } });
    if (existing) throw new DomainError("DUPLICATE_CODE", "이미 연결된 항목입니다.");
    const edges: ManagementTaskEdge[] = (await tx.managementTaskLink.findMany({ where: { projectId }, select: { predecessorId: true, successorId: true } }));
    if (wouldCreateCycle(edges, predecessorId, successorId)) throw new DomainError("CYCLE_DETECTED", "순환 구조가 발생하는 연결입니다.");
    await tx.managementTaskLink.create({ data: { projectId, predecessorId, successorId, createdBy: userId } });
    const version = data.version + 1;
    await tx.managementTask.update({ where: { id }, data: { version } });
    return version;
  });
  await writeAuditLog(projectId, userId, "MANAGEMENT_TASK_LINK", "management_task_links", id, null, { predecessorId, successorId });
  revalidateTag(managementTaskTag(projectId));
  return { id, version };
}

export async function unlinkManagementTasks(projectId: string, userId: string, id: string, input: unknown) {
  const data = unlinkTaskSchema.parse(input);
  await assertManager(projectId, userId);
  const prisma = getPrisma();
  const version = await prisma.$transaction(async (tx) => {
    const [current, link] = await Promise.all([tx.managementTask.findUnique({ where: { id } }), tx.managementTaskLink.findUnique({ where: { id: data.linkId } })]);
    if (!current || current.projectId !== projectId) throw new DomainError("NOT_FOUND", "관리업무항목을 찾을 수 없습니다.");
    if (!link || link.projectId !== projectId || (link.predecessorId !== id && link.successorId !== id)) throw new DomainError("NOT_FOUND", "연결 정보를 찾을 수 없습니다.");
    mutationError(current, data.version);
    await tx.managementTaskLink.delete({ where: { id: data.linkId } });
    const version = data.version + 1;
    await tx.managementTask.update({ where: { id }, data: { version } });
    return version;
  });
  await writeAuditLog(projectId, userId, "MANAGEMENT_TASK_UNLINK", "management_task_links", id, { linkId: data.linkId }, null);
  revalidateTag(managementTaskTag(projectId));
  return { id, version };
}
