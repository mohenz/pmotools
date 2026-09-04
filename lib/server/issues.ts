import "server-only";

import { z } from "zod";
import { revalidateTag } from "next/cache";
import { actorNameOf, getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { getMemberRole, isManagerRole } from "@/lib/server/permissions";
import type { Issue as PrismaIssue, IssueProgress as PrismaIssueProgress, Prisma } from "@/lib/generated/prisma/client";
import { DomainError } from "@/lib/server/errors";
import { portfolioTag } from "@/lib/server/cache-tags";

export { DomainError };

const levelSchema = z.enum(["low", "medium", "high"]), statusSchema = z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]);

// 이슈진행정보(DETAIL) 하나가 곧 이슈의 전체 정보 스냅샷이다 — 등록 화면과 같은 필드 구성.
const snapshotFieldsSchema = z.object({
  categoryCodeId: z.string().uuid(), title: z.string().trim().min(1).max(200), description: z.string().trim().max(10000).default(""),
  importance: levelSchema, priority: levelSchema, dueAt: z.string().trim().optional(),
  ownerUserId: z.string().uuid().optional(), responseContent: z.string().trim().max(10000).default(""),
  escalated: z.boolean().default(false), reportLineCodeIds: z.array(z.string().uuid()).default([]), remark: z.string().trim().max(2000).default(""),
}).refine((data) => !data.escalated || data.reportLineCodeIds.length > 0, { message: "에스컬레이션을 수행하면 보고라인을 하나 이상 선택해야 합니다.", path: ["reportLineCodeIds"] });
export const createIssueSchema = z.object({ occurredAt: z.string().trim().min(1) }).and(snapshotFieldsSchema);
export const progressEntrySchema = z.object({ entryDate: z.string().trim().min(1), status: statusSchema }).and(snapshotFieldsSchema);
export const archiveSchema = z.object({ version: z.number().int().positive() });

export type IssueProgressRow = {
  id: string; entryDate: string; status: "OPEN" | "IN_PROGRESS" | "CLOSED"; categoryCodeId: string; categoryLabel: string; title: string; description: string;
  importance: "low" | "medium" | "high"; priority: "low" | "medium" | "high"; dueAt: string | null; ownerUserId: string | null; ownerName: string | null;
  responseContent: string; escalated: boolean; reportLineCodeIds: string[]; reportLineLabels: string[]; remark: string; actorName: string | null; createdAt: string;
};
export type IssueRow = {
  id: string; displayId: string; seq: number; projectId: string; categoryCodeId: string; categoryLabel: string; title: string; description: string;
  importance: "low" | "medium" | "high"; priority: "low" | "medium" | "high"; status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  occurredAt: string; dueAt: string | null; ownerUserId: string | null; ownerName: string | null; responseContent: string; escalated: boolean;
  reportLineCodeIds: string[]; reportLineLabels: string[]; remark: string; lastModifiedByName: string | null;
  createdAt: string; updatedAt: string; closedAt: string | null; version: number; progressEntries: IssueProgressRow[];
};
export type IssueFilters = { q?: string; categoryCodeId?: string; status?: string; importance?: string; priority?: string; escalated?: boolean; ownerUserId?: string; page?: number; pageSize?: number };

const issueInclude = {
  category: true, reportLines: { include: { reportLineCode: true } },
  progressEntries: { orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }], include: { category: true, reportLines: { include: { reportLineCode: true } } } },
} satisfies Prisma.IssueInclude;
type IssueWithRelations = Prisma.IssueGetPayload<{ include: typeof issueInclude }>;

function toProgressRow(entry: IssueWithRelations["progressEntries"][number]): IssueProgressRow {
  return {
    id: entry.id, entryDate: entry.entryDate.toISOString(), status: entry.status, categoryCodeId: entry.categoryCodeId, categoryLabel: entry.category.label,
    title: entry.title, description: entry.description, importance: entry.importance, priority: entry.priority, dueAt: entry.dueAt?.toISOString() ?? null,
    ownerUserId: entry.ownerUserId, ownerName: entry.ownerName, responseContent: entry.responseContent, escalated: entry.escalated,
    reportLineCodeIds: entry.reportLines.map((rl) => rl.reportLineCodeId), reportLineLabels: entry.reportLines.map((rl) => rl.reportLineCode.label),
    remark: entry.remark, actorName: entry.actorName, createdAt: entry.createdAt.toISOString(),
  } satisfies IssueProgressRow;
}
function toRow(issue: IssueWithRelations): IssueRow {
  return {
    id: issue.id, displayId: issue.displayId, seq: issue.seq, projectId: issue.projectId, categoryCodeId: issue.categoryCodeId, categoryLabel: issue.category.label,
    title: issue.title, description: issue.description, importance: issue.importance, priority: issue.priority, status: issue.status,
    occurredAt: issue.occurredAt.toISOString(), dueAt: issue.dueAt?.toISOString() ?? null, ownerUserId: issue.ownerUserId, ownerName: issue.ownerName,
    responseContent: issue.responseContent, escalated: issue.escalated,
    reportLineCodeIds: issue.reportLines.map((rl) => rl.reportLineCodeId), reportLineLabels: issue.reportLines.map((rl) => rl.reportLineCode.label),
    remark: issue.remark, lastModifiedByName: issue.lastModifiedByName,
    createdAt: issue.createdAt.toISOString(), updatedAt: issue.updatedAt.toISOString(), closedAt: issue.closedAt?.toISOString() ?? null, version: issue.version,
    progressEntries: issue.progressEntries.map(toProgressRow),
  } satisfies IssueRow;
}

export function issueWhere(projectId: string, filters: IssueFilters): Prisma.IssueWhereInput {
  const and: Prisma.IssueWhereInput[] = [];
  const pick = <T extends string>(schema: { options: readonly string[] }, value?: string) => (value && schema.options.includes(value) ? (value as T) : undefined);
  const status = pick<"OPEN" | "IN_PROGRESS" | "CLOSED">(statusSchema, filters.status);
  const importance = pick<"low" | "medium" | "high">(levelSchema, filters.importance);
  const priority = pick<"low" | "medium" | "high">(levelSchema, filters.priority);
  const query = filters.q?.trim();

  if (status) and.push({ status });
  if (importance) and.push({ importance });
  if (priority) and.push({ priority });
  if (filters.categoryCodeId) and.push({ categoryCodeId: filters.categoryCodeId });
  if (filters.ownerUserId) and.push({ ownerUserId: filters.ownerUserId });
  if (filters.escalated !== undefined) and.push({ escalated: filters.escalated });
  if (query) and.push({ OR: [{ title: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }, { ownerName: { contains: query, mode: "insensitive" } }] });

  return { projectId, archivedAt: null, ...(and.length ? { AND: and } : {}) };
}

export async function listIssues(projectId: string, filters: IssueFilters = {}) {
  const prisma = getPrisma();
  const where = issueWhere(projectId, filters);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 30));
  const total = await prisma.issue.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const rows = await prisma.issue.findMany({ where, include: issueInclude, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize });
  return { issues: rows.map(toRow), total, page, pageSize, totalPages };
}
export async function getIssueDetail(projectId: string, issueId: string) {
  const prisma = getPrisma();
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, include: issueInclude });
  if (!issue || issue.projectId !== projectId || issue.archivedAt) return null;
  return { issue: toRow(issue) };
}

async function assertWritePermission(projectId: string, userId: string, issueId?: string, requirePm = false) {
  const prisma = getPrisma();
  const [role, issue] = await Promise.all([getMemberRole(projectId, userId), issueId ? prisma.issue.findUnique({ where: { id: issueId } }) : Promise.resolve(null)]);
  const isManager = isManagerRole(role), owns = issue ? issue.createdBy === userId || issue.ownerUserId === userId : false;
  if (!role || (requirePm ? !isManager : !(isManager || (role === "MEMBER" && (!issueId || owns))))) throw new DomainError("FORBIDDEN", "이 작업을 수행할 권한이 없습니다.");
}
async function assertCommonCode(projectId: string, codeId: string, groupCode: string) {
  const code = await getPrisma().commonCode.findUnique({ where: { id: codeId } });
  if (!code || code.projectId !== projectId || code.groupCode !== groupCode || !code.isActive) throw new DomainError("INVALID_CODE", "선택한 공통코드를 사용할 수 없습니다.");
  return code;
}
async function assertReportLineCodes(projectId: string, codeIds: string[]) {
  await Promise.all(codeIds.map((id) => assertCommonCode(projectId, id, "report_line")));
}
async function resolveOwner(projectId: string, ownerUserId: string | undefined) {
  if (!ownerUserId) return { ownerUserId: null, ownerName: null };
  const member = await getPrisma().projectMember.findFirst({ where: { projectId, userId: ownerUserId }, include: { user: true } });
  if (!member) throw new DomainError("INVALID_CODE", "선택한 담당자를 사용할 수 없습니다.");
  return { ownerUserId, ownerName: member.user.name };
}
function mutationError(issue: PrismaIssue | null, version?: number) {
  if (!issue || issue.archivedAt) throw new DomainError("NOT_FOUND", "이슈를 찾을 수 없습니다.");
  if (version !== undefined && issue.version !== version) throw new DomainError("VERSION_CONFLICT", "다른 사용자가 먼저 수정했습니다. 최신 내용을 다시 확인해 주세요.");
}
function progressEntryError(entry: PrismaIssueProgress | null, issueId: string) {
  if (!entry || entry.issueId !== issueId) throw new DomainError("NOT_FOUND", "진행 이력을 찾을 수 없습니다.");
}
type SnapshotFields = z.infer<typeof snapshotFieldsSchema>;
async function validateSnapshot(projectId: string, data: SnapshotFields) {
  await assertCommonCode(projectId, data.categoryCodeId, "issue_type");
  await assertReportLineCodes(projectId, data.reportLineCodeIds);
  return resolveOwner(projectId, data.ownerUserId);
}
// DETAIL(진행정보) 스냅샷 하나를 MASTER(issues)에 그대로 반영한다 — 진행 이력을 남기는 것이 이슈 정보를 갱신하는 유일한 방법이다.
async function syncIssueFromLatestProgress(tx: Prisma.TransactionClient, issueId: string) {
  const latest = await tx.issueProgress.findFirst({ where: { issueId }, orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }], include: { reportLines: true } });
  if (!latest) throw new DomainError("INVALID_STATE", "이슈에는 진행 이력이 하나 이상 있어야 합니다.");
  await tx.issue.update({ where: { id: issueId }, data: {
    categoryCodeId: latest.categoryCodeId, title: latest.title, description: latest.description, importance: latest.importance, priority: latest.priority,
    dueAt: latest.dueAt, ownerUserId: latest.ownerUserId, ownerName: latest.ownerName, responseContent: latest.responseContent, escalated: latest.escalated, remark: latest.remark,
    status: latest.status, lastModifiedBy: latest.actorId, lastModifiedByName: latest.actorName,
    closedAt: latest.status === "CLOSED" ? latest.updatedAt : null, version: { increment: 1 },
  } });
  await tx.issueReportLine.deleteMany({ where: { issueId } });
  if (latest.reportLines.length) await tx.issueReportLine.createMany({ data: latest.reportLines.map((rl) => ({ issueId, reportLineCodeId: rl.reportLineCodeId })) });
}

export async function createIssue(projectId: string, userId: string, input: unknown) {
  const data = createIssueSchema.parse(input), requestId = crypto.randomUUID();
  await assertWritePermission(projectId, userId);
  const owner = await validateSnapshot(projectId, data);
  const actorName = await actorNameOf(userId);
  const prisma = getPrisma();
  const { issue, displayId } = await prisma.$transaction(async (tx) => {
    const sequence = await tx.issueSequence.upsert({ where: { projectId }, create: { projectId, value: 1 }, update: { value: { increment: 1 } } });
    const displayId = `ISU-${String(sequence.value).padStart(4, "0")}`;
    const issue = await tx.issue.create({ data: {
      displayId, seq: sequence.value, projectId, categoryCodeId: data.categoryCodeId, title: data.title, description: data.description,
      importance: data.importance, priority: data.priority, occurredAt: new Date(data.occurredAt), dueAt: data.dueAt ? new Date(data.dueAt) : null,
      ownerUserId: owner.ownerUserId, ownerName: owner.ownerName, responseContent: data.responseContent, escalated: data.escalated,
      remark: data.remark, createdBy: userId, lastModifiedBy: userId, lastModifiedByName: actorName,
    } });
    if (data.reportLineCodeIds.length) await tx.issueReportLine.createMany({ data: data.reportLineCodeIds.map((reportLineCodeId) => ({ issueId: issue.id, reportLineCodeId })) });
    const progress = await tx.issueProgress.create({ data: {
      issueId: issue.id, entryDate: new Date(data.occurredAt), status: "OPEN", categoryCodeId: data.categoryCodeId, title: data.title, description: data.description,
      importance: data.importance, priority: data.priority, dueAt: data.dueAt ? new Date(data.dueAt) : null, ownerUserId: owner.ownerUserId, ownerName: owner.ownerName,
      responseContent: data.responseContent, escalated: data.escalated, remark: data.remark, actorId: userId, actorName,
    } });
    if (data.reportLineCodeIds.length) await tx.issueProgressReportLine.createMany({ data: data.reportLineCodeIds.map((reportLineCodeId) => ({ progressId: progress.id, reportLineCodeId })) });
    return { issue, displayId };
  });
  await writeAuditLog(projectId, userId, "ISSUE_INSERT", "issues", issue.id, null, { id: issue.id, displayId, title: data.title });
  revalidateTag(portfolioTag(projectId));
  return { id: issue.id, displayId, requestId };
}

// 진행 이력(DETAIL) 추가/수정/삭제 — 이슈 정보를 갱신하는 유일한 경로. 즉시 MASTER에 반영된다.
export async function addProgressEntry(projectId: string, userId: string, issueId: string, input: unknown) {
  const data = progressEntrySchema.parse(input), requestId = crypto.randomUUID();
  await assertWritePermission(projectId, userId, issueId);
  const owner = await validateSnapshot(projectId, data);
  const actorName = await actorNameOf(userId);
  const prisma = getPrisma();
  const before = await prisma.issue.findUnique({ where: { id: issueId } });
  mutationError(before);
  const version = await prisma.$transaction(async (tx) => {
    const progress = await tx.issueProgress.create({ data: {
      issueId, entryDate: new Date(data.entryDate), status: data.status, categoryCodeId: data.categoryCodeId, title: data.title, description: data.description,
      importance: data.importance, priority: data.priority, dueAt: data.dueAt ? new Date(data.dueAt) : null, ownerUserId: owner.ownerUserId, ownerName: owner.ownerName,
      responseContent: data.responseContent, escalated: data.escalated, remark: data.remark, actorId: userId, actorName,
    } });
    if (data.reportLineCodeIds.length) await tx.issueProgressReportLine.createMany({ data: data.reportLineCodeIds.map((reportLineCodeId) => ({ progressId: progress.id, reportLineCodeId })) });
    await syncIssueFromLatestProgress(tx, issueId);
    return (await tx.issue.findUniqueOrThrow({ where: { id: issueId } })).version;
  });
  await writeAuditLog(projectId, userId, "ISSUE_PROGRESS_INSERT", "issue_progress_entries", issueId, null, { title: data.title, status: data.status });
  revalidateTag(portfolioTag(projectId));
  return { version, requestId };
}
export async function updateProgressEntry(projectId: string, userId: string, issueId: string, entryId: string, input: unknown) {
  const data = progressEntrySchema.parse(input), requestId = crypto.randomUUID();
  await assertWritePermission(projectId, userId, issueId);
  const owner = await validateSnapshot(projectId, data);
  const actorName = await actorNameOf(userId);
  const prisma = getPrisma();
  const before = await prisma.issue.findUnique({ where: { id: issueId } });
  mutationError(before);
  const entryBefore = await prisma.issueProgress.findUnique({ where: { id: entryId } });
  progressEntryError(entryBefore, issueId);
  const version = await prisma.$transaction(async (tx) => {
    await tx.issueProgress.update({ where: { id: entryId }, data: {
      entryDate: new Date(data.entryDate), status: data.status, categoryCodeId: data.categoryCodeId, title: data.title, description: data.description,
      importance: data.importance, priority: data.priority, dueAt: data.dueAt ? new Date(data.dueAt) : null, ownerUserId: owner.ownerUserId, ownerName: owner.ownerName,
      responseContent: data.responseContent, escalated: data.escalated, remark: data.remark, actorId: userId, actorName,
    } });
    await tx.issueProgressReportLine.deleteMany({ where: { progressId: entryId } });
    if (data.reportLineCodeIds.length) await tx.issueProgressReportLine.createMany({ data: data.reportLineCodeIds.map((reportLineCodeId) => ({ progressId: entryId, reportLineCodeId })) });
    await syncIssueFromLatestProgress(tx, issueId);
    return (await tx.issue.findUniqueOrThrow({ where: { id: issueId } })).version;
  });
  await writeAuditLog(projectId, userId, "ISSUE_PROGRESS_UPDATE", "issue_progress_entries", entryId, entryBefore, { title: data.title, status: data.status });
  revalidateTag(portfolioTag(projectId));
  return { version, requestId };
}
export async function deleteProgressEntry(projectId: string, userId: string, issueId: string, entryId: string) {
  const requestId = crypto.randomUUID();
  await assertWritePermission(projectId, userId, issueId, true);
  const prisma = getPrisma();
  const before = await prisma.issue.findUnique({ where: { id: issueId } });
  mutationError(before);
  const entryBefore = await prisma.issueProgress.findUnique({ where: { id: entryId } });
  progressEntryError(entryBefore, issueId);
  const remaining = await prisma.issueProgress.count({ where: { issueId } });
  if (remaining <= 1) throw new DomainError("INVALID_STATE", "마지막 남은 진행 이력은 삭제할 수 없습니다.");
  const version = await prisma.$transaction(async (tx) => {
    await tx.issueProgress.delete({ where: { id: entryId } });
    await syncIssueFromLatestProgress(tx, issueId);
    return (await tx.issue.findUniqueOrThrow({ where: { id: issueId } })).version;
  });
  await writeAuditLog(projectId, userId, "ISSUE_PROGRESS_DELETE", "issue_progress_entries", entryId, entryBefore, null);
  revalidateTag(portfolioTag(projectId));
  return { version, requestId };
}

export async function archiveIssue(projectId: string, userId: string, issueId: string, input: unknown) {
  const data = archiveSchema.parse(input), requestId = crypto.randomUUID();
  await assertWritePermission(projectId, userId, issueId, true);
  const prisma = getPrisma();
  const { before, version } = await prisma.$transaction(async (tx) => {
    const before = await tx.issue.findUnique({ where: { id: issueId } });
    mutationError(before, data.version);
    if (before!.status !== "CLOSED") throw new DomainError("INVALID_STATE", "종결 상태의 이슈만 보관할 수 있습니다. 이슈가 종료되기 전까지는 일련번호가 계속 관리되어야 합니다.");
    const version = data.version + 1;
    await tx.issue.update({ where: { id: issueId }, data: { archivedAt: new Date(), version } });
    return { before, version };
  });
  await writeAuditLog(projectId, userId, "ISSUE_UPDATE", "issues", issueId, before, { archivedAt: new Date().toISOString(), version });
  revalidateTag(portfolioTag(projectId));
  return { version, requestId };
}
