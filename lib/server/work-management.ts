import "server-only";
import { z } from "zod";
import { unstable_cache, revalidateTag } from "next/cache";
import type { CommonCode } from "@/lib/server/common-codes";
import { getCodeOptions } from "@/lib/server/common-codes";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { portfolioTag } from "@/lib/server/cache-tags";
import { assertManager, getMemberRole, isManagerRole } from "@/lib/server/permissions";
import { calculateWeeklyReportPeriod, inferWeekOfMonth, weeklyReportName } from "@/lib/domain/weekly-reports";

const weeksTag = (projectId: string) => `weeks:${projectId}`;

export type ProjectWeek = { id: string; weekKey: string; label: string; startDate: string; endDate: string; status: "open" | "closed" };
export type WeeklyReport = { id: string; weekId: string; weekLabel: string; areaCodeId: string; areaLabel: string; achievements: string; nextPlan: string; issues: string; decisions: string; notes: string; version: number };
export type WeeklyReportSummary = {
  id: string; label: string; reportName: string; year: number; month: number; weekOfMonth: number;
  actualStart: string; actualEnd: string; planStart: string; planEnd: string;
  status: "open" | "closed"; moduleCount: number; completedCount: number; createdAt: string;
};
export type WeeklyReportDetail = WeeklyReportSummary & {
  reports: Array<WeeklyReport & { canEdit: boolean }>;
  canManage: boolean;
};
export type WeeklyReportListResult = { rows: WeeklyReportSummary[]; total: number; page: number; pageSize: number; pageCount: number };
export type ProgressRow = { id: string; weekId: string; weekLabel: string; areaCodeId: string; areaLabel: string; taskName: string; planDetail: string; planTargetDate: string | null; actualDetail: string; actualDate: string | null; progress: number; nextPlan: string; nextTargetDate: string | null; notes: string; version: number; delayed: boolean };
export type StaffChange = { id: string; weekId: string; weekLabel: string; areaCodeId: string; areaLabel: string; changeType: "join" | "leave"; currentCount: number; nextCount: number; notes: string; version: number };
export type ActivityLog = { id: string; action: string; actorName: string | null; createdAt: string; beforeData: Record<string, unknown> | null; afterData: Record<string, unknown> | null };

const dateStr = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

const toProjectWeek = (week: { id: string; weekKey: string; label: string; startDate: Date; endDate: Date; status: "open" | "closed" }): ProjectWeek =>
  ({ id: week.id, weekKey: week.weekKey, label: week.label, startDate: dateStr(week.startDate)!, endDate: dateStr(week.endDate)!, status: week.status });

async function loadProjectWeeks(projectId: string): Promise<ProjectWeek[]> {
  const weeks = await getPrisma().week.findMany({ where: { projectId }, orderBy: { startDate: "desc" } });
  return weeks.map(toProjectWeek);
}

// 주차 목록은 캘린더·업무 폼 등에서 반복 조회하는 읽기 중심 데이터라 30초 캐시하고, 등록/마감 시 즉시 무효화한다.
export function listProjectWeeks(projectId: string): Promise<ProjectWeek[]> {
  return unstable_cache(loadProjectWeeks, ["project-weeks"], { tags: [weeksTag(projectId)], revalidate: 30 })(projectId);
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
  revalidateTag(weeksTag(projectId));
  return { id: week.id, weekKey: week.weekKey, label: week.label, startDate: data.startDate, endDate: data.endDate, status: "open" as const };
}
export async function updateProjectWeekStatus(projectId: string, id: string, status: unknown) {
  const value = z.enum(["open", "closed"]).parse(status);
  const prisma = getPrisma();
  const current = await prisma.week.findUnique({ where: { id } });
  if (!current || current.projectId !== projectId) throw new DomainError("NOT_FOUND", "프로젝트 주차를 찾을 수 없습니다.");
  const updated = await prisma.week.update({ where: { id }, data: { status: value } });
  await writeAuditLog(projectId, null, "PROJECT_WEEKS_UPDATE", "weeks", id, current, updated);
  revalidateTag(weeksTag(projectId));
  return { id, weekKey: current.weekKey, label: current.label, startDate: dateStr(current.startDate)!, endDate: dateStr(current.endDate)!, status: value };
}
const weekEditSchema = z.object({ label: z.string().trim().min(1).max(50), startDate: z.string().date(), endDate: z.string().date() }).superRefine((d, ctx) => { if (d.endDate < d.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "종료일은 시작일 이후여야 합니다." }); });
export async function updateProjectWeek(projectId: string, id: string, input: unknown) {
  const data = weekEditSchema.parse(input);
  const prisma = getPrisma();
  const current = await prisma.week.findUnique({ where: { id } });
  if (!current || current.projectId !== projectId) throw new DomainError("NOT_FOUND", "프로젝트 주차를 찾을 수 없습니다.");
  const updated = await prisma.week.update({ where: { id }, data: { label: data.label, startDate: new Date(data.startDate), endDate: new Date(data.endDate) } });
  await writeAuditLog(projectId, null, "PROJECT_WEEKS_UPDATE", "weeks", id, current, updated);
  revalidateTag(weeksTag(projectId));
  return toProjectWeek(updated);
}
export async function deleteProjectWeek(projectId: string, id: string) {
  const prisma = getPrisma();
  const current = await prisma.week.findUnique({ where: { id } });
  if (!current || current.projectId !== projectId) throw new DomainError("NOT_FOUND", "프로젝트 주차를 찾을 수 없습니다.");
  const [reportCount, progressCount, staffCount] = await Promise.all([
    prisma.weeklyReport.count({ where: { weekId: id } }),
    prisma.weeklyProgress.count({ where: { weekId: id } }),
    prisma.staffChange.count({ where: { weekId: id } }),
  ]);
  if (reportCount || progressCount || staffCount) throw new DomainError("INVALID_STATE", "해당 주차에 등록된 주간보고·실적·인력변동 데이터가 있어 삭제할 수 없습니다.");
  await prisma.week.delete({ where: { id } });
  await writeAuditLog(projectId, null, "PROJECT_WEEKS_DELETE", "weeks", id, current, null);
  revalidateTag(weeksTag(projectId));
  return { id };
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

// 주차/그룹 라벨은 관계 include로 함께 읽고, 필터·정렬은 Prisma가 처리한다(전체 로드 후 JS 필터 금지).
const weekScope = (projectId: string, weekId?: string) => ({ week: { projectId }, ...(weekId ? { weekId } : {}) });
const weekGroupInclude = { week: true, group: true } as const;
const weekGroupOrder = [{ week: { startDate: "desc" } }, { group: { sortOrder: "asc" } }] as const;

export async function listWeeklyReports(projectId: string, weekId?: string): Promise<WeeklyReport[]> {
  const records = await getPrisma().weeklyReport.findMany({ where: weekScope(projectId, weekId), include: weekGroupInclude, orderBy: [...weekGroupOrder] });
  return records.map((row) => ({ id: row.id, weekId: row.weekId, weekLabel: row.week.label, areaCodeId: row.groupId, areaLabel: row.group.label, achievements: row.achievements, nextPlan: row.nextPlan, issues: row.issues, decisions: row.decisions, notes: row.notes, version: row.version }));
}

const reportSummary = (week: {
  id: string; label: string; startDate: Date; endDate: Date; status: "open" | "closed"; createdAt: Date;
  project: { name: string }; reports: Array<{ achievements: string; nextPlan: string; issues: string }>;
}): WeeklyReportSummary => {
  const planStart = dateStr(week.startDate)!;
  const planEnd = dateStr(week.endDate)!;
  const start = new Date(`${planStart}T00:00:00.000Z`);
  const actualStartDate = new Date(start); actualStartDate.setUTCDate(start.getUTCDate() - 7);
  const actualEndDate = new Date(start); actualEndDate.setUTCDate(start.getUTCDate() - 3);
  return {
    id: week.id,
    label: week.label,
    reportName: weeklyReportName(week.label, week.project.name),
    year: start.getUTCFullYear(),
    month: start.getUTCMonth() + 1,
    weekOfMonth: inferWeekOfMonth(planStart),
    actualStart: dateStr(actualStartDate)!, actualEnd: dateStr(actualEndDate)!, planStart, planEnd,
    status: week.status,
    moduleCount: week.reports.length,
    completedCount: week.reports.filter((row) => row.achievements.trim() && row.nextPlan.trim()).length,
    createdAt: week.createdAt.toISOString(),
  };
};

export async function listWeeklyReportSummaries(projectId: string, filters: { q?: string; page?: number; pageSize?: number } = {}): Promise<WeeklyReportListResult> {
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 10));
  const q = filters.q?.trim() ?? "";
  const where = { projectId, reports: { some: {} }, ...(q ? { OR: [{ label: { contains: q, mode: "insensitive" as const } }, { project: { name: { contains: q, mode: "insensitive" as const } } }] } : {}) };
  const prisma = getPrisma();
  const total = await prisma.week.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageCount, Math.max(1, filters.page ?? 1));
  const weeks = await prisma.week.findMany({
    where, include: { project: { select: { name: true } }, reports: { select: { achievements: true, nextPlan: true, issues: true } } },
    orderBy: { startDate: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
  });
  return { rows: weeks.map(reportSummary), total, page, pageSize, pageCount };
}

const generationSchema = z.object({ year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12), weekOfMonth: z.number().int().min(1).max(5) });
export async function generateWeeklyReport(projectId: string, userId: string, input: unknown) {
  await assertManager(projectId, userId);
  const data = generationSchema.parse(input);
  let period;
  try { period = calculateWeeklyReportPeriod(data.year, data.month, data.weekOfMonth); }
  catch (error) { throw new DomainError("INVALID_STATE", error instanceof Error ? error.message : "리포트 기간을 계산할 수 없습니다."); }
  const prisma = getPrisma();
  const generated = await prisma.$transaction(async (tx) => {
    const modules = await tx.groups.findMany({
      where: { projectId, groupType: "WORK_MODULE", isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    if (!modules.length) throw new DomainError("INVALID_STATE", "활성 업무그룹을 먼저 등록해 주세요.");

    const existing = await tx.week.findUnique({ where: { projectId_weekKey: { projectId, weekKey: period.weekKey } } });
    if (existing?.status === "closed") throw new DomainError("INVALID_STATE", "PM 확인이 완료된 리포트입니다. 먼저 확인을 취소해 주세요.");
    if (existing) throw new DomainError("INVALID_STATE", `${period.label} 위클리리포트는 이미 생성되어 있습니다. 목록에서 기존 리포트를 확인해 주세요.`);

    const week = await tx.week.create({ data: { projectId, weekKey: period.weekKey, label: period.label, startDate: new Date(period.planStart), endDate: new Date(period.planEnd), status: "open" } });
    await tx.weeklyReport.createMany({ data: modules.map((module) => ({ weekId: week.id, groupId: module.id, createdBy: userId })) });
    return { week, moduleCount: modules.length };
  });
  await writeAuditLog(projectId, userId, "WEEKLY_REPORTS_GENERATE", "weeks", generated.week.id, null, { ...generated.week, moduleCount: generated.moduleCount });
  revalidateTag(weeksTag(projectId));
  revalidateTag(portfolioTag(projectId));
  return { id: generated.week.id };
}

export async function getWeeklyReportDetail(projectId: string, userId: string, weekId: string): Promise<WeeklyReportDetail> {
  const prisma = getPrisma();
  const [week, role, mappings] = await Promise.all([
    prisma.week.findFirst({ where: { id: weekId, projectId, reports: { some: {} } }, include: { project: { select: { name: true } }, reports: { include: { group: true }, orderBy: { group: { sortOrder: "asc" } } } } }),
    getMemberRole(projectId, userId),
    prisma.userGroupMap.findMany({ where: { userId, group: { projectId } }, select: { groupId: true } }),
  ]);
  if (!week) throw new DomainError("NOT_FOUND", "위클리리포트를 찾을 수 없습니다.");
  const canManage = isManagerRole(role);
  const assigned = new Set(mappings.map((row) => row.groupId));
  const summary = reportSummary(week);
  return {
    ...summary,
    canManage,
    reports: week.reports.map((row) => ({
      id: row.id, weekId: row.weekId, weekLabel: week.label, areaCodeId: row.groupId, areaLabel: row.group.label,
      achievements: row.achievements, nextPlan: row.nextPlan, issues: row.issues, decisions: row.decisions, notes: row.notes, version: row.version,
      canEdit: week.status === "open" && (canManage || assigned.has(row.groupId)),
    })),
  };
}

const reportSchema = z.object({ weekId: z.string().uuid(), areaCodeId: z.string().uuid(), achievements: z.string().max(2000), nextPlan: z.string().max(2000), issues: z.string().max(2000), decisions: z.string().max(2000).default(""), notes: z.string().max(2000).default("") });
export async function saveWeeklyReport(projectId: string, userId: string, input: unknown) {
  const data = reportSchema.parse(input);
  const prisma = getPrisma();
  const [week, group, role, assignment] = await Promise.all([
    prisma.week.findFirst({ where: { id: data.weekId, projectId } }),
    prisma.groups.findFirst({ where: { id: data.areaCodeId, projectId, groupType: "WORK_MODULE" } }),
    getMemberRole(projectId, userId),
    prisma.userGroupMap.findUnique({ where: { userId_groupId: { userId, groupId: data.areaCodeId } } }),
  ]);
  if (!week || !group) throw new DomainError("NOT_FOUND", "리포트 주차 또는 업무그룹을 찾을 수 없습니다.");
  if (week.status === "closed") throw new DomainError("INVALID_STATE", "PM 확인이 완료되어 수정할 수 없습니다.");
  if (!isManagerRole(role) && !assignment) throw new DomainError("FORBIDDEN", "담당 업무그룹만 수정할 수 있습니다.");
  const existing = await prisma.weeklyReport.findUnique({ where: { weekId_groupId: { weekId: data.weekId, groupId: data.areaCodeId } } });
  if (!existing) throw new DomainError("NOT_FOUND", "생성된 업무그룹 리포트를 찾을 수 없습니다.");
  const saved = existing
    ? await prisma.weeklyReport.update({ where: { id: existing.id }, data: { achievements: data.achievements, nextPlan: data.nextPlan, issues: data.issues, decisions: data.decisions, notes: data.notes, version: { increment: 1 } } })
    : existing;
  await writeAuditLog(projectId, userId, "WEEKLY_REPORTS_UPDATE", "weekly_reports", saved.id, existing, saved);
  revalidateTag(portfolioTag(projectId));
  return { id: saved.id };
}

export async function deleteWeeklyReport(projectId: string, userId: string, weekId: string) {
  await assertManager(projectId, userId);
  const prisma = getPrisma();
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.week.findFirst({
      where: { id: weekId, projectId, reports: { some: {} } },
      include: {
        project: { select: { name: true } },
        reports: { select: { id: true } },
        _count: { select: { progress: true, staffChanges: true } },
      },
    });
    if (!current) throw new DomainError("NOT_FOUND", "위클리리포트를 찾을 수 없습니다.");

    const deleted = await tx.weeklyReport.deleteMany({ where: { weekId } });
    const weekDeleted = current._count.progress === 0 && current._count.staffChanges === 0;
    if (weekDeleted) await tx.week.delete({ where: { id: weekId } });

    return { current, count: deleted.count, weekDeleted };
  });
  await writeAuditLog(projectId, userId, "WEEKLY_REPORTS_DELETE", "weeks", weekId, {
    weekLabel: result.current.label,
    projectName: result.current.project.name,
    reportCount: result.current.reports.length,
    weekDeleted: result.weekDeleted,
  }, null);
  revalidateTag(weeksTag(projectId));
  revalidateTag(portfolioTag(projectId));
  return { id: weekId, count: result.count, weekDeleted: result.weekDeleted };
}

export async function updateWeeklyReportStatus(projectId: string, userId: string, weekId: string, status: unknown) {
  await assertManager(projectId, userId);
  const value = z.enum(["open", "closed"]).parse(status);
  const prisma = getPrisma();
  const current = await prisma.week.findFirst({ where: { id: weekId, projectId, reports: { some: {} } } });
  if (!current) throw new DomainError("NOT_FOUND", "위클리리포트를 찾을 수 없습니다.");
  const updated = await prisma.week.update({ where: { id: weekId }, data: { status: value } });
  await writeAuditLog(projectId, userId, value === "closed" ? "WEEKLY_REPORTS_CONFIRM" : "WEEKLY_REPORTS_REOPEN", "weeks", weekId, current, updated);
  revalidateTag(weeksTag(projectId));
  return { id: weekId, status: value };
}

export async function listWeeklyProgress(projectId: string, weekId?: string): Promise<ProgressRow[]> {
  const records = await getPrisma().weeklyProgress.findMany({ where: weekScope(projectId, weekId), include: weekGroupInclude, orderBy: [...weekGroupOrder] });
  const today = new Date().toISOString().slice(0, 10);
  return records.map((row) => {
    const planTargetDate = dateStr(row.planTargetDate);
    return { id: row.id, weekId: row.weekId, weekLabel: row.week.label, areaCodeId: row.groupId, areaLabel: row.group.label, taskName: row.taskName, planDetail: row.planDetail, planTargetDate, actualDetail: row.actualDetail, actualDate: dateStr(row.actualDate), progress: row.progress, nextPlan: row.nextPlan, nextTargetDate: dateStr(row.nextTargetDate), notes: row.notes, version: row.version, delayed: row.progress < 100 && Boolean(planTargetDate && planTargetDate < today) };
  });
}
const progressSchema = z.object({ weekId: z.string().uuid(), areaCodeId: z.string().uuid(), taskName: z.string().trim().min(1).max(200), planDetail: z.string().max(10000), planTargetDate: z.string().date().nullable(), actualDetail: z.string().max(10000), actualDate: z.string().date().nullable(), progress: z.number().int().min(0).max(100), nextPlan: z.string().max(10000), nextTargetDate: z.string().date().nullable(), notes: z.string().max(10000) });
export async function createProgress(projectId: string, userId: string, input: unknown) {
  const data = progressSchema.parse(input);
  const row = await getPrisma().weeklyProgress.create({ data: { weekId: data.weekId, groupId: data.areaCodeId, taskName: data.taskName, planDetail: data.planDetail, planTargetDate: data.planTargetDate ? new Date(data.planTargetDate) : null, actualDetail: data.actualDetail, actualDate: data.actualDate ? new Date(data.actualDate) : null, progress: data.progress, nextPlan: data.nextPlan, nextTargetDate: data.nextTargetDate ? new Date(data.nextTargetDate) : null, notes: data.notes, createdBy: userId } });
  await writeAuditLog(projectId, userId, "WEEKLY_PROGRESS_INSERT", "weekly_progress", row.id, null, row);
  revalidateTag(portfolioTag(projectId));
  return { id: row.id };
}
export async function updateProgress(projectId: string, id: string, input: unknown) {
  const data = progressSchema.parse(input);
  const prisma = getPrisma();
  const current = await prisma.weeklyProgress.findUnique({ where: { id } });
  if (!current) throw new DomainError("NOT_FOUND", "주간실적을 찾을 수 없습니다.");
  const updated = await prisma.weeklyProgress.update({ where: { id }, data: { weekId: data.weekId, groupId: data.areaCodeId, taskName: data.taskName, planDetail: data.planDetail, planTargetDate: data.planTargetDate ? new Date(data.planTargetDate) : null, actualDetail: data.actualDetail, actualDate: data.actualDate ? new Date(data.actualDate) : null, progress: data.progress, nextPlan: data.nextPlan, nextTargetDate: data.nextTargetDate ? new Date(data.nextTargetDate) : null, notes: data.notes, version: { increment: 1 } } });
  await writeAuditLog(projectId, null, "WEEKLY_PROGRESS_UPDATE", "weekly_progress", id, current, updated);
  revalidateTag(portfolioTag(projectId));
  return { id };
}

export async function listStaffChanges(projectId: string, weekId?: string): Promise<StaffChange[]> {
  const records = await getPrisma().staffChange.findMany({ where: weekScope(projectId, weekId), include: weekGroupInclude, orderBy: [...weekGroupOrder, { changeType: "asc" }] });
  return records.map((row) => ({ id: row.id, weekId: row.weekId, weekLabel: row.week.label, areaCodeId: row.groupId, areaLabel: row.group.label, changeType: row.changeType, currentCount: row.currentCount, nextCount: row.nextCount, notes: row.notes, version: row.version }));
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
  revalidateTag(portfolioTag(projectId));
  return { id: saved.id };
}

async function loadPortfolioDashboard(projectId: string) {
  const prisma = getPrisma();
  const scope = { week: { projectId } };
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const [currentWeek, reportCount, progressAvg, delayedCount, staffTotals, openIssues] = await Promise.all([
    prisma.week.findFirst({ where: { projectId }, orderBy: { startDate: "desc" } }),
    prisma.weeklyReport.count({ where: scope }),
    prisma.weeklyProgress.aggregate({ where: scope, _avg: { progress: true } }),
    prisma.weeklyProgress.count({ where: { ...scope, progress: { lt: 100 }, planTargetDate: { lt: today } } }),
    prisma.staffChange.groupBy({ by: ["changeType"], where: scope, _sum: { currentCount: true, nextCount: true } }),
    prisma.issue.count({ where: { projectId, archivedAt: null, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);
  const signedSum = (field: "currentCount" | "nextCount") =>
    staffTotals.reduce((sum, row) => sum + (row.changeType === "join" ? 1 : -1) * (row._sum[field] ?? 0), 0);
  return {
    currentWeek: currentWeek ? toProjectWeek(currentWeek) : null, reportCount,
    averageProgress: Math.round((progressAvg._avg.progress ?? 0) * 10) / 10, delayedCount,
    currentStaff: signedSum("currentCount"), nextStaff: signedSum("nextCount"), openIssues,
  };
}

// 통합 대시보드 KPI는 변동 빈도가 낮으므로 15초 캐시한다. 이슈/실적/보고/인력변동 저장 시 revalidateTag로 무효화한다.
export function getPortfolioDashboard(projectId: string) {
  return unstable_cache(loadPortfolioDashboard, ["portfolio-dashboard"], { tags: [portfolioTag(projectId)], revalidate: 15 })(projectId);
}
export type PortfolioDashboard = Awaited<ReturnType<typeof loadPortfolioDashboard>>;
