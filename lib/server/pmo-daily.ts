import "server-only";

import { z } from "zod";
import { delayDays, delayedTaskCount, delayedTaskRate, overallProgress, scheduleProgress, taskDelayRate } from "@/lib/domain/pmo-daily";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { assertManager } from "@/lib/server/permissions";
import { assertWorkModuleGroup } from "@/lib/server/items";
import { getWbsDailyTaskCounts } from "@/lib/server/wbs";
import { DomainError } from "@/lib/server/errors";

const percent = z.number().int().min(0).max(100);
const count = z.number().int().min(0).max(1_000_000);
const status = z.enum(["IDENTIFIED", "ACTION_IN_PROGRESS", "NORMALIZED", "CLOSED"]);
export const snapshotSchema = z.object({ reportDate: z.string().date(), plannedTaskCount: count, actualTaskCount: count, totalTaskCount: count, completedTaskCount: count }).refine((data) => data.completedTaskCount <= data.totalTaskCount, { message: "완료 TASK는 전체 TASK보다 클 수 없습니다." });
const delayedTaskBase = z.object({ groupId: z.string().uuid(), description: z.string().trim().min(1).max(500), plannedProgress: percent, actualProgress: percent, plannedEndDate: z.union([z.string().date(), z.literal("")]).default(""), delayReason: z.string().trim().max(2000).default(""), responsePlan: z.string().trim().max(2000).default(""), status, assigneeIds: z.array(z.string().uuid()).max(50).default([]) });
export const createDelayedTaskSchema = delayedTaskBase.extend({ reportDate: z.string().date() });
export const updateDelayedTaskSchema = delayedTaskBase.extend({ version: z.number().int().positive() });
export const archiveDelayedTaskSchema = z.object({ version: z.number().int().positive() });

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const dateValue = (date: string) => new Date(`${date}T00:00:00.000Z`);

export type PmoDailyListFilters = { dateFrom?: string; dateTo?: string; page?: number };

export async function listPmoDailySnapshots(projectId: string, filters: PmoDailyListFilters = {}) {
  const pageSize = 20;
  const page = Math.max(1, filters.page || 1);
  const reportDate = {
    ...(filters.dateFrom ? { gte: dateValue(filters.dateFrom) } : {}),
    ...(filters.dateTo ? { lte: dateValue(filters.dateTo) } : {}),
  };
  const where = { projectId, ...(Object.keys(reportDate).length ? { reportDate } : {}) };
  const prisma = getPrisma();
  const [rows, total] = await Promise.all([
    prisma.pmoDailySnapshot.findMany({
      where,
      select: {
        reportDate: true, plannedTaskCount: true, actualTaskCount: true,
        totalTaskCount: true, completedTaskCount: true, updatedAt: true,
        creator: { select: { name: true } },
        _count: { select: { delayedTasks: { where: { archivedAt: null } } } },
      },
      orderBy: { reportDate: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.pmoDailySnapshot.count({ where }),
  ]);
  return {
    rows: rows.map((row) => {
      const delayedCount = delayedTaskCount(row.plannedTaskCount, row.actualTaskCount);
      return {
        reportDate: isoDate(row.reportDate), plannedTaskCount: row.plannedTaskCount,
        actualTaskCount: row.actualTaskCount, scheduleProgress: scheduleProgress(row.plannedTaskCount, row.actualTaskCount),
        delayedTaskCount: delayedCount, delayedRate: delayedTaskRate(delayedCount, row.plannedTaskCount),
        totalTaskCount: row.totalTaskCount, completedTaskCount: row.completedTaskCount,
        overallProgress: overallProgress(row.completedTaskCount, row.totalTaskCount, 0),
        registeredDelayedTaskCount: row._count.delayedTasks, creatorName: row.creator.name,
        updatedAt: row.updatedAt.toISOString(),
      };
    }),
    total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function validateAssignees(projectId: string, ids: string[]) {
  const assigneeIds = [...new Set(ids)];
  if (assigneeIds.length) {
    const valid = await getPrisma().projectMember.count({ where: { projectId, userId: { in: assigneeIds }, isActive: true, user: { status: "ACTIVE" } } });
    if (valid !== assigneeIds.length) throw new DomainError("INVALID_CODE", "담당자 목록에 유효하지 않은 사용자가 있습니다.");
  }
  return assigneeIds;
}

export async function getPmoDailyDashboard(projectId: string, reportDate: string) {
  const prisma = getPrisma();
  const date = dateValue(reportDate);
  const [snapshot, issues, managementTasks] = await Promise.all([
    prisma.pmoDailySnapshot.findUnique({ where: { projectId_reportDate: { projectId, reportDate: date } }, include: { delayedTasks: { where: { archivedAt: null }, include: { group: true, assignees: { include: { user: true } } }, orderBy: { createdAt: "asc" } } } }),
    prisma.item.findMany({ where: { projectId, archivedAt: null, status: { in: ["registered", "in_progress", "on_hold"] } }, include: { group: true }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.managementTask.findMany({ where: { projectId, archivedAt: null }, include: { group: true, assignees: { include: { user: true } } }, orderBy: { updatedAt: "desc" }, take: 8 }),
  ]);
  const tasks = snapshot?.delayedTasks ?? [];
  // 아직 저장되지 않은 일자(신규 작성)는 WBS의 오늘 기준 실제 진행 현황을 기본값으로 보여준다 — 저장된 스냅샷이 있으면 그 값을 그대로 존중한다.
  const wbsCounts = snapshot ? null : await getWbsDailyTaskCounts(projectId, reportDate);
  const plannedTaskCount = snapshot?.plannedTaskCount ?? wbsCounts!.plannedTaskCount, actualTaskCount = snapshot?.actualTaskCount ?? wbsCounts!.actualTaskCount, totalTaskCount = snapshot?.totalTaskCount ?? wbsCounts!.totalTaskCount, completedTaskCount = snapshot?.completedTaskCount ?? wbsCounts!.completedTaskCount;
  const delayedCount = delayedTaskCount(plannedTaskCount, actualTaskCount);
  return {
    reportDate,
    exists: Boolean(snapshot),
    snapshot: { plannedTaskCount, actualTaskCount, totalTaskCount, completedTaskCount, version: snapshot?.version ?? 0 },
    metrics: { scheduleProgress: scheduleProgress(plannedTaskCount, actualTaskCount), delayedTaskCount: delayedCount, delayedRate: delayedTaskRate(delayedCount, plannedTaskCount), overallProgress: overallProgress(completedTaskCount, totalTaskCount, 0) },
    delayedTasks: tasks.map((task) => ({ id: task.id, displayId: task.displayId, groupId: task.groupId, groupLabel: task.group.label, description: task.description, plannedProgress: task.plannedProgress, actualProgress: task.actualProgress, delayRate: taskDelayRate(task.plannedProgress, task.actualProgress), plannedEndDate: task.plannedEndDate ? isoDate(task.plannedEndDate) : null, delayDays: delayDays(task.plannedEndDate ? isoDate(task.plannedEndDate) : null, reportDate, task.status === "CLOSED"), delayReason: task.delayReason, responsePlan: task.responsePlan, status: task.status, assignees: task.assignees.map(({ user }) => ({ id: user.id, userId: user.userId, name: user.name })), version: task.version })),
    issues: issues.map((item) => ({ id: item.id, displayId: item.displayId, title: item.title, groupLabel: item.group.label, ownerName: item.ownerText || "-", status: item.status, updatedAt: isoDate(item.updatedAt) })),
    managementTasks: managementTasks.map((task) => ({ id: task.id, displayId: task.displayId, name: task.name, groupLabel: task.group.label, assignees: task.assignees.map(({ user }) => user.name), status: task.status, totalScore: task.totalScore, band: task.band.toLowerCase() })),
  };
}

export async function savePmoDailySnapshot(projectId: string, userId: string, input: unknown) {
  const data = snapshotSchema.parse(input);
  await assertManager(projectId, userId);
  const row = await getPrisma().pmoDailySnapshot.upsert({ where: { projectId_reportDate: { projectId, reportDate: dateValue(data.reportDate) } }, create: { projectId, reportDate: dateValue(data.reportDate), plannedTaskCount: data.plannedTaskCount, actualTaskCount: data.actualTaskCount, totalTaskCount: data.totalTaskCount, completedTaskCount: data.completedTaskCount, createdBy: userId }, update: { plannedTaskCount: data.plannedTaskCount, actualTaskCount: data.actualTaskCount, totalTaskCount: data.totalTaskCount, completedTaskCount: data.completedTaskCount, version: { increment: 1 } } });
  await writeAuditLog(projectId, userId, "PMO_DAILY_SAVE", "pmo_daily_snapshots", row.id, null, data);
  return { id: row.id, version: row.version };
}

export async function createPmoDelayedTask(projectId: string, userId: string, input: unknown) {
  const data = createDelayedTaskSchema.parse(input), assigneeIds = await validateAssignees(projectId, data.assigneeIds);
  await assertManager(projectId, userId); await assertWorkModuleGroup(projectId, data.groupId);
  const prisma = getPrisma();
  const task = await prisma.$transaction(async (tx) => {
    const snapshot = await tx.pmoDailySnapshot.upsert({ where: { projectId_reportDate: { projectId, reportDate: dateValue(data.reportDate) } }, create: { projectId, reportDate: dateValue(data.reportDate), createdBy: userId }, update: {} });
    const sequence = await tx.pmoDelayedTaskSequence.upsert({ where: { projectId }, create: { projectId, value: 1 }, update: { value: { increment: 1 } } });
    return tx.pmoDelayedTask.create({ data: { displayId: `DT-${new Date().getUTCFullYear()}-${String(sequence.value).padStart(6, "0")}`, snapshotId: snapshot.id, groupId: data.groupId, description: data.description, plannedProgress: data.plannedProgress, actualProgress: data.actualProgress, plannedEndDate: data.plannedEndDate ? dateValue(data.plannedEndDate) : null, delayReason: data.delayReason, responsePlan: data.responsePlan, status: data.status, createdBy: userId, assignees: assigneeIds.length ? { createMany: { data: assigneeIds.map((assigneeId) => ({ userId: assigneeId })) } } : undefined } });
  });
  await writeAuditLog(projectId, userId, "PMO_DELAYED_TASK_INSERT", "pmo_delayed_tasks", task.id, null, { displayId: task.displayId });
  return { id: task.id };
}

export async function updatePmoDelayedTask(projectId: string, userId: string, id: string, input: unknown) {
  const data = updateDelayedTaskSchema.parse(input), assigneeIds = await validateAssignees(projectId, data.assigneeIds);
  await assertManager(projectId, userId); await assertWorkModuleGroup(projectId, data.groupId);
  const prisma = getPrisma();
  const task = await prisma.pmoDelayedTask.findUnique({ where: { id }, include: { snapshot: true } });
  if (!task || task.snapshot.projectId !== projectId || task.archivedAt) throw new DomainError("NOT_FOUND", "지연 TASK를 찾을 수 없습니다.");
  if (task.version !== data.version) throw new DomainError("VERSION_CONFLICT", "다른 사용자가 먼저 수정했습니다. 다시 확인해 주세요.");
  const updated = await prisma.pmoDelayedTask.update({ where: { id }, data: { groupId: data.groupId, description: data.description, plannedProgress: data.plannedProgress, actualProgress: data.actualProgress, plannedEndDate: data.plannedEndDate ? dateValue(data.plannedEndDate) : null, delayReason: data.delayReason, responsePlan: data.responsePlan, status: data.status, version: { increment: 1 }, assignees: { deleteMany: {}, ...(assigneeIds.length ? { createMany: { data: assigneeIds.map((assigneeId) => ({ userId: assigneeId })) } } : {}) } } });
  await writeAuditLog(projectId, userId, "PMO_DELAYED_TASK_UPDATE", "pmo_delayed_tasks", id, task, data);
  return { id, version: updated.version };
}

export async function archivePmoDelayedTask(projectId: string, userId: string, id: string, input: unknown) {
  const data = archiveDelayedTaskSchema.parse(input); await assertManager(projectId, userId);
  const prisma = getPrisma(), task = await prisma.pmoDelayedTask.findUnique({ where: { id }, include: { snapshot: true } });
  if (!task || task.snapshot.projectId !== projectId || task.archivedAt) throw new DomainError("NOT_FOUND", "지연 TASK를 찾을 수 없습니다.");
  if (task.version !== data.version) throw new DomainError("VERSION_CONFLICT", "다른 사용자가 먼저 수정했습니다. 다시 확인해 주세요.");
  await prisma.pmoDelayedTask.update({ where: { id }, data: { archivedAt: new Date(), version: { increment: 1 } } });
  await writeAuditLog(projectId, userId, "PMO_DELAYED_TASK_ARCHIVE", "pmo_delayed_tasks", id, null, { archived: true });
  return { id };
}

export type PmoDailyDashboard = Awaited<ReturnType<typeof getPmoDailyDashboard>>;
