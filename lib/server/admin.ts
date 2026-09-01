import "server-only";
import { z } from "zod";
import { hash } from "bcryptjs";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { assertAdmin } from "@/lib/server/permissions";
import { DomainError } from "@/lib/server/errors";
import type { GroupType, UserRole, UserStatus } from "@/lib/generated/prisma/client";

export type AdminUserRow = { id: string; userId: string; name: string; email: string | null; department: string | null; jobTitle: string | null; role: UserRole; status: UserStatus; createdAt: string; workGroups: { id: string; label: string }[] };
export type AdminUserListResult = { users: AdminUserRow[]; total: number; page: number; pageSize: number; totalPages: number };
export type AdminUserFilters = { q?: string; page?: number; pageSize?: number | "all" };
export type GroupRow = { id: string; groupType: GroupType; code: string; label: string; color: string | null; sortOrder: number; isActive: boolean; leader: { id: string; userId: string; name: string } | null };

export async function listUsers(projectId: string, adminUserId: string, q?: string): Promise<AdminUserRow[]> {
  return (await listUsersPage(projectId, adminUserId, { q, pageSize: "all" })).users;
}

export async function listUsersPage(projectId: string, adminUserId: string, filters: AdminUserFilters = {}): Promise<AdminUserListResult> {
  await assertAdmin(projectId, adminUserId);
  const query = filters.q?.trim();
  const where = { projectId, isActive: true, user: { deletedAt: null, ...(query ? { OR: [{ userId: { contains: query, mode: "insensitive" as const } }, { name: { contains: query, mode: "insensitive" as const } }, { jobTitle: { contains: query, mode: "insensitive" as const } }] } : {}) } };
  const prisma = getPrisma();
  const total = await prisma.projectMember.count({ where });
  const pageSize = filters.pageSize === "all" ? Math.max(1, total) : Math.min(100, Math.max(10, filters.pageSize ?? 20));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const members = await prisma.projectMember.findMany({
    where,
    include: { user: { include: { groupMemberships: { where: { group: { projectId, groupType: "WORK_MODULE", isActive: true } }, include: { group: true } } } } },
    orderBy: { user: { userId: "asc" } },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { users: members.map((member) => ({ id: member.user.id, userId: member.user.userId, name: member.user.name, email: member.user.email, department: member.user.department, jobTitle: member.user.jobTitle, role: member.role, status: member.user.status, createdAt: member.user.createdAt.toISOString(), workGroups: member.user.groupMemberships.map(({ group }) => ({ id: group.id, label: group.label })).sort((a, b) => a.label.localeCompare(b.label, "ko")) })), total, page, pageSize, totalPages };
}

const workGroupsSchema = z.object({ groupId: z.string().uuid().nullable() });
export async function updateUserWorkGroups(projectId: string, adminUserId: string, targetUserId: string, input: unknown) {
  await assertAdmin(projectId, adminUserId);
  const data = workGroupsSchema.parse(input), groupIds = data.groupId ? [data.groupId] : [];
  const prisma = getPrisma();
  const [member, groups, current] = await Promise.all([
    prisma.projectMember.findFirst({ where: { projectId, userId: targetUserId, isActive: true }, select: { id: true } }),
    groupIds.length ? prisma.groups.findMany({ where: { id: { in: groupIds }, projectId, groupType: "WORK_MODULE", isActive: true }, select: { id: true, label: true } }) : Promise.resolve([]),
    prisma.userGroupMap.findMany({ where: { userId: targetUserId, group: { projectId, groupType: "WORK_MODULE" } }, include: { group: true } }),
  ]);
  if (!member) throw new DomainError("NOT_FOUND", "해당 프로젝트의 사용자를 찾을 수 없습니다.");
  if (groups.length !== groupIds.length) throw new DomainError("INVALID_CODE", "유효하지 않은 업무그룹이 포함되어 있습니다.");
  await prisma.$transaction(async (tx) => {
    await tx.userGroupMap.deleteMany({ where: { userId: targetUserId, group: { projectId, groupType: "WORK_MODULE" } } });
    if (groupIds.length) await tx.userGroupMap.createMany({ data: groupIds.map((groupId) => ({ userId: targetUserId, groupId })) });
  });
  await writeAuditLog(projectId, adminUserId, "USER_WORK_GROUPS_UPDATE", "user_group_map", targetUserId, { groupIds: current.map(({ groupId }) => groupId) }, { groupIds });
  return { id: targetUserId, workGroups: groups.sort((a, b) => a.label.localeCompare(b.label, "ko")) };
}

const ADMIN_TIER_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;
const roleSchema = z.object({ role: z.enum(["SUPER_ADMIN", "ADMIN", "OPERATOR", "MEMBER"]) });
export async function updateUserRole(projectId: string, adminUserId: string, targetUserId: string, input: unknown) {
  await assertAdmin(projectId, adminUserId);
  const data = roleSchema.parse(input);
  const prisma = getPrisma();
  const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: targetUserId } } });
  if (!member) throw new DomainError("NOT_FOUND", "해당 프로젝트의 사용자를 찾을 수 없습니다.");
  if ((ADMIN_TIER_ROLES as readonly string[]).includes(member.role) && !(ADMIN_TIER_ROLES as readonly string[]).includes(data.role)) {
    const adminCount = await prisma.projectMember.count({ where: { projectId, role: { in: [...ADMIN_TIER_ROLES] } } });
    if (adminCount <= 1) throw new DomainError("LAST_ACTIVE_CODE", "프로젝트에는 최소 한 명의 관리자가 필요합니다.");
  }
  const updated = await prisma.projectMember.update({ where: { id: member.id }, data: { role: data.role } });
  await writeAuditLog(projectId, adminUserId, "USER_ROLE_UPDATE", "project_members", member.id, member, updated);
  return { id: targetUserId, role: updated.role };
}

const statusSchema = z.object({ status: z.enum(["ACTIVE", "LOCKED"]) });
export async function updateUserStatus(projectId: string, adminUserId: string, targetUserId: string, input: unknown) {
  await assertAdmin(projectId, adminUserId);
  const data = statusSchema.parse(input);
  if (targetUserId === adminUserId && data.status === "LOCKED") throw new DomainError("FORBIDDEN", "본인 계정은 잠글 수 없습니다.");
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new DomainError("NOT_FOUND", "사용자를 찾을 수 없습니다.");
  const updated = await prisma.user.update({ where: { id: targetUserId }, data: { status: data.status } });
  await writeAuditLog(projectId, adminUserId, "USER_STATUS_UPDATE", "users", targetUserId, { status: user.status }, { status: updated.status });
  return { id: targetUserId, status: updated.status };
}

function generateTempPassword() {
  return `Temp-${crypto.randomUUID().slice(0, 8)}!`;
}
const resetPasswordSchema = z.object({ password: z.string().trim().min(8).max(100).optional() });
export async function resetUserPassword(projectId: string, adminUserId: string, targetUserId: string, input?: unknown) {
  await assertAdmin(projectId, adminUserId);
  const data = resetPasswordSchema.parse(input ?? {});
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new DomainError("NOT_FOUND", "사용자를 찾을 수 없습니다.");
  const tempPassword = data.password || generateTempPassword();
  await prisma.user.update({ where: { id: targetUserId }, data: { passwordHash: await hash(tempPassword, 12) } });
  await writeAuditLog(projectId, adminUserId, "USER_PASSWORD_RESET", "users", targetUserId, null, null);
  return { id: targetUserId, tempPassword };
}

const createUserSchema = z.object({
  userId: z.string().trim().min(3).max(50).regex(/^[A-Za-z0-9._-]+$/, "아이디는 영문/숫자/._- 만 사용할 수 있습니다."),
  name: z.string().trim().min(1).max(50),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  department: z.string().trim().max(100).nullable().optional(),
  jobTitle: z.string().trim().max(100).nullable().optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "OPERATOR", "MEMBER"]),
});
export async function createUser(projectId: string, adminUserId: string, input: unknown) {
  await assertAdmin(projectId, adminUserId);
  const data = createUserSchema.parse(input);
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { userId: data.userId } });
  if (existing) throw new DomainError("DUPLICATE_CODE", "이미 사용 중인 아이디입니다.");
  const tempPassword = generateTempPassword();
  const passwordHash = await hash(tempPassword, 12);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { userId: data.userId, name: data.name, passwordHash, email: data.email || null, department: data.department || null, jobTitle: data.jobTitle || null, role: data.role } });
    await tx.projectMember.create({ data: { projectId, userId: created.id, role: data.role } });
    return created;
  });
  await writeAuditLog(projectId, adminUserId, "USER_CREATE", "users", user.id, null, { userId: user.userId, name: user.name, role: data.role });
  return { id: user.id, userId: user.userId, tempPassword };
}

const updateUserProfileSchema = z.object({
  name: z.string().trim().min(1).max(50),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  department: z.string().trim().max(100).nullable().optional(),
  jobTitle: z.string().trim().max(100).nullable().optional(),
});
export async function updateUserProfile(projectId: string, adminUserId: string, targetUserId: string, input: unknown) {
  await assertAdmin(projectId, adminUserId);
  const data = updateUserProfileSchema.parse(input);
  const prisma = getPrisma();
  const current = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!current) throw new DomainError("NOT_FOUND", "사용자를 찾을 수 없습니다.");
  const updated = await prisma.user.update({ where: { id: targetUserId }, data: { name: data.name, email: data.email || null, department: data.department || null, jobTitle: data.jobTitle || null } });
  await writeAuditLog(projectId, adminUserId, "USER_PROFILE_UPDATE", "users", targetUserId, { name: current.name, email: current.email, department: current.department, jobTitle: current.jobTitle }, { name: updated.name, email: updated.email, department: updated.department, jobTitle: updated.jobTitle });
  return { id: targetUserId, name: updated.name, email: updated.email, department: updated.department, jobTitle: updated.jobTitle };
}

const loginIdSchema = z.object({
  userId: z.string().trim().min(3).max(50).regex(/^[A-Za-z0-9._-]+$/, "아이디는 영문/숫자/._- 만 사용할 수 있습니다."),
});
export async function updateUserLoginId(projectId: string, adminUserId: string, targetUserId: string, input: unknown) {
  await assertAdmin(projectId, adminUserId);
  const data = loginIdSchema.parse(input);
  const prisma = getPrisma();
  const current = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!current) throw new DomainError("NOT_FOUND", "사용자를 찾을 수 없습니다.");
  if (data.userId !== current.userId) {
    const existing = await prisma.user.findUnique({ where: { userId: data.userId } });
    if (existing) throw new DomainError("DUPLICATE_CODE", "이미 사용 중인 아이디입니다.");
  }
  const updated = await prisma.user.update({ where: { id: targetUserId }, data: { userId: data.userId } });
  await writeAuditLog(projectId, adminUserId, "USER_LOGIN_ID_UPDATE", "users", targetUserId, { userId: current.userId }, { userId: updated.userId });
  return { id: targetUserId, userId: updated.userId };
}

export async function deleteUser(projectId: string, adminUserId: string, targetUserId: string) {
  await assertAdmin(projectId, adminUserId);
  if (targetUserId === adminUserId) throw new DomainError("FORBIDDEN", "본인 계정은 삭제할 수 없습니다.");
  const prisma = getPrisma();
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: targetUserId } },
    include: { user: true },
  });
  if (!member || !member.isActive || member.user.deletedAt) throw new DomainError("NOT_FOUND", "사용자를 찾을 수 없습니다.");
  if ((ADMIN_TIER_ROLES as readonly string[]).includes(member.role)) {
    const adminCount = await prisma.projectMember.count({
      where: { projectId, role: { in: [...ADMIN_TIER_ROLES] }, isActive: true, user: { deletedAt: null } },
    });
    if (adminCount <= 1) throw new DomainError("LAST_ACTIVE_CODE", "프로젝트에는 최소 한 명의 관리자가 필요합니다.");
  }
  const deletedAt = new Date();
  await prisma.$transaction([
    prisma.projectMember.update({ where: { id: member.id }, data: { isActive: false } }),
    prisma.user.update({ where: { id: targetUserId }, data: { status: "LOCKED", deletedAt } }),
  ]);
  await writeAuditLog(projectId, adminUserId, "USER_DELETE", "users", targetUserId, { userId: member.user.userId, role: member.role }, { deletedAt: deletedAt.toISOString() });
  return { id: targetUserId };
}

export async function listGroups(projectId: string, groupType?: GroupType): Promise<GroupRow[]> {
  const groups = await getPrisma().groups.findMany({ where: { projectId, ...(groupType ? { groupType } : {}) }, include: { leader: { select: { id: true, userId: true, name: true } } } });
  return groups.map((group) => ({ id: group.id, groupType: group.groupType, code: group.code, label: group.label, color: group.color, sortOrder: group.sortOrder, isActive: group.isActive, leader: group.leader })).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "ko"));
}

const codePattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const createGroupSchema = z.object({ groupType: z.enum(["WORK_MODULE", "COMPANY"]), code: z.string().trim().min(1).max(50).regex(codePattern), label: z.string().trim().min(1).max(100), color: z.string().trim().max(20).nullable().optional(), sortOrder: z.number().int().min(0).max(9999), leaderId: z.string().uuid().nullable().optional() });
export async function createGroup(projectId: string, adminUserId: string, input: unknown) {
  await assertAdmin(projectId, adminUserId);
  const data = createGroupSchema.parse(input);
  const prisma = getPrisma();
  if (data.leaderId) await assertProjectUser(projectId, data.leaderId);
  const existing = await prisma.groups.findFirst({ where: { projectId, groupType: data.groupType, code: { equals: data.code, mode: "insensitive" } } });
  if (existing) throw new DomainError("DUPLICATE_CODE", "동일한 그룹 코드가 이미 존재합니다.");
  const group = await prisma.groups.create({ data: { projectId, groupType: data.groupType, code: data.code, label: data.label, color: data.color || null, sortOrder: data.sortOrder, leaderId: data.groupType === "WORK_MODULE" ? data.leaderId || null : null } });
  await writeAuditLog(projectId, adminUserId, "GROUPS_INSERT", "groups", group.id, null, group);
  return group;
}

const updateGroupSchema = z.object({ label: z.string().trim().min(1).max(100), color: z.string().trim().max(20).nullable().optional(), sortOrder: z.number().int().min(0).max(9999), isActive: z.boolean(), leaderId: z.string().uuid().nullable().optional() });
export async function updateGroup(projectId: string, adminUserId: string, groupId: string, input: unknown) {
  await assertAdmin(projectId, adminUserId);
  const data = updateGroupSchema.parse(input);
  const prisma = getPrisma();
  const current = await prisma.groups.findUnique({ where: { id: groupId } });
  if (!current || current.projectId !== projectId) throw new DomainError("NOT_FOUND", "그룹을 찾을 수 없습니다.");
  if (data.leaderId) await assertProjectUser(projectId, data.leaderId);
  const updated = await prisma.groups.update({ where: { id: groupId }, data: { label: data.label, color: data.color || null, sortOrder: data.sortOrder, isActive: data.isActive, leaderId: current.groupType === "WORK_MODULE" ? data.leaderId || null : null } });
  await writeAuditLog(projectId, adminUserId, "GROUPS_UPDATE", "groups", groupId, current, updated);
  return updated;
}

async function assertProjectUser(projectId: string, userId: string) {
  const member = await getPrisma().projectMember.findFirst({ where: { projectId, userId, isActive: true, user: { status: "ACTIVE", deletedAt: null } }, select: { id: true } });
  if (!member) throw new DomainError("INVALID_CODE", "업무리더로 지정할 수 없는 사용자입니다.");
}
