import "server-only";
import { z } from "zod";
import type { CommonCode } from "@/lib/server/common-codes";
import { getCodeOptions } from "@/lib/server/common-codes";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/items";

export type ProjectWeek = { id: string; weekKey: string; label: string; startDate: string; endDate: string; status: "open" | "closed" };
export type WeeklyReport = { id: string; weekId: string; weekLabel: string; areaCodeId: string; areaLabel: string; achievements: string; nextPlan: string; issues: string; decisions: string; notes: string; version: number };
export type ProgressRow = { id: string; weekId: string; weekLabel: string; areaCodeId: string; areaLabel: string; taskName: string; planDetail: string; planTargetDate: string | null; actualDetail: string; actualDate: string | null; progress: number; nextPlan: string; nextTargetDate: string | null; notes: string; version: number; delayed: boolean };
export type StaffChange = { id: string; weekId: string; weekLabel: string; areaCodeId: string; areaLabel: string; changeType: "join" | "leave"; currentCount: number; nextCount: number; notes: string; version: number };
export type ActivityLog = { id: string; action: string; actorName: string | null; createdAt: string; beforeData: Record<string, unknown> | null; afterData: Record<string, unknown> | null };

const dateStr = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

export async function listProjectWeeks(projectId: string): Promise<ProjectWeek[]> {
  const weeks = await getPrisma().week.findMany({ where: { projectId } });
  return weeks.map((week) => ({ id: week.id, weekKey: week.weekKey, label: week.label, startDate: dateStr(week.startDate)!, endDate: dateStr(week.endDate)!, status: week.status })).sort((a, b) => b.startDate.localeCompare(a.startDate));
}
export async function getWorkOptions(projectId: string) {
  const [weeks, codes] = await Promise.all([listProjectWeeks(projectId), getCodeOptions(projectId)]);
  return { weeks, areas: codes.tracks as CommonCode[] };
}
const weekSchema = z.object({ weekKey: z.string().trim().min(7).max(10), label: z.string().trim().min(1).max(50), startDate: z.string().date(), endDate: z.string().date() }).superRefine((d, ctx) => { if (d.endDate < d.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "종료일은 시작일 이후여야 합니다." }); });
export async function createProjectWeek(projectId: string, input: unknown) {
  const data = weekSchema.parse(input);
  const prisma = getPrisma();
  const existing = await prisma.week.findFirst({ where: { projectId, weekKey: data.weekKey } });
  if (existing) throw new DomainError("DUPLICATE_CODE", "동일한 주차 코드가 이미 존재합니다.");
  const week = await prisma.week.create({ data: { projectId, weekKey: data.weekKey, label: data.label, startDate: new Date(data.startDate), endDate: new Date(data.endDate), status: "open" } });
  await writeAuditLog(projectId, null, "PROJECT_WEEKS_INSERT", "weeks", week.id, null, week);
  return { id: week.id, weekKey: week.weekKey, label: week.label, startDate: data.startDate, endDate: data.endDate, status: "open" as const };
}
export async function updateProjectWeekStatus(projectId: string, id: string, status: unknown) {
  const value = z.enum(["open", "closed"]).parse(status);
  const prisma = getPrisma();
  const current = await prisma.week.findUnique({ where: { id } });
  if (!current || current.projectId !== projectId) throw new DomainError("NOT_FOUND", "프로젝트 주차를 찾을 수 없습니다.");
  const updated = await prisma.week.update({ where: { id }, data: { status: value } });
  await writeAuditLog(projectId, null, "PROJECT_WEEKS_UPDATE", "weeks", id, current, updated);
  return { id, weekKey: current.weekKey, label: current.label, startDate: dateStr(current.startDate)!, endDate: dateStr(current.endDate)!, status: value };
}
export type ActivityLogFilters = { table?: string; targetId?: string; from?: string; to?: string };
export async function listActivityLogs(projectId: string, filters: ActivityLogFilters = {}): Promise<ActivityLog[]> {
  const logs = await getPrisma().auditLog.findMany({
    where: {
      projectId,
      ...(filters.table ? { targetTable: filters.table } : {}),
      ...(filters.targetId ? { targetId: filters.targetId } : {}),
      ...(filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}), ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return logs.map((log) => ({ id: log.id, action: log.action, actorName: log.actorName, createdAt: log.createdAt.toISOString(), beforeData: log.beforeData as Record<string, unknown> | null, afterData: log.afterData as Record<string, unknown> | null }));
}
export async function listAuditTables(projectId: string): Promise<string[]> {
  const rows = await getPrisma().auditLog.findMany({ where: { projectId }, distinct: ["targetTable"], select: { targetTable: true } });
  return rows.map((row) => row.targetTable).filter((table): table is string => Boolean(table)).sort();
}

function lookupMaps(weeks: ProjectWeek[], areas: CommonCode[]) { return { week: new Map(weeks.map((row) => [row.id, row])), area: new Map(areas.map((row) => [row.id, row])) }; }

export async function listWeeklyReports(projectId: string, weekId?: string): Promise<WeeklyReport[]> {
  const prisma = getPrisma();
  const [records, weeks, options] = await Promise.all([prisma.weeklyReport.findMany({ where: { week: { projectId } } }), listProjectWeeks(projectId), getCodeOptions(projectId)]);
  const maps = lookupMaps(weeks, options.tracks as CommonCode[]);
  return records.filter((row) => !weekId || row.weekId === weekId)
    .map((row) => ({ id: row.id, weekId: row.weekId, weekLabel: maps.week.get(row.weekId)?.label ?? "-", areaCodeId: row.groupId, areaLabel: maps.area.get(row.groupId)?.label ?? "-", achievements: row.achievements, nextPlan: row.nextPlan, issues: row.issues, decisions: row.decisions, notes: row.notes, version: row.version }))
    .sort((a, b) => (maps.week.get(b.weekId)?.startDate ?? "").localeCompare(maps.week.get(a.weekId)?.startDate ?? "") || (maps.area.get(a.areaCodeId)?.sortOrder ?? 0) - (maps.area.get(b.areaCodeId)?.sortOrder ?? 0));
}
const reportSchema = z.object({ weekId: z.string().uuid(), areaCodeId: z.string().uuid(), achievements: z.string().max(10000), nextPlan: z.string().max(10000), issues: z.string().max(10000), decisions: z.string().max(10000), notes: z.string().max(10000) });
export async function saveWeeklyReport(projectId: string, userId: string, input: unknown) {
  const data = reportSchema.parse(input);
  const prisma = getPrisma();
  const existing = await prisma.weeklyReport.findUnique({ where: { weekId_groupId: { weekId: data.weekId, groupId: data.areaCodeId } } });
  const saved = existing
    ? await prisma.weeklyReport.update({ where: { id: existing.id }, data: { achievements: data.achievements, nextPlan: data.nextPlan, issues: data.issues, decisions: data.decisions, notes: data.notes, version: { increment: 1 } } })
    : await prisma.weeklyReport.create({ data: { weekId: data.weekId, groupId: data.areaCodeId, achievements: data.achievements, nextPlan: data.nextPlan, issues: data.issues, decisions: data.decisions, notes: data.notes, createdBy: userId } });
  await writeAuditLog(projectId, userId, `WEEKLY_REPORTS_${existing ? "UPDATE" : "INSERT"}`, "weekly_reports", saved.id, existing ?? null, saved);
  return { id: saved.id };
}

export async function listWeeklyProgress(projectId: string, weekId?: string): Promise<ProgressRow[]> {
  const prisma = getPrisma();
  const [records, weeks, options] = await Promise.all([prisma.weeklyProgress.findMany({ where: { week: { projectId } } }), listProjectWeeks(projectId), getCodeOptions(projectId)]);
  const maps = lookupMaps(weeks, options.tracks as CommonCode[]), today = new Date().toISOString().slice(0, 10);
  return records.filter((row) => !weekId || row.weekId === weekId)
    .map((row) => { const planTargetDate = dateStr(row.planTargetDate); return { id: row.id, weekId: row.weekId, weekLabel: maps.week.get(row.weekId)?.label ?? "-", areaCodeId: row.groupId, areaLabel: maps.area.get(row.groupId)?.label ?? "-", taskName: row.taskName, planDetail: row.planDetail, planTargetDate, actualDetail: row.actualDetail, actualDate: dateStr(row.actualDate), progress: row.progress, nextPlan: row.nextPlan, nextTargetDate: dateStr(row.nextTargetDate), notes: row.notes, version: row.version, delayed: row.progress < 100 && Boolean(planTargetDate && planTargetDate < today) }; })
    .sort((a, b) => (maps.week.get(b.weekId)?.startDate ?? "").localeCompare(maps.week.get(a.weekId)?.startDate ?? "") || (maps.area.get(a.areaCodeId)?.sortOrder ?? 0) - (maps.area.get(b.areaCodeId)?.sortOrder ?? 0));
}
const progressSchema = z.object({ weekId: z.string().uuid(), areaCodeId: z.string().uuid(), taskName: z.string().trim().min(1).max(200), planDetail: z.string().max(10000), planTargetDate: z.string().date().nullable(), actualDetail: z.string().max(10000), actualDate: z.string().date().nullable(), progress: z.number().int().min(0).max(100), nextPlan: z.string().max(10000), nextTargetDate: z.string().date().nullable(), notes: z.string().max(10000) });
export async function createProgress(projectId: string, userId: string, input: unknown) {
  const data = progressSchema.parse(input);
  const row = await getPrisma().weeklyProgress.create({ data: { weekId: data.weekId, groupId: data.areaCodeId, taskName: data.taskName, planDetail: data.planDetail, planTargetDate: data.planTargetDate ? new Date(data.planTargetDate) : null, actualDetail: data.actualDetail, actualDate: data.actualDate ? new Date(data.actualDate) : null, progress: data.progress, nextPlan: data.nextPlan, nextTargetDate: data.nextTargetDate ? new Date(data.nextTargetDate) : null, notes: data.notes, createdBy: userId } });
  await writeAuditLog(projectId, userId, "WEEKLY_PROGRESS_INSERT", "weekly_progress", row.id, null, row);
  return { id: row.id };
}
export async function updateProgress(projectId: string, id: string, input: unknown) {
  const data = progressSchema.parse(input);
  const prisma = getPrisma();
  const current = await prisma.weeklyProgress.findUnique({ where: { id } });
  if (!current) throw new DomainError("NOT_FOUND", "주간실적을 찾을 수 없습니다.");
  const updated = await prisma.weeklyProgress.update({ where: { id }, data: { weekId: data.weekId, groupId: data.areaCodeId, taskName: data.taskName, planDetail: data.planDetail, planTargetDate: data.planTargetDate ? new Date(data.planTargetDate) : null, actualDetail: data.actualDetail, actualDate: data.actualDate ? new Date(data.actualDate) : null, progress: data.progress, nextPlan: data.nextPlan, nextTargetDate: data.nextTargetDate ? new Date(data.nextTargetDate) : null, notes: data.notes, version: { increment: 1 } } });
  await writeAuditLog(projectId, null, "WEEKLY_PROGRESS_UPDATE", "weekly_progress", id, current, updated);
  return { id };
}

export async function listStaffChanges(projectId: string, weekId?: string): Promise<StaffChange[]> {
  const prisma = getPrisma();
  const [records, weeks, options] = await Promise.all([prisma.staffChange.findMany({ where: { week: { projectId } } }), listProjectWeeks(projectId), getCodeOptions(projectId)]);
  const maps = lookupMaps(weeks, options.tracks as CommonCode[]);
  return records.filter((row) => !weekId || row.weekId === weekId)
    .map((row) => ({ id: row.id, weekId: row.weekId, weekLabel: maps.week.get(row.weekId)?.label ?? "-", areaCodeId: row.groupId, areaLabel: maps.area.get(row.groupId)?.label ?? "-", changeType: row.changeType, currentCount: row.currentCount, nextCount: row.nextCount, notes: row.notes, version: row.version }))
    .sort((a, b) => (maps.week.get(b.weekId)?.startDate ?? "").localeCompare(maps.week.get(a.weekId)?.startDate ?? "") || (maps.area.get(a.areaCodeId)?.sortOrder ?? 0) - (maps.area.get(b.areaCodeId)?.sortOrder ?? 0) || a.changeType.localeCompare(b.changeType));
}
const staffSchema = z.object({ weekId: z.string().uuid(), areaCodeId: z.string().uuid(), changeType: z.enum(["join", "leave"]), currentCount: z.number().int().min(0), nextCount: z.number().int().min(0), notes: z.string().max(10000) });
export async function saveStaffChange(projectId: string, userId: string, input: unknown) {
  const data = staffSchema.parse(input);
  const prisma = getPrisma();
  const existing = await prisma.staffChange.findUnique({ where: { weekId_groupId_changeType: { weekId: data.weekId, groupId: data.areaCodeId, changeType: data.changeType } } });
  const saved = existing
    ? await prisma.staffChange.update({ where: { id: existing.id }, data: { currentCount: data.currentCount, nextCount: data.nextCount, notes: data.notes, version: { increment: 1 } } })
    : await prisma.staffChange.create({ data: { weekId: data.weekId, groupId: data.areaCodeId, changeType: data.changeType, currentCount: data.currentCount, nextCount: data.nextCount, notes: data.notes, createdBy: userId } });
  await writeAuditLog(projectId, userId, `STAFF_CHANGES_${existing ? "UPDATE" : "INSERT"}`, "staff_changes", saved.id, existing ?? null, saved);
  return { id: saved.id };
}

export async function getPortfolioDashboard(projectId: string) {
  const prisma = getPrisma();
  const [weeks, reportCount, progress, staff, items] = await Promise.all([
    listProjectWeeks(projectId),
    prisma.weeklyReport.count({ where: { week: { projectId } } }),
    listWeeklyProgress(projectId),
    prisma.staffChange.findMany({ where: { week: { projectId } } }),
    prisma.item.findMany({ where: { projectId, archivedAt: null }, select: { status: true } }),
  ]);
  const average = progress.length ? Math.round((progress.reduce((sum, row) => sum + row.progress, 0) / progress.length) * 10) / 10 : 0;
  return {
    currentWeek: weeks[0] ?? null, reportCount, averageProgress: average, delayedCount: progress.filter((row) => row.delayed).length,
    currentStaff: staff.reduce((sum, row) => sum + (row.changeType === "join" ? row.currentCount : -row.currentCount), 0),
    nextStaff: staff.reduce((sum, row) => sum + (row.changeType === "join" ? row.nextCount : -row.nextCount), 0),
    openIssues: items.filter((row) => ["registered", "in_progress"].includes(row.status)).length,
  };
}
