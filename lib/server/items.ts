import "server-only";

import { z } from "zod";
import { riskScore } from "@/lib/domain/items";
import { businessDaysSince, getPrisma, nowIso, writeAuditLog } from "@/lib/server/db-pg";
import { getMemberRole, isManagerRole } from "@/lib/server/permissions";
import type { Item as PrismaItem } from "@/lib/generated/prisma/client";
import { DomainError } from "@/lib/server/errors";

export { DomainError };

const kindSchema = z.enum(["issue", "risk"]), probabilitySchema = z.enum(["low", "medium", "high"]), statusSchema = z.enum(["registered", "in_progress", "resolved", "on_hold"]);
export const createItemSchema = z.object({ kind: kindSchema, categoryCodeId: z.string().uuid(), trackCodeId: z.string().uuid(), title: z.string().trim().min(1).max(200), description: z.string().trim().max(10000).default(""), probability: probabilitySchema, impact: probabilitySchema, exposureText: z.string().trim().max(500).optional(), ownerText: z.string().trim().max(100).optional(), escalationCodeId: z.string().uuid().optional() });
export const updateItemSchema = createItemSchema.omit({ kind: true, escalationCodeId: true }).extend({ version: z.number().int().positive() });
export const statusUpdateSchema = z.object({ status: statusSchema, version: z.number().int().positive() });
export const escalationUpdateSchema = z.object({ escalationCodeId: z.string().uuid(), version: z.number().int().positive() });
export const commentSchema = z.object({ body: z.string().trim().min(1).max(5000), version: z.number().int().positive() });
export const archiveSchema = z.object({ version: z.number().int().positive() });

export type ItemRow = { id: string; displayId: string; projectId: string; trackCodeId: string; kind: "issue" | "risk"; categoryCodeId: string; categoryCode: string; categoryLabel: string; title: string; description: string; probability: "low" | "medium" | "high"; impact: "low" | "medium" | "high"; exposureText: string | null; ownerText: string | null; escalationCodeId: string; escalationCode: string; escalationLabel: string; status: "registered" | "in_progress" | "resolved" | "on_hold"; trackName: string; trackCode: string; ownerName: string | null; createdAt: string; updatedAt: string; resolvedAt: string | null; businessDaysIdle: number; isStale: boolean; version: number };
export type ItemEventRow = { id: string; eventType: "created" | "comment" | "status_changed" | "level_changed" | "edited" | "archived"; actorName: string; body: string | null; beforeData: Record<string, unknown> | null; afterData: Record<string, unknown> | null; createdAt: string };
export type ItemFilters = { q?: string; kind?: string; status?: string; category?: string; probability?: string; impact?: string; open?: boolean; stale?: boolean; page?: number; pageSize?: number };

async function enrich(projectId: string, items: PrismaItem[]): Promise<ItemRow[]> {
  const prisma = getPrisma();
  const [codes, groups, project] = await Promise.all([
    prisma.commonCode.findMany({ where: { projectId } }),
    prisma.groups.findMany({ where: { projectId } }),
    prisma.project.findUnique({ where: { id: projectId }, select: { staleBusinessDays: true } }),
  ]);
  const codeMap = new Map(codes.map((code) => [code.id, code]));
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const staleBusinessDays = project?.staleBusinessDays ?? 3;
  return items.map((item) => {
    const category = codeMap.get(item.categoryCodeId), track = groupMap.get(item.groupId), escalation = codeMap.get(item.escalationCodeId);
    const idle = businessDaysSince(item.updatedAt);
    return {
      id: item.id, displayId: item.displayId, projectId: item.projectId, trackCodeId: item.groupId, kind: item.kind,
      categoryCodeId: item.categoryCodeId, categoryCode: category?.code ?? "", categoryLabel: category?.label ?? "-",
      title: item.title, description: item.description, probability: item.kind === "issue" ? "high" : item.probability, impact: item.impact,
      exposureText: item.exposureText, ownerText: item.ownerText, escalationCodeId: item.escalationCodeId,
      escalationCode: escalation?.code ?? "", escalationLabel: escalation?.label ?? "-",
      status: item.status, trackName: track?.label ?? "-", trackCode: track?.code ?? "", ownerName: item.ownerText,
      createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), resolvedAt: item.resolvedAt?.toISOString() ?? null,
      businessDaysIdle: idle, isStale: ["registered", "in_progress"].includes(item.status) && idle >= staleBusinessDays, version: item.version,
    } satisfies ItemRow;
  });
}
function filterItems(items: ItemRow[], filters: ItemFilters) {
  const query = filters.q?.trim().toLocaleLowerCase("ko");
  return items.filter((item) => (!filters.kind || !kindSchema.options.includes(filters.kind as never) || item.kind === filters.kind) && (!filters.status || !statusSchema.options.includes(filters.status as never) || item.status === filters.status) && (!filters.category?.trim() || item.categoryCode === filters.category.trim()) && (!filters.probability || !probabilitySchema.options.includes(filters.probability as never) || item.probability === filters.probability) && (!filters.impact || !probabilitySchema.options.includes(filters.impact as never) || item.impact === filters.impact) && (!filters.open || ["registered", "in_progress"].includes(item.status)) && (!filters.stale || item.isStale) && (!query || `${item.title} ${item.description} ${item.ownerName ?? ""}`.toLocaleLowerCase("ko").includes(query)));
}

export async function listItems(projectId: string, filters: ItemFilters = {}) {
  const prisma = getPrisma();
  const stored = await prisma.item.findMany({ where: { projectId, archivedAt: null } });
  const items = filterItems(await enrich(projectId, stored), filters).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 30)), total = items.length, totalPages = Math.max(1, Math.ceil(total / pageSize)), page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, totalPages };
}
export async function listItemsForExport(projectId: string, filters: ItemFilters = {}) {
  const prisma = getPrisma();
  const stored = await prisma.item.findMany({ where: { projectId, archivedAt: null } });
  return filterItems(await enrich(projectId, stored), filters).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 10000);
}
export async function getItemDetail(projectId: string, itemId: string) {
  const prisma = getPrisma();
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item || item.projectId !== projectId || item.archivedAt) return null;
  const [enriched, events] = await Promise.all([enrich(projectId, [item]), prisma.itemEvent.findMany({ where: { itemId } })]);
  return {
    item: enriched[0],
    events: events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((event) => ({
      id: event.id, eventType: event.eventType, actorName: event.actorName ?? "-", body: event.body,
      beforeData: event.beforeData as Record<string, unknown> | null, afterData: event.afterData as Record<string, unknown> | null,
      createdAt: event.createdAt.toISOString(),
    } satisfies ItemEventRow)),
  };
}
export async function getDashboard(projectId: string) {
  const prisma = getPrisma();
  const all = await prisma.item.findMany({ where: { projectId, archivedAt: null } });
  const items = await enrich(projectId, all), open = items.filter((item) => ["registered", "in_progress"].includes(item.status));
  const codes = await prisma.commonCode.findMany({ where: { projectId } });
  const categories = codes.filter((code) => code.groupCode === "category" && code.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((code) => ({ category: code.code, label: code.label, count: open.filter((item) => item.categoryCodeId === code.id).length }));
  const matrix = Array.from(open.reduce((map, item) => {
    const key = `${item.probability}:${item.impact}`, current = map.get(key) ?? { probability: item.probability, impact: item.impact, count: 0 };
    current.count += 1; map.set(key, current); return map;
  }, new Map<string, { probability: string; impact: string; count: number }>()).values());
  return {
    summary: { total: items.length, openIssues: open.filter((item) => item.kind === "issue").length, openRisks: open.filter((item) => item.kind === "risk").length, stale: open.filter((item) => item.isStale).length },
    matrix, categories, staleItems: open.filter((item) => item.isStale).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).slice(0, 8),
  };
}

async function assertWritePermission(projectId: string, userId: string, itemId?: string, requirePm = false) {
  const prisma = getPrisma();
  const [role, item] = await Promise.all([getMemberRole(projectId, userId), itemId ? prisma.item.findUnique({ where: { id: itemId } }) : Promise.resolve(null)]);
  const isManager = isManagerRole(role), owns = item ? item.createdBy === userId || item.ownerUserId === userId : false;
  if (!role || (requirePm ? !isManager : !(isManager || (role === "MEMBER" && (!itemId || owns))))) throw new DomainError("FORBIDDEN", "이 작업을 수행할 권한이 없습니다.");
}
async function assertCommonCode(projectId: string, codeId: string, groupCode: string) {
  const code = await getPrisma().commonCode.findUnique({ where: { id: codeId } });
  if (!code || code.projectId !== projectId || code.groupCode !== groupCode || !code.isActive) throw new DomainError("INVALID_CODE", "선택한 공통코드를 사용할 수 없습니다.");
  return code;
}
async function assertWorkModuleGroup(projectId: string, groupId: string) {
  const group = await getPrisma().groups.findUnique({ where: { id: groupId } });
  if (!group || group.projectId !== projectId || group.groupType !== "WORK_MODULE" || !group.isActive) throw new DomainError("INVALID_CODE", "선택한 Track을 사용할 수 없습니다.");
  return group;
}
async function suggestedEscalationId(projectId: string, kind: "issue" | "risk", probability: "low" | "medium" | "high", impact: "low" | "medium" | "high") {
  const score = riskScore(kind, probability, impact);
  const codes = await getPrisma().commonCode.findMany({ where: { projectId, groupCode: "escalation_level", isActive: true } });
  const match = codes.filter((code) => (code.minScore ?? 1) <= score).sort((a, b) => (b.minScore ?? 1) - (a.minScore ?? 1) || b.sortOrder - a.sortOrder)[0];
  if (!match) throw new DomainError("INVALID_CODE", "적용 가능한 에스컬레이션 공통코드가 없습니다.");
  return match.id;
}
function mutationError(item: PrismaItem | null, version: number) {
  if (!item || item.archivedAt) throw new DomainError("NOT_FOUND", "항목을 찾을 수 없습니다.");
  if (item.version !== version) throw new DomainError("VERSION_CONFLICT", "다른 사용자가 먼저 수정했습니다. 최신 내용을 다시 확인해 주세요.");
}

export async function createItem(projectId: string, userId: string, input: unknown) {
  const data = createItemSchema.parse(input), probability = data.kind === "issue" ? "high" as const : data.probability, requestId = crypto.randomUUID();
  await assertWritePermission(projectId, userId);
  await Promise.all([assertCommonCode(projectId, data.categoryCodeId, "category"), assertWorkModuleGroup(projectId, data.trackCodeId)]);
  const escalationCodeId = data.escalationCodeId ?? await suggestedEscalationId(projectId, data.kind, probability, data.impact);
  await assertCommonCode(projectId, escalationCodeId, "escalation_level");
  const prisma = getPrisma();
  const { item, displayId } = await prisma.$transaction(async (tx) => {
    const sequence = await tx.itemSequence.upsert({ where: { projectId }, create: { projectId, value: 1 }, update: { value: { increment: 1 } } });
    const displayId = `IR-${new Date().getUTCFullYear()}-${String(sequence.value).padStart(6, "0")}`;
    const item = await tx.item.create({ data: { displayId, projectId, groupId: data.trackCodeId, kind: data.kind, categoryCodeId: data.categoryCodeId, title: data.title, description: data.description, probability, impact: data.impact, exposureText: data.exposureText || null, ownerText: data.ownerText || null, escalationCodeId, status: "registered", createdBy: userId } });
    await tx.itemEvent.create({ data: { itemId: item.id, eventType: "created", actorId: userId, actorName: "PMO 관리자", body: "신규 등록" } });
    return { item, displayId };
  });
  await writeAuditLog(projectId, userId, "ITEM_INSERT", "items", item.id, null, { id: item.id, displayId, title: data.title });
  return { id: item.id, displayId, requestId };
}
export async function updateItem(projectId: string, userId: string, itemId: string, input: unknown) {
  const data = updateItemSchema.parse(input), requestId = crypto.randomUUID();
  await assertWritePermission(projectId, userId, itemId);
  await Promise.all([assertCommonCode(projectId, data.categoryCodeId, "category"), assertWorkModuleGroup(projectId, data.trackCodeId)]);
  const prisma = getPrisma();
  const { before, version } = await prisma.$transaction(async (tx) => {
    const before = await tx.item.findUnique({ where: { id: itemId } });
    mutationError(before, data.version);
    const version = data.version + 1;
    const update = { groupId: data.trackCodeId, categoryCodeId: data.categoryCodeId, title: data.title, description: data.description, probability: before!.kind === "issue" ? "high" as const : data.probability, impact: data.impact, exposureText: data.exposureText || null, ownerText: data.ownerText || null, version };
    await tx.item.update({ where: { id: itemId }, data: update });
    await tx.itemEvent.create({ data: { itemId, eventType: "edited", actorId: userId, actorName: "PMO 관리자", body: "기본 정보 수정", beforeData: before as never, afterData: update as never } });
    return { before, version };
  });
  await writeAuditLog(projectId, userId, "ITEM_UPDATE", "items", itemId, before, { version });
  return { version, requestId };
}
export async function updateStatus(projectId: string, userId: string, itemId: string, input: unknown) {
  const data = statusUpdateSchema.parse(input);
  return updateSingleField(projectId, userId, itemId, data.version, data.status);
}
async function updateSingleField(projectId: string, userId: string, itemId: string, expectedVersion: number, status: "registered" | "in_progress" | "resolved" | "on_hold") {
  const requestId = crypto.randomUUID();
  await assertWritePermission(projectId, userId, itemId);
  const prisma = getPrisma();
  const { before, version } = await prisma.$transaction(async (tx) => {
    const before = await tx.item.findUnique({ where: { id: itemId } });
    mutationError(before, expectedVersion);
    const version = expectedVersion + 1;
    await tx.item.update({ where: { id: itemId }, data: { status, version, resolvedAt: status === "resolved" ? new Date() : null } });
    await tx.itemEvent.create({ data: { itemId, eventType: "status_changed", actorId: userId, actorName: "PMO 관리자", body: "상태 변경", beforeData: { value: before!.status }, afterData: { value: status } } });
    return { before, version };
  });
  await writeAuditLog(projectId, userId, "ITEM_UPDATE", "items", itemId, before, { status, version });
  return { version, requestId };
}
export async function updateEscalation(projectId: string, userId: string, itemId: string, input: unknown) {
  const data = escalationUpdateSchema.parse(input), requestId = crypto.randomUUID();
  await assertWritePermission(projectId, userId, itemId, true);
  const nextCode = await assertCommonCode(projectId, data.escalationCodeId, "escalation_level");
  const prisma = getPrisma();
  const { before, version } = await prisma.$transaction(async (tx) => {
    const before = await tx.item.findUnique({ where: { id: itemId } });
    mutationError(before, data.version);
    const currentCode = await tx.commonCode.findUnique({ where: { id: before!.escalationCodeId } });
    const version = data.version + 1;
    await tx.item.update({ where: { id: itemId }, data: { escalationCodeId: data.escalationCodeId, version } });
    await tx.itemEvent.create({ data: { itemId, eventType: "level_changed", actorId: userId, actorName: "PMO 관리자", body: "에스컬레이션 레벨 변경", beforeData: { value: currentCode?.label ?? "-" }, afterData: { value: nextCode.label } } });
    return { before, version };
  });
  await writeAuditLog(projectId, userId, "ITEM_UPDATE", "items", itemId, before, { escalationCodeId: data.escalationCodeId, version });
  return { version, requestId };
}
export async function addComment(projectId: string, userId: string, itemId: string, input: unknown) {
  const data = commentSchema.parse(input), requestId = crypto.randomUUID();
  await assertWritePermission(projectId, userId, itemId);
  const prisma = getPrisma();
  const { version } = await prisma.$transaction(async (tx) => {
    const item = await tx.item.findUnique({ where: { id: itemId } });
    mutationError(item, data.version);
    const version = data.version + 1;
    await tx.item.update({ where: { id: itemId }, data: { version } });
    await tx.itemEvent.create({ data: { itemId, eventType: "comment", actorId: userId, actorName: "PMO 관리자", body: data.body } });
    return { version };
  });
  return { version, requestId };
}
export async function archiveItem(projectId: string, userId: string, itemId: string, input: unknown) {
  const data = archiveSchema.parse(input), requestId = crypto.randomUUID();
  await assertWritePermission(projectId, userId, itemId, true);
  const prisma = getPrisma();
  const { before, version } = await prisma.$transaction(async (tx) => {
    const before = await tx.item.findUnique({ where: { id: itemId } });
    mutationError(before, data.version);
    const version = data.version + 1;
    await tx.item.update({ where: { id: itemId }, data: { archivedAt: new Date(), version } });
    await tx.itemEvent.create({ data: { itemId, eventType: "archived", actorId: userId, actorName: "PMO 관리자", body: "항목 보관" } });
    return { before, version };
  });
  await writeAuditLog(projectId, userId, "ITEM_UPDATE", "items", itemId, before, { archivedAt: nowIso(), version });
  return { version, requestId };
}
