import "server-only";
import { z } from "zod";
import { unstable_cache, revalidateTag } from "next/cache";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { getMemberRole } from "@/lib/server/permissions";
import { DomainError } from "@/lib/server/items";

const codeOptionsTag = (projectId: string) => `common-codes:${projectId}`;

export type CommonCodeGroup = { id: string; code: string; label: string; description: string | null; sortOrder: number; isActive: boolean; isSystem: boolean; codeCount: number; activeCodeCount: number };
export type CommonCode = { id: string; groupId: string; groupCode: string; groupLabel: string; code: string; label: string; sortOrder: number; isActive: boolean; minScore: number | null };

const codePattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const createGroupSchema = z.object({ code: z.string().trim().min(1).max(50).regex(codePattern), label: z.string().trim().min(1).max(100), description: z.string().trim().max(300).nullable().optional(), sortOrder: z.number().int().min(0).max(9999) });
const updateGroupSchema = z.object({ label: z.string().trim().min(1).max(100), description: z.string().trim().max(300).nullable().optional(), sortOrder: z.number().int().min(0).max(9999), isActive: z.boolean() });
const createCodeSchema = z.object({ groupId: z.string().uuid(), code: z.string().trim().min(1).max(50).regex(codePattern), label: z.string().trim().min(1).max(100), sortOrder: z.number().int().min(0).max(9999), minScore: z.number().int().min(1).max(9).nullable().optional() });
const updateCodeSchema = z.object({ label: z.string().trim().min(1).max(100), sortOrder: z.number().int().min(0).max(9999), isActive: z.boolean(), minScore: z.number().int().min(1).max(9).nullable().optional() });

async function assertAdmin(projectId: string, userId: string) {
  const role = await getMemberRole(projectId, userId);
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") throw new DomainError("FORBIDDEN", "공통코드 설정 권한이 없습니다.");
}
function metadata(groupCode: string, minScore: number | null | undefined) {
  if (groupCode !== "escalation_level") return null;
  if (minScore == null) throw new DomainError("INVALID_CODE", "에스컬레이션 레벨에는 최소 점수가 필요합니다.");
  return minScore;
}

export async function listCommonCodeGroups(projectId: string): Promise<CommonCodeGroup[]> {
  const prisma = getPrisma();
  const groups = await prisma.commonCodeGroup.findMany({ where: { projectId }, include: { codes: true } });
  return groups
    .map((group) => ({ id: group.id, code: group.code, label: group.label, description: group.description, sortOrder: group.sortOrder, isActive: group.isActive, isSystem: group.isSystem, codeCount: group.codes.length, activeCodeCount: group.codes.filter((code) => code.isActive).length }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "ko"));
}

// Track(업무그룹)은 Groups(WORK_MODULE)로 이관됨 — CommonCode와 동일한 형태로 감싸서 반환해 기존 소비 코드를 그대로 유지한다.
async function listTrackGroupsAsCommonCodes(projectId: string, includeInactive: boolean): Promise<CommonCode[]> {
  const prisma = getPrisma();
  const groups = await prisma.groups.findMany({ where: { projectId, groupType: "WORK_MODULE", ...(includeInactive ? {} : { isActive: true }) } });
  return groups.map((group) => ({ id: group.id, groupId: group.id, groupCode: "track", groupLabel: "관련 Track", code: group.code, label: group.label, sortOrder: group.sortOrder, isActive: group.isActive, minScore: null }));
}

export async function listCommonCodes(projectId: string, includeInactive = true, groupId?: string): Promise<CommonCode[]> {
  const prisma = getPrisma();
  const codes = await prisma.commonCode.findMany({ where: { projectId, ...(groupId ? { groupId } : {}) }, include: { group: true } });
  const mapped = codes
    .filter((code) => includeInactive || (code.isActive && code.group.isActive))
    .map((code) => ({ id: code.id, groupId: code.groupId, groupCode: code.groupCode, groupLabel: code.group.label, code: code.code, label: code.label, sortOrder: code.sortOrder, isActive: code.isActive, minScore: code.minScore }));
  return mapped.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "ko"));
}

async function loadCodeOptions(projectId: string) {
  const [codes, tracks] = await Promise.all([listCommonCodes(projectId, false), listTrackGroupsAsCommonCodes(projectId, false)]);
  return {
    categories: codes.filter((code) => code.groupCode === "category"),
    tracks: tracks.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "ko")),
    escalations: codes.filter((code) => code.groupCode === "escalation_level"),
  };
}

// 캘린더·이슈·업무 등 여러 화면이 공유하는 읽기 전용 옵션이라 30초 캐시하고, 그룹/코드 변경 시 revalidateTag로 즉시 무효화한다.
export function getCodeOptions(projectId: string) {
  return unstable_cache(loadCodeOptions, ["code-options"], { tags: [codeOptionsTag(projectId)], revalidate: 30 })(projectId);
}

export async function createCommonCodeGroup(projectId: string, userId: string, input: unknown) {
  const data = createGroupSchema.parse(input), requestId = crypto.randomUUID();
  await assertAdmin(projectId, userId);
  const prisma = getPrisma();
  const existing = await prisma.commonCodeGroup.findFirst({ where: { projectId, code: { equals: data.code, mode: "insensitive" } } });
  if (existing) throw new DomainError("DUPLICATE_CODE", "동일한 그룹 코드가 이미 존재합니다.");
  const group = await prisma.commonCodeGroup.create({ data: { projectId, code: data.code, label: data.label, description: data.description || null, sortOrder: data.sortOrder, isActive: true, isSystem: false } });
  await writeAuditLog(projectId, userId, "GROUP_INSERT", "common_code_groups", group.id, null, group);
  revalidateTag(codeOptionsTag(projectId));
  return { group: { id: group.id, code: group.code, label: group.label, description: group.description, sortOrder: group.sortOrder, isActive: group.isActive, isSystem: group.isSystem, codeCount: 0, activeCodeCount: 0 }, requestId };
}

export async function updateCommonCodeGroup(projectId: string, userId: string, groupId: string, input: unknown) {
  const data = updateGroupSchema.parse(input), requestId = crypto.randomUUID();
  await assertAdmin(projectId, userId);
  const prisma = getPrisma();
  const current = await prisma.commonCodeGroup.findUnique({ where: { id: groupId } });
  if (!current || current.projectId !== projectId) throw new DomainError("NOT_FOUND", "코드 그룹을 찾을 수 없습니다.");
  if (current.isSystem && !data.isActive) throw new DomainError("INVALID_CODE", "시스템 코드 그룹은 비활성화할 수 없습니다.");
  const updated = await prisma.commonCodeGroup.update({ where: { id: groupId }, data: { label: data.label, description: data.description || null, sortOrder: data.sortOrder, isActive: data.isActive } });
  await writeAuditLog(projectId, userId, "GROUP_UPDATE", "common_code_groups", groupId, current, updated);
  revalidateTag(codeOptionsTag(projectId));
  const group = (await listCommonCodeGroups(projectId)).find((row) => row.id === groupId)!;
  return { group, requestId };
}

export async function createCommonCode(projectId: string, userId: string, input: unknown) {
  const data = createCodeSchema.parse(input), requestId = crypto.randomUUID();
  await assertAdmin(projectId, userId);
  const prisma = getPrisma();
  const group = await prisma.commonCodeGroup.findUnique({ where: { id: data.groupId } });
  if (!group || group.projectId !== projectId) throw new DomainError("NOT_FOUND", "코드 그룹을 찾을 수 없습니다.");
  const siblings = await prisma.commonCode.findMany({ where: { groupId: data.groupId } });
  const minScore = metadata(group.code, data.minScore);
  if (siblings.some((code) => code.code.toLowerCase() === data.code.toLowerCase() || (minScore !== null && code.minScore === minScore))) throw new DomainError("DUPLICATE_CODE", "그룹 내 동일한 코드 또는 최소 점수가 이미 존재합니다.");
  const created = await prisma.commonCode.create({ data: { projectId, groupId: data.groupId, groupCode: group.code, code: data.code, label: data.label, sortOrder: data.sortOrder, isActive: true, minScore } });
  await writeAuditLog(projectId, userId, "COMMON_CODE_INSERT", "common_codes", created.id, null, created);
  revalidateTag(codeOptionsTag(projectId));
  return { code: { id: created.id, groupId: created.groupId, groupCode: created.groupCode, groupLabel: group.label, code: created.code, label: created.label, sortOrder: created.sortOrder, isActive: created.isActive, minScore: created.minScore }, requestId };
}

export async function updateCommonCode(projectId: string, userId: string, codeId: string, input: unknown) {
  const data = updateCodeSchema.parse(input), requestId = crypto.randomUUID();
  await assertAdmin(projectId, userId);
  const prisma = getPrisma();
  const current = await prisma.commonCode.findUnique({ where: { id: codeId } });
  if (!current || current.projectId !== projectId) throw new DomainError("NOT_FOUND", "공통코드를 찾을 수 없습니다.");
  const siblings = await prisma.commonCode.findMany({ where: { groupId: current.groupId } });
  if (current.isActive && !data.isActive && siblings.filter((code) => code.isActive && code.id !== codeId).length === 0) throw new DomainError("LAST_ACTIVE_CODE", "그룹에는 하나 이상의 활성 코드가 필요합니다.");
  const minScore = metadata(current.groupCode, data.minScore);
  if (minScore !== null && siblings.some((code) => code.id !== codeId && code.minScore === minScore)) throw new DomainError("DUPLICATE_CODE", "동일한 최소 점수가 이미 존재합니다.");
  const updated = await prisma.commonCode.update({ where: { id: codeId }, data: { label: data.label, sortOrder: data.sortOrder, isActive: data.isActive, minScore } });
  await writeAuditLog(projectId, userId, "COMMON_CODE_UPDATE", "common_codes", codeId, current, updated);
  revalidateTag(codeOptionsTag(projectId));
  const group = await prisma.commonCodeGroup.findUnique({ where: { id: current.groupId } });
  return { code: { id: updated.id, groupId: updated.groupId, groupCode: updated.groupCode, groupLabel: group?.label ?? updated.groupCode, code: updated.code, label: updated.label, sortOrder: updated.sortOrder, isActive: updated.isActive, minScore: updated.minScore }, requestId };
}
