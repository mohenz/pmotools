import "server-only";

import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { getMemberRole, isManagerRole } from "@/lib/server/permissions";
import { canViewWorkLog } from "@/lib/domain/work-logs";

const dateValue = (value: string) => new Date(`${value}T00:00:00.000Z`);
const isoDate = (value: Date) => value.toISOString().slice(0, 10);
const statusSchema = z.enum(["IN_PROGRESS", "COMPLETED"]);
const workLogBaseSchema = z.object({
  workDate: z.string().date(),
  groupId: z.string().uuid(),
  wbsNumber: z.string().trim().max(100).default(""),
  status: statusSchema,
  workContent: z.string().trim().min(1).max(5000),
  referenceContent: z.string().trim().max(5000).default(""),
  notes: z.string().trim().max(2000).default(""),
});
export const createWorkLogSchema = workLogBaseSchema;
export const updateWorkLogSchema = workLogBaseSchema.extend({ version: z.number().int().positive() });

export type WorkLogFilters = { q?: string; dateFrom?: string; dateTo?: string; groupId?: string; assigneeId?: string; status?: string; page?: number; pageSize?: number };

export async function hasWorkLogManagementAccess(projectId: string, userId: string) {
  const [role, ledGroup] = await Promise.all([
    getMemberRole(projectId, userId),
    getPrisma().groups.findFirst({ where: { projectId, groupType: "WORK_MODULE", isActive: true, leaderId: userId }, select: { id: true } }),
  ]);
  return isManagerRole(role) || Boolean(ledGroup);
}

export async function getWorkLogManagementOptions(projectId: string, userId: string) {
  const role = await getMemberRole(projectId, userId);
  const manager = isManagerRole(role);
  const groups = await getPrisma().groups.findMany({
    where: { projectId, groupType: "WORK_MODULE", isActive: true, ...(manager ? {} : { leaderId: userId }) },
    select: { id: true, code: true, label: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  if (!groups.length) throw new DomainError("FORBIDDEN", "업무일지 관리 권한이 없습니다.");
  const groupIds = groups.map((group) => group.id);
  const assignees = await getPrisma().user.findMany({
    where: { deletedAt: null, groupMemberships: { some: { groupId: { in: groupIds } } } },
    select: { id: true, userId: true, name: true },
    orderBy: [{ name: "asc" }, { userId: "asc" }],
  });
  return { manager, groups, assignees };
}

export async function listManagedWorkLogs(projectId: string, userId: string, filters: WorkLogFilters = {}) {
  const options = await getWorkLogManagementOptions(projectId, userId);
  const allowedGroupIds = options.groups.map((group) => group.id);
  const groupId = filters.groupId && allowedGroupIds.includes(filters.groupId) ? filters.groupId : undefined;
  const scopedResult = await listWorkLogs(projectId, {
    ...filters,
    groupId,
    assigneeId: filters.assigneeId,
    pageSize: filters.pageSize,
  }, groupId ? undefined : allowedGroupIds);
  return { result: scopedResult, options };
}

async function assertWorkGroup(projectId: string, groupId: string) {
  const group = await getPrisma().groups.findFirst({ where: { id: groupId, projectId, groupType: "WORK_MODULE", isActive: true }, select: { id: true } });
  if (!group) throw new DomainError("INVALID_CODE", "유효한 업무그룹을 선택해 주세요.");
}

export async function getWorkLogIdentity(projectId: string, userId: string) {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { name: true, userId: true, groupMemberships: { where: { group: { projectId, groupType: "WORK_MODULE", isActive: true } }, select: { group: { select: { id: true, label: true, code: true } } }, take: 1 } },
  });
  if (!user) throw new DomainError("NOT_FOUND", "사용자 정보를 찾을 수 없습니다.");
  const group = user.groupMemberships[0]?.group ?? null;
  return { userId, loginId: user.userId, name: user.name, group };
}

export async function listWorkLogs(projectId: string, filters: WorkLogFilters = {}, allowedGroupIds?: string[]) {
  const page = Math.max(1, filters.page || 1), pageSize = Math.min(100, Math.max(1, filters.pageSize || 30));
  const q = filters.q?.trim() ?? "";
  const workDate = { ...(filters.dateFrom ? { gte: dateValue(filters.dateFrom) } : {}), ...(filters.dateTo ? { lte: dateValue(filters.dateTo) } : {}) };
  const where = {
    projectId,
    ...(Object.keys(workDate).length ? { workDate } : {}),
    ...(filters.groupId ? { groupId: filters.groupId } : allowedGroupIds ? { groupId: { in: allowedGroupIds } } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(statusSchema.safeParse(filters.status).success ? { status: filters.status as "IN_PROGRESS" | "COMPLETED" } : {}),
    ...(q ? { OR: [
      { displayId: { contains: q, mode: "insensitive" as const } },
      { wbsNumber: { contains: q, mode: "insensitive" as const } },
      { workContent: { contains: q, mode: "insensitive" as const } },
      { referenceContent: { contains: q, mode: "insensitive" as const } },
      { notes: { contains: q, mode: "insensitive" as const } },
    ] } : {}),
  };
  const prisma = getPrisma();
  const [rows, total] = await Promise.all([
    prisma.workLog.findMany({ where, include: { group: true, assignee: true }, orderBy: [{ workDate: "desc" }, { displayId: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.workLog.count({ where }),
  ]);
  return {
    rows: rows.map((row) => ({ id: row.id, displayId: row.displayId, workDate: isoDate(row.workDate), groupId: row.groupId, groupLabel: row.group.label, assigneeId: row.assigneeId, assigneeName: row.assignee.name, wbsNumber: row.wbsNumber, status: row.status, workContent: row.workContent, updatedAt: row.updatedAt.toISOString() })),
    total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getWorkLogDetail(projectId: string, id: string, viewerUserId: string) {
  const row = await getPrisma().workLog.findFirst({ where: { id, projectId }, include: { group: true, assignee: true } });
  if (!row) return null;
  const role = await getMemberRole(projectId, viewerUserId);
  const canView = canViewWorkLog({ viewerUserId, assigneeId: row.assigneeId, groupLeaderId: row.group.leaderId, manager: isManagerRole(role) });
  if (!canView) return null;
  return { id: row.id, displayId: row.displayId, workDate: isoDate(row.workDate), groupId: row.groupId, groupLabel: row.group.label, assigneeId: row.assigneeId, assigneeName: row.assignee.name, assigneeUserId: row.assignee.userId, wbsNumber: row.wbsNumber, status: row.status, workContent: row.workContent, referenceContent: row.referenceContent, notes: row.notes, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), editable: row.assigneeId === viewerUserId };
}

export async function createWorkLog(projectId: string, userId: string, input: unknown) {
  const data = createWorkLogSchema.parse(input);
  const identity = await getWorkLogIdentity(projectId, userId);
  if (!identity.group) throw new DomainError("INVALID_CODE", "사용자 관리에서 업무그룹을 먼저 지정해 주세요.");
  if (data.groupId !== identity.group.id) throw new DomainError("FORBIDDEN", "본인에게 지정된 업무그룹으로만 업무일지를 작성할 수 있습니다.");
  await assertWorkGroup(projectId, data.groupId);
  const prisma = getPrisma();
  const row = await prisma.$transaction(async (tx) => {
    const sequence = await tx.workLogSequence.upsert({ where: { projectId }, create: { projectId, value: 1 }, update: { value: { increment: 1 } } });
    return tx.workLog.create({ data: { displayId: `WL-${data.workDate.slice(0, 4)}-${String(sequence.value).padStart(6, "0")}`, projectId, assigneeId: userId, workDate: dateValue(data.workDate), groupId: data.groupId, wbsNumber: data.wbsNumber, status: data.status, workContent: data.workContent, referenceContent: data.referenceContent, notes: data.notes } });
  });
  await writeAuditLog(projectId, userId, "WORK_LOG_INSERT", "work_logs", row.id, null, { displayId: row.displayId, workDate: data.workDate });
  return { id: row.id, displayId: row.displayId };
}

export async function updateWorkLog(projectId: string, userId: string, id: string, input: unknown) {
  const data = updateWorkLogSchema.parse(input);
  await assertWorkGroup(projectId, data.groupId);
  const prisma = getPrisma();
  const current = await prisma.workLog.findFirst({ where: { id, projectId } });
  if (!current) throw new DomainError("NOT_FOUND", "업무일지를 찾을 수 없습니다.");
  if (current.assigneeId !== userId) throw new DomainError("FORBIDDEN", "본인이 작성한 업무일지만 수정할 수 있습니다.");
  if (current.version !== data.version) throw new DomainError("VERSION_CONFLICT", "다른 화면에서 먼저 수정했습니다. 다시 확인해 주세요.");
  const row = await prisma.workLog.update({ where: { id }, data: { workDate: dateValue(data.workDate), groupId: data.groupId, wbsNumber: data.wbsNumber, status: data.status, workContent: data.workContent, referenceContent: data.referenceContent, notes: data.notes, version: { increment: 1 } } });
  await writeAuditLog(projectId, userId, "WORK_LOG_UPDATE", "work_logs", row.id, current, data);
  return { id: row.id, version: row.version };
}

export type WorkLogListResult = Awaited<ReturnType<typeof listWorkLogs>>;
export type WorkLogDetail = NonNullable<Awaited<ReturnType<typeof getWorkLogDetail>>>;
