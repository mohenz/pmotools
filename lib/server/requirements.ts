import "server-only";

import { z } from "zod";
import { actorNameOf, getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { getMemberRole, isManagerRole, assertManager } from "@/lib/server/permissions";
import { listCommonCodes } from "@/lib/server/common-codes";
import type { Requirement as PrismaRequirement, Prisma } from "@/lib/generated/prisma/client";
import { DomainError } from "@/lib/server/errors";

export { DomainError };

// 요구사항구분/분류 선택지 — 공통코드 설정(/settings/common-codes)에서 관리자가 등록한 값을 그대로 사용한다.
export async function listRequirementCodeOptions(projectId: string) {
  const codes = await listCommonCodes(projectId, false);
  return {
    divisions: codes.filter((code) => code.groupCode === "requirement_division"),
    categories: codes.filter((code) => code.groupCode === "requirement_category"),
  };
}

const acceptanceSchema = z.enum(["pending", "accepted", "rejected", "deferred"]);
const levelSchema = z.enum(["low", "medium", "high"]);

export const createRequirementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().max(10000).default(""),
  ownerUserId: z.string().uuid().nullable().optional(),
  basis: z.string().trim().max(5000).default(""),
  precondition: z.string().trim().max(5000).default(""),
  resolution: z.string().trim().max(5000).default(""),
  acceptanceStatus: acceptanceSchema.default("pending"),
  requestDepartment: z.string().trim().max(200).default(""),
  divisionCodeId: z.string().uuid().nullable().optional(),
  categoryCodeId: z.string().uuid().nullable().optional(),
  priority: levelSchema.nullable().optional(),
  importance: levelSchema.nullable().optional(),
});
export const updateRequirementSchema = createRequirementSchema.extend({ version: z.number().int().positive() });
export const changeRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  changeReason: z.string().trim().min(1).max(2000),
  proposedTitle: z.string().trim().max(200).nullable().optional(),
  proposedContent: z.string().trim().max(10000).nullable().optional(),
  proposedBasis: z.string().trim().max(5000).nullable().optional(),
  proposedPrecondition: z.string().trim().max(5000).nullable().optional(),
  proposedResolution: z.string().trim().max(5000).nullable().optional(),
  proposedAcceptance: acceptanceSchema.nullable().optional(),
});
export const decideChangeSchema = z.object({ decision: z.enum(["approved", "rejected"]), decisionNote: z.string().trim().max(2000).optional() });

export type RequirementAcceptance = z.infer<typeof acceptanceSchema>;
export type RequirementLevel = z.infer<typeof levelSchema>;
export type RequirementRow = {
  id: string; displayId: string; projectId: string; title: string; content: string;
  ownerUserId: string | null; ownerName: string | null; basis: string; precondition: string; resolution: string;
  acceptanceStatus: RequirementAcceptance; requestDepartment: string;
  divisionCodeId: string | null; divisionLabel: string | null; categoryCodeId: string | null; categoryLabel: string | null;
  priority: RequirementLevel | null; importance: RequirementLevel | null;
  createdBy: string; createdAt: string; updatedAt: string; archivedAt: string | null; version: number;
  changeCount: number;
};
export type RequirementEventRow = {
  id: string; eventType: "created" | "edited" | "archived" | "change_requested" | "change_approved" | "change_rejected";
  actorName: string; body: string | null; beforeData: Record<string, unknown> | null; afterData: Record<string, unknown> | null; createdAt: string;
};
export type RequirementChangeRow = {
  id: string; displayId: string; title: string; projectId: string; requirementId: string; requirementDisplayId: string; requirementTitle: string;
  changeReason: string; proposedTitle: string | null; proposedContent: string | null; proposedBasis: string | null;
  proposedPrecondition: string | null; proposedResolution: string | null; proposedAcceptance: RequirementAcceptance | null;
  status: "pending" | "approved" | "rejected"; requestedBy: string; requestedByName: string; requestedAt: string;
  decidedBy: string | null; decidedByName: string | null; decidedAt: string | null; decisionNote: string | null;
};
export type RequirementFilters = { q?: string; acceptanceStatus?: string; divisionCodeId?: string; priority?: string; importance?: string; page?: number; pageSize?: number };
export type RequirementChangeFilters = { requirementId?: string; status?: string; page?: number; pageSize?: number };

const requirementInclude = { owner: { select: { name: true } }, division: { select: { label: true } }, category: { select: { label: true } } } as const;
type RequirementWithRelations = Prisma.RequirementGetPayload<{ include: typeof requirementInclude }>;
const changeInclude = { requirement: { select: { displayId: true, title: true } }, requester: { select: { name: true } }, decider: { select: { name: true } } } as const;
type ChangeWithRelations = Prisma.RequirementChangeGetPayload<{ include: typeof changeInclude }>;

function toRow(row: RequirementWithRelations, changeCount = 0): RequirementRow {
  return {
    id: row.id, displayId: row.displayId, projectId: row.projectId, title: row.title, content: row.content,
    ownerUserId: row.ownerUserId, ownerName: row.owner?.name ?? null, basis: row.basis, precondition: row.precondition, resolution: row.resolution,
    acceptanceStatus: row.acceptanceStatus, requestDepartment: row.requestDepartment,
    divisionCodeId: row.divisionCodeId, divisionLabel: row.division?.label ?? null, categoryCodeId: row.categoryCodeId, categoryLabel: row.category?.label ?? null,
    priority: row.priority, importance: row.importance,
    createdBy: row.createdBy, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null, version: row.version,
    changeCount,
  } satisfies RequirementRow;
}
function toChangeRow(row: ChangeWithRelations): RequirementChangeRow {
  return {
    id: row.id, displayId: row.displayId, title: row.title, projectId: row.projectId, requirementId: row.requirementId, requirementDisplayId: row.requirement.displayId, requirementTitle: row.requirement.title,
    changeReason: row.changeReason, proposedTitle: row.proposedTitle, proposedContent: row.proposedContent, proposedBasis: row.proposedBasis,
    proposedPrecondition: row.proposedPrecondition, proposedResolution: row.proposedResolution, proposedAcceptance: row.proposedAcceptance,
    status: row.status, requestedBy: row.requestedBy, requestedByName: row.requester.name, requestedAt: row.requestedAt.toISOString(),
    decidedBy: row.decidedBy, decidedByName: row.decider?.name ?? null, decidedAt: row.decidedAt?.toISOString() ?? null, decisionNote: row.decisionNote,
  } satisfies RequirementChangeRow;
}

function requirementWhere(projectId: string, filters: RequirementFilters): Prisma.RequirementWhereInput {
  const and: Prisma.RequirementWhereInput[] = [];
  const status = filters.acceptanceStatus && acceptanceSchema.options.includes(filters.acceptanceStatus as RequirementAcceptance) ? (filters.acceptanceStatus as RequirementAcceptance) : undefined;
  if (status) and.push({ acceptanceStatus: status });
  const query = filters.q?.trim();
  if (query) and.push({ OR: [{ title: { contains: query, mode: "insensitive" } }, { content: { contains: query, mode: "insensitive" } }, { displayId: { contains: query, mode: "insensitive" } }] });
  if (filters.divisionCodeId) and.push({ divisionCodeId: filters.divisionCodeId });
  if (filters.priority && levelSchema.options.includes(filters.priority as RequirementLevel)) and.push({ priority: filters.priority as RequirementLevel });
  if (filters.importance && levelSchema.options.includes(filters.importance as RequirementLevel)) and.push({ importance: filters.importance as RequirementLevel });
  return { projectId, archivedAt: null, ...(and.length ? { AND: and } : {}) };
}
function clampPage(filters: { page?: number; pageSize?: number }, total: number) {
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 20));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  return { pageSize, totalPages, page };
}

export async function listRequirements(projectId: string, filters: RequirementFilters = {}) {
  const prisma = getPrisma();
  const where = requirementWhere(projectId, filters);
  const total = await prisma.requirement.count({ where });
  const { pageSize, totalPages, page } = clampPage(filters, total);
  const rows = await prisma.requirement.findMany({ where, include: requirementInclude, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize });
  const changeCounts = rows.length ? await prisma.requirementChange.groupBy({ by: ["requirementId"], where: { requirementId: { in: rows.map((row) => row.id) } }, _count: { id: true } }) : [];
  const changeCountByRequirement = new Map(changeCounts.map((entry) => [entry.requirementId, entry._count.id]));
  return { requirements: rows.map((row) => toRow(row, changeCountByRequirement.get(row.id) ?? 0)), total, page, pageSize, totalPages };
}

export async function getRequirementDetail(projectId: string, requirementId: string) {
  const prisma = getPrisma();
  const requirement = await prisma.requirement.findUnique({ where: { id: requirementId }, include: requirementInclude });
  if (!requirement || requirement.projectId !== projectId || requirement.archivedAt) return null;
  const [events, changes] = await Promise.all([
    prisma.requirementEvent.findMany({ where: { requirementId }, orderBy: { createdAt: "desc" } }),
    prisma.requirementChange.findMany({ where: { requirementId }, include: changeInclude, orderBy: { requestedAt: "desc" } }),
  ]);
  return {
    requirement: toRow(requirement),
    events: events.map((event) => ({
      id: event.id, eventType: event.eventType, actorName: event.actorName ?? "-", body: event.body,
      beforeData: event.beforeData as Record<string, unknown> | null, afterData: event.afterData as Record<string, unknown> | null,
      createdAt: event.createdAt.toISOString(),
    } satisfies RequirementEventRow)),
    changes: changes.map(toChangeRow),
  };
}

export async function listRequirementChanges(projectId: string, filters: RequirementChangeFilters = {}) {
  const prisma = getPrisma();
  const status = filters.status && ["pending", "approved", "rejected"].includes(filters.status) ? (filters.status as "pending" | "approved" | "rejected") : undefined;
  const where: Prisma.RequirementChangeWhereInput = { projectId, ...(filters.requirementId ? { requirementId: filters.requirementId } : {}), ...(status ? { status } : {}) };
  const total = await prisma.requirementChange.count({ where });
  const { pageSize, totalPages, page } = clampPage(filters, total);
  const rows = await prisma.requirementChange.findMany({ where, include: changeInclude, orderBy: { requestedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize });
  return { changes: rows.map(toChangeRow), total, page, pageSize, totalPages };
}

async function assertProjectMember(projectId: string, userId: string) {
  const role = await getMemberRole(projectId, userId);
  if (!role) throw new DomainError("FORBIDDEN", "프로젝트 구성원만 이용할 수 있습니다.");
  return role;
}
async function assertWritePermission(projectId: string, userId: string, requirementId?: string, requirePm = false) {
  const prisma = getPrisma();
  const [role, requirement] = await Promise.all([getMemberRole(projectId, userId), requirementId ? prisma.requirement.findUnique({ where: { id: requirementId } }) : Promise.resolve(null)]);
  const isManager = isManagerRole(role);
  const owns = requirement ? requirement.createdBy === userId || requirement.ownerUserId === userId : false;
  if (!role || (requirePm ? !isManager : !(isManager || owns))) throw new DomainError("FORBIDDEN", "이 작업을 수행할 권한이 없습니다.");
}
async function assertValidOwner(projectId: string, ownerUserId: string | null | undefined) {
  if (!ownerUserId) return;
  const role = await getMemberRole(projectId, ownerUserId);
  if (!role) throw new DomainError("INVALID_CODE", "선택한 담당자는 이 프로젝트 구성원이 아닙니다.");
}
async function assertCommonCode(projectId: string, codeId: string | null | undefined, groupCode: string, label: string) {
  if (!codeId) return;
  const code = await getPrisma().commonCode.findUnique({ where: { id: codeId } });
  if (!code || code.projectId !== projectId || code.groupCode !== groupCode || !code.isActive) throw new DomainError("INVALID_CODE", `선택한 ${label} 공통코드를 사용할 수 없습니다.`);
}
function mutationError(row: Pick<PrismaRequirement, "archivedAt" | "version"> | null, version: number) {
  if (!row || row.archivedAt) throw new DomainError("NOT_FOUND", "요구사항을 찾을 수 없습니다.");
  if (row.version !== version) throw new DomainError("VERSION_CONFLICT", "다른 사용자가 먼저 수정했습니다. 최신 내용을 다시 확인해 주세요.");
}

export async function createRequirement(projectId: string, userId: string, input: unknown) {
  const data = createRequirementSchema.parse(input), requestId = crypto.randomUUID();
  await assertManager(projectId, userId);
  await assertValidOwner(projectId, data.ownerUserId);
  await Promise.all([
    assertCommonCode(projectId, data.divisionCodeId, "requirement_division", "요구사항구분"),
    assertCommonCode(projectId, data.categoryCodeId, "requirement_category", "요구사항분류"),
  ]);
  const prisma = getPrisma();
  const actorName = await actorNameOf(userId);
  const { requirement, displayId } = await prisma.$transaction(async (tx) => {
    const sequence = await tx.requirementSequence.upsert({ where: { projectId }, create: { projectId, value: 1 }, update: { value: { increment: 1 } } });
    const displayId = `REQ-${new Date().getUTCFullYear()}-${String(sequence.value).padStart(6, "0")}`;
    const requirement = await tx.requirement.create({ data: { displayId, projectId, title: data.title, content: data.content, ownerUserId: data.ownerUserId || null, basis: data.basis, precondition: data.precondition, resolution: data.resolution, acceptanceStatus: data.acceptanceStatus, requestDepartment: data.requestDepartment, divisionCodeId: data.divisionCodeId || null, categoryCodeId: data.categoryCodeId || null, priority: data.priority || null, importance: data.importance || null, createdBy: userId } });
    await tx.requirementEvent.create({ data: { requirementId: requirement.id, eventType: "created", actorId: userId, actorName, body: "신규 등록" } });
    return { requirement, displayId };
  });
  await writeAuditLog(projectId, userId, "REQUIREMENT_INSERT", "requirements", requirement.id, null, { id: requirement.id, displayId, title: data.title });
  return { id: requirement.id, displayId, requestId };
}

export async function updateRequirement(projectId: string, userId: string, requirementId: string, input: unknown) {
  const data = updateRequirementSchema.parse(input), requestId = crypto.randomUUID();
  await assertWritePermission(projectId, userId, requirementId);
  await assertValidOwner(projectId, data.ownerUserId);
  await Promise.all([
    assertCommonCode(projectId, data.divisionCodeId, "requirement_division", "요구사항구분"),
    assertCommonCode(projectId, data.categoryCodeId, "requirement_category", "요구사항분류"),
  ]);
  const prisma = getPrisma();
  const actorName = await actorNameOf(userId);
  const { before, version } = await prisma.$transaction(async (tx) => {
    const before = await tx.requirement.findUnique({ where: { id: requirementId } });
    mutationError(before, data.version);
    const version = data.version + 1;
    const update = { title: data.title, content: data.content, ownerUserId: data.ownerUserId || null, basis: data.basis, precondition: data.precondition, resolution: data.resolution, acceptanceStatus: data.acceptanceStatus, requestDepartment: data.requestDepartment, divisionCodeId: data.divisionCodeId || null, categoryCodeId: data.categoryCodeId || null, priority: data.priority || null, importance: data.importance || null, version };
    await tx.requirement.update({ where: { id: requirementId }, data: update });
    await tx.requirementEvent.create({ data: { requirementId, eventType: "edited", actorId: userId, actorName, body: "기본 정보 수정", beforeData: before as never, afterData: update as never } });
    return { before, version };
  });
  await writeAuditLog(projectId, userId, "REQUIREMENT_UPDATE", "requirements", requirementId, before, { version });
  return { version, requestId };
}

export async function createRequirementChange(projectId: string, userId: string, requirementId: string, input: unknown) {
  const data = changeRequestSchema.parse(input), requestId = crypto.randomUUID();
  await assertManager(projectId, userId);
  const prisma = getPrisma();
  const requirement = await prisma.requirement.findUnique({ where: { id: requirementId } });
  if (!requirement || requirement.projectId !== projectId || requirement.archivedAt) throw new DomainError("NOT_FOUND", "요구사항을 찾을 수 없습니다.");
  const actorName = await actorNameOf(userId);
  const change = await prisma.$transaction(async (tx) => {
    const sequence = await tx.requirementChangeSequence.upsert({ where: { projectId }, create: { projectId, value: 1 }, update: { value: { increment: 1 } } });
    const displayId = `REQ-CHG-${new Date().getUTCFullYear()}-${String(sequence.value).padStart(6, "0")}`;
    const created = await tx.requirementChange.create({ data: { displayId, title: data.title, projectId, requirementId, changeReason: data.changeReason, proposedTitle: data.proposedTitle || null, proposedContent: data.proposedContent || null, proposedBasis: data.proposedBasis || null, proposedPrecondition: data.proposedPrecondition || null, proposedResolution: data.proposedResolution || null, proposedAcceptance: data.proposedAcceptance || null, requestedBy: userId } });
    await tx.requirementEvent.create({ data: { requirementId, eventType: "change_requested", actorId: userId, actorName, body: `${data.title} — ${data.changeReason}` } });
    return created;
  });
  await writeAuditLog(projectId, userId, "REQUIREMENT_CHANGE_INSERT", "requirement_changes", change.id, null, { requirementId, displayId: change.displayId, title: data.title });
  return { id: change.id, displayId: change.displayId, requestId };
}

export async function decideRequirementChange(projectId: string, userId: string, changeId: string, input: unknown) {
  const data = decideChangeSchema.parse(input), requestId = crypto.randomUUID();
  await assertManager(projectId, userId);
  const prisma = getPrisma();
  const actorName = await actorNameOf(userId);
  const result = await prisma.$transaction(async (tx) => {
    const change = await tx.requirementChange.findUnique({ where: { id: changeId } });
    if (!change || change.projectId !== projectId) throw new DomainError("NOT_FOUND", "변경요청을 찾을 수 없습니다.");
    if (change.status !== "pending") throw new DomainError("INVALID_STATE", "이미 처리된 변경요청입니다.");
    const decided = await tx.requirementChange.update({ where: { id: changeId }, data: { status: data.decision, decidedBy: userId, decidedAt: new Date(), decisionNote: data.decisionNote || null } });
    if (data.decision === "approved") {
      const before = await tx.requirement.findUnique({ where: { id: change.requirementId } });
      if (!before || before.archivedAt) throw new DomainError("NOT_FOUND", "요구사항을 찾을 수 없습니다.");
      const update: Prisma.RequirementUpdateInput = { version: { increment: 1 } };
      if (change.proposedTitle !== null) update.title = change.proposedTitle;
      if (change.proposedContent !== null) update.content = change.proposedContent;
      if (change.proposedBasis !== null) update.basis = change.proposedBasis;
      if (change.proposedPrecondition !== null) update.precondition = change.proposedPrecondition;
      if (change.proposedResolution !== null) update.resolution = change.proposedResolution;
      if (change.proposedAcceptance !== null) update.acceptanceStatus = change.proposedAcceptance;
      const after = await tx.requirement.update({ where: { id: change.requirementId }, data: update });
      await tx.requirementEvent.create({ data: { requirementId: change.requirementId, eventType: "change_approved", actorId: userId, actorName, body: `변경요청 승인: ${change.changeReason}`, beforeData: before as never, afterData: after as never } });
    } else {
      await tx.requirementEvent.create({ data: { requirementId: change.requirementId, eventType: "change_rejected", actorId: userId, actorName, body: data.decisionNote || "변경요청 반려" } });
    }
    return decided;
  });
  await writeAuditLog(projectId, userId, `REQUIREMENT_CHANGE_${data.decision.toUpperCase()}`, "requirement_changes", changeId, null, { status: data.decision });
  return { id: result.id, status: result.status, requestId };
}
