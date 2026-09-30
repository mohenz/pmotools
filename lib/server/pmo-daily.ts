import "server-only";

import { z } from "zod";
import { dailyTaskState, delayedTaskCount, delayedTaskRate, overallProgress, scheduleProgress, shiftBusinessDay, type DailyTaskState } from "@/lib/domain/pmo-daily";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { assertManager } from "@/lib/server/permissions";
import { assertWorkModuleGroup } from "@/lib/server/groups";
import { getWbsDailyTaskCounts, getWbsDueTodayIncompleteTasks, listWbsItems, loadHolidaySet, loadOwnerGroupLabels, ownerGroupLabelOf } from "@/lib/server/wbs";
import { listCalendarEvents } from "@/lib/server/calendar";
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

export type PmoDailyListFilters = { dateFrom?: string; dateTo?: string; page?: number; pageSize?: number | "all" };

export async function listPmoDailySnapshots(projectId: string, filters: PmoDailyListFilters = {}) {
  const reportDate = {
    ...(filters.dateFrom ? { gte: dateValue(filters.dateFrom) } : {}),
    ...(filters.dateTo ? { lte: dateValue(filters.dateTo) } : {}),
  };
  const where = { projectId, ...(Object.keys(reportDate).length ? { reportDate } : {}) };
  const prisma = getPrisma();
  const total = await prisma.pmoDailySnapshot.count({ where });
  const pageSize = filters.pageSize === "all" ? Math.max(1, total) : Math.min(100, Math.max(10, filters.pageSize ?? 20));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const rows = await prisma.pmoDailySnapshot.findMany({
    where,
    select: {
      reportDate: true, plannedTaskCount: true, actualTaskCount: true,
      totalTaskCount: true, completedTaskCount: true, updatedAt: true,
      creator: { select: { name: true } },
      _count: { select: { delayedTasks: { where: { archivedAt: null } } } },
    },
    orderBy: { reportDate: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
  });
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
    total, page, pageSize, totalPages,
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
  const [snapshot, issues, managementTasks, dueTodayIncomplete] = await Promise.all([
    prisma.pmoDailySnapshot.findUnique({ where: { projectId_reportDate: { projectId, reportDate: date } } }),
    prisma.issue.findMany({ where: { projectId, archivedAt: null, status: { in: ["OPEN", "IN_PROGRESS"] } }, include: { category: true }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.managementTask.findMany({ where: { projectId, archivedAt: null }, include: { group: true, assignees: { include: { user: true } } }, orderBy: { updatedAt: "desc" }, take: 8 }),
    getWbsDueTodayIncompleteTasks(projectId, reportDate),
  ]);
  // 아직 저장되지 않은 일자(신규 작성)는 WBS의 오늘 기준 실제 진행 현황을 기본값으로 보여준다 — 저장된 스냅샷이 있으면 그 값을 그대로 존중한다.
  const wbsCounts = snapshot ? null : await getWbsDailyTaskCounts(projectId, reportDate);
  const plannedTaskCount = snapshot?.plannedTaskCount ?? wbsCounts!.plannedTaskCount, actualTaskCount = snapshot?.actualTaskCount ?? wbsCounts!.actualTaskCount, totalTaskCount = snapshot?.totalTaskCount ?? wbsCounts!.totalTaskCount, completedTaskCount = snapshot?.completedTaskCount ?? wbsCounts!.completedTaskCount;
  const delayedCount = delayedTaskCount(plannedTaskCount, actualTaskCount);
  return {
    reportDate,
    exists: Boolean(snapshot),
    snapshot: { plannedTaskCount, actualTaskCount, totalTaskCount, completedTaskCount, version: snapshot?.version ?? 0 },
    metrics: { scheduleProgress: scheduleProgress(plannedTaskCount, actualTaskCount), delayedTaskCount: delayedCount, delayedRate: delayedTaskRate(delayedCount, plannedTaskCount), overallProgress: overallProgress(completedTaskCount, totalTaskCount, 0) },
    delayedTasks: dueTodayIncomplete.map((item) => ({ id: item.id, code: item.code, name: item.name, stage: item.stage, ownerName: item.ownerName, groupLabel: item.groupLabel, startDate: item.startDate, dueDate: item.dueDate, actualStartDate: item.actualStartDate, actualDueDate: item.actualDueDate, delayDays: item.delayDays, delayRate: item.delayRate })),
    delayedTaskTotal: dueTodayIncomplete.length,
    issues: issues.map((issue) => ({ id: issue.id, displayId: issue.displayId, title: issue.title, categoryLabel: issue.category.label, occurredAt: isoDate(issue.occurredAt), status: issue.status })),
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

export type PmoHomeTask = { id: string; code: string; name: string; ownerName: string | null; startDate: string | null; dueDate: string | null; state: DailyTaskState; delayDays: number | null };
export type PmoHomeDay = { key: "yesterday" | "today" | "tomorrow"; label: string; date: string; starting: PmoHomeTask[]; ending: PmoHomeTask[] };
export type PmoHomeMeeting = { id: string; source: "schedule" | "meeting"; title: string; allDay: boolean; startTime: string; endTime: string; location: string; isMilestone: boolean; priority: string; attendees: string[]; href: string };
export type PmoHomeMeetingDay = { key: "today" | "tomorrow"; label: string; date: string; meetings: PmoHomeMeeting[] };

// 캘린더 화면과 같은 기준(KST 시작일~종료일 포함)으로, 여러 날에 걸친 일정은 걸친 날마다 보여준다.
const kstDate = (iso: string) => new Date(Date.parse(iso) + 9 * 3_600_000).toISOString().slice(0, 10);

// PMO Daily 대시보드(/pmo-daily/dashboard) — 저장 스냅샷이 아니라 WBS·캘린더·회의실·이슈의 현재 데이터를 기준일(KST 오늘)로 집계한다.
// 대상 TASK는 공정현황·지연 TASK와 같은 기준으로 leaf(진도관리대상) 항목만 본다.
export async function getPmoDailyHomeDashboard(projectId: string, today: string) {
  // 내일(다음 영업일)을 알아야 캘린더 조회 범위가 정해지므로 휴일만 먼저 읽는다.
  const holidays = await loadHolidaySet(projectId);
  const tomorrow = shiftBusinessDay(today, 1, holidays);
  const [items, { groupLabelByOwner }, events, issues] = await Promise.all([
    listWbsItems(projectId), loadOwnerGroupLabels(projectId),
    listCalendarEvents(projectId, today, tomorrow),
    getPrisma().issue.findMany({ where: { projectId, archivedAt: null, status: { not: "CLOSED" } }, include: { category: true, owner: { select: { name: true } } }, orderBy: [{ occurredAt: "desc" }, { seq: "desc" }] }),
  ]);
  const parentIds = new Set(items.filter((item) => item.parentId).map((item) => item.parentId!));
  const leaves = items.filter((item) => !parentIds.has(item.id)).map((item) => ({ item, state: dailyTaskState(today, item) }));
  const toTask = ({ item, state }: (typeof leaves)[number]): PmoHomeTask => ({ id: item.id, code: item.code, name: item.name, ownerName: item.ownerName, startDate: item.startDate, dueDate: item.dueDate, state, delayDays: item.delayDays });

  const days: PmoHomeDay[] = ([["yesterday", "어제", shiftBusinessDay(today, -1, holidays)], ["today", "오늘", today], ["tomorrow", "내일", tomorrow]] as const)
    .map(([key, label, date]) => ({ key, label, date, starting: leaves.filter(({ item }) => item.startDate === date).map(toTask), ending: leaves.filter(({ item }) => item.dueDate === date).map(toTask) }));

  const delayedByGroup = new Map<string, PmoHomeTask[]>();
  for (const leaf of leaves.filter(({ state }) => state === "delayed")) {
    const group = ownerGroupLabelOf(leaf.item, groupLabelByOwner);
    delayedByGroup.set(group, [...(delayedByGroup.get(group) ?? []), toTask(leaf)]);
  }

  return {
    today,
    taskSummary: {
      inProgress: leaves.filter(({ state }) => state === "in_progress").length,
      // 종료 = 오늘 실적종료일이 찍힌 TASK. 누적 완료 건수는 PMO Daily 공정현황(완료 TASK)에서 본다.
      doneToday: leaves.filter(({ item }) => item.actualDueDate === today).length,
      delayed: leaves.filter(({ state }) => state === "delayed").length,
    },
    days,
    meetingDays: ([["today", "오늘", today], ["tomorrow", "내일", tomorrow]] as const).map(([key, label, date]): PmoHomeMeetingDay => ({
      key, label, date,
      meetings: events
        .filter((event) => (event.source === "schedule" || event.source === "meeting") && event.date <= date && kstDate(event.endAt) >= date)
        .map((event) => ({ id: event.id, source: event.source as "schedule" | "meeting", title: event.title, allDay: event.allDay, startTime: event.startTime, endTime: event.endTime, location: event.location, isMilestone: event.isMilestone, priority: event.priority, attendees: event.assignees.map((person) => person.name), href: event.source === "meeting" ? "/meetrooms" : "/calendar" })),
    })),
    delayedGroups: [...delayedByGroup.entries()]
      .map(([groupLabel, tasks]) => ({ groupLabel, tasks: tasks.sort((a, b) => (b.delayDays ?? 0) - (a.delayDays ?? 0) || a.code.localeCompare(b.code)) }))
      .sort((a, b) => b.tasks.length - a.tasks.length || a.groupLabel.localeCompare(b.groupLabel, "ko")),
    issues: issues.map((issue) => ({ id: issue.id, displayId: issue.displayId, title: issue.title, categoryLabel: issue.category.label, importance: issue.importance, status: issue.status, ownerName: issue.owner?.name ?? issue.ownerName ?? null, occurredAt: isoDate(issue.occurredAt), dueAt: issue.dueAt ? isoDate(issue.dueAt) : null })),
  };
}
export type PmoDailyHomeDashboard = Awaited<ReturnType<typeof getPmoDailyHomeDashboard>>;
