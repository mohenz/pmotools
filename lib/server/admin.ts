import "server-only";
import { z } from "zod";
import { hash } from "bcryptjs";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { assertAdmin } from "@/lib/server/permissions";
import { DomainError } from "@/lib/server/errors";
import type { GroupType, UserRole, UserStatus } from "@/lib/generated/prisma/client";

// role = 계정 역할(User.role, 2026-09-29 계정 역할 통일). legacyProjectRole = 로그인 프로젝트에서의 이전 프로젝트별 역할(참고용, 권한 판단에 안 씀)
export type AdminUserRow = { id: string; userId: string; name: string; email: string | null; department: string | null; jobTitle: string | null; role: UserRole; legacyProjectRole: UserRole | null; assignedHere: boolean; assignedProjects: { id: string; code: string; name: string }[]; status: UserStatus; createdAt: string; workGroups: { id: string; label: string }[] };
export type AdminUserListResult = { users: AdminUserRow[]; total: number; page: number; pageSize: number; totalPages: number };
export type AdminUserFilters = { q?: string; page?: number; pageSize?: number | "all"; scope?: "all" | "project" };
export type GroupRow = { id: string; groupType: GroupType; code: string; label: string; color: string | null; sortOrder: number; isActive: boolean; leader: { id: string; userId: string; name: string } | null };

export async function listUsers(projectId: string, adminUserId: string, q?: string): Promise<AdminUserRow[]> {
  return (await listUsersPage(projectId, adminUserId, { q, pageSize: "all" })).users;
}

// 사용자 관리 목록 — 계정 역할 통일 이후 사용자는 프로젝트가 아니라 플랫폼 단위로 관리한다.
// scope "all"(기본): 전체 사용자 / "project": 로그인 프로젝트에 배정된 사용자만.
export async function listUsersPage(projectId: string, adminUserId: string, filters: AdminUserFilters = {}): Promise<AdminUserListResult> {
  await assertAdmin(projectId, adminUserId);
  const query = filters.q?.trim();
  const where = {
    deletedAt: null,
    ...(filters.scope === "project" ? { memberships: { some: { projectId, isActive: true } } } : {}),
    ...(query ? { OR: [{ userId: { contains: query, mode: "insensitive" as const } }, { name: { contains: query, mode: "insensitive" as const } }, { jobTitle: { contains: query, mode: "insensitive" as const } }] } : {}),
  };
  const prisma = getPrisma();
  const total = await prisma.user.count({ where });
  const pageSize = filters.pageSize === "all" ? Math.max(1, total) : Math.min(100, Math.max(10, filters.pageSize ?? 20));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const users = await prisma.user.findMany({
    where,
    include: {
      groupMemberships: { where: { group: { projectId, groupType: "WORK_MODULE", isActive: true } }, include: { group: true } },
      memberships: { include: { project: { select: { id: true, code: true, name: true, sortOrder: true } } } },
    },
    orderBy: { userId: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return {
    users: users.map((user) => {
      const here = user.memberships.find((m) => m.projectId === projectId);
      const assigned = user.memberships.filter((m) => m.isActive).map((m) => m.project).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ko"));
      return {
        id: user.id, userId: user.userId, name: user.name, email: user.email, department: user.department, jobTitle: user.jobTitle,
        role: user.role, legacyProjectRole: here?.role ?? null, assignedHere: Boolean(here?.isActive),
        assignedProjects: assigned.map(({ id, code, name }) => ({ id, code, name })),
        status: user.status, createdAt: user.createdAt.toISOString(), workGroups: user.groupMemberships.map(({ group }) => ({ id: group.id, label: group.label })),
      };
    }),
    total, page, pageSize, totalPages,
  };
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

const roleSchema = z.object({ role: z.enum(["SUPER_ADMIN", "ADMIN", "OPERATOR", "MEMBER"]) });

async function assertPlatformSuperAdmin(actorId: string, message: string) {
  const actor = await getPrisma().user.findUnique({ where: { id: actorId }, select: { role: true } });
  if (actor?.role !== "SUPER_ADMIN") throw new DomainError("FORBIDDEN", message);
}

// 계정 역할 변경 — 슈퍼관리자만(R-5). 역할은 모든 프로젝트에 공통으로 적용된다(R-1).
// 플랫폼에는 슈퍼관리자가 최소 한 명 남아야 한다. 이전 프로젝트별 역할(ProjectMember.role)도 새 역할로 맞춰 둔다.
export async function updateUserRole(projectId: string, adminUserId: string, targetUserId: string, input: unknown) {
  await assertPlatformSuperAdmin(adminUserId, "계정 역할은 슈퍼관리자만 변경할 수 있습니다.");
  const data = roleSchema.parse(input);
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user || user.deletedAt) throw new DomainError("NOT_FOUND", "사용자를 찾을 수 없습니다.");
  if (user.role === "SUPER_ADMIN" && data.role !== "SUPER_ADMIN") {
    const superAdmins = await prisma.user.count({ where: { role: "SUPER_ADMIN", deletedAt: null, status: "ACTIVE" } });
    if (superAdmins <= 1) throw new DomainError("LAST_ACTIVE_CODE", "플랫폼에는 최소 한 명의 슈퍼관리자가 필요합니다.");
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: targetUserId }, data: { role: data.role } }),
    prisma.projectMember.updateMany({ where: { userId: targetUserId }, data: { role: data.role } }),
  ]);
  await writeAuditLog(projectId, adminUserId, "USER_ACCOUNT_ROLE_UPDATE", "users", targetUserId, { role: user.role }, { role: data.role });
  return { id: targetUserId, role: data.role };
}

// 프로젝트 배정 — 관리자 이상. 선택한 프로젝트는 배정(소속 활성화), 선택하지 않은 프로젝트는 배정 해제(소속 비활성, 이력 보존).
// 관리자 이상은 배정 없이도 모든 프로젝트에 접근하지만, 담당자·참석자 목록에 나오려면 배정이 필요하다.
const projectsSchema = z.object({ projectIds: z.array(z.string().uuid()).max(500) });
export async function updateUserProjects(projectId: string, adminUserId: string, targetUserId: string, input: unknown) {
  await assertAdmin(projectId, adminUserId);
  const data = projectsSchema.parse(input);
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: targetUserId }, include: { memberships: true } });
  if (!user || user.deletedAt) throw new DomainError("NOT_FOUND", "사용자를 찾을 수 없습니다.");
  const wanted = [...new Set(data.projectIds)];
  if (wanted.length && (await prisma.project.count({ where: { id: { in: wanted } } })) !== wanted.length) throw new DomainError("NOT_FOUND", "존재하지 않는 프로젝트가 포함되어 있습니다.");
  const before = user.memberships.filter((m) => m.isActive).map((m) => m.projectId).sort();
  await prisma.$transaction([
    ...wanted.map((id) => prisma.projectMember.upsert({ where: { projectId_userId: { projectId: id, userId: targetUserId } }, create: { projectId: id, userId: targetUserId, role: user.role }, update: { isActive: true, role: user.role } })),
    prisma.projectMember.updateMany({ where: { userId: targetUserId, projectId: { notIn: wanted }, isActive: true }, data: { isActive: false } }),
  ]);
  await writeAuditLog(projectId, adminUserId, "USER_PROJECTS_UPDATE", "project_members", targetUserId, { projectIds: before }, { projectIds: [...wanted].sort() });
  return { id: targetUserId, projectIds: wanted };
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
  // 관리자 이상(모든 프로젝트 접근) 계정은 슈퍼관리자만 만들 수 있다(R-5). 새 사용자는 로그인 프로젝트에 배정된다.
  if (data.role === "SUPER_ADMIN" || data.role === "ADMIN") await assertPlatformSuperAdmin(adminUserId, "관리자 이상 계정은 슈퍼관리자만 만들 수 있습니다.");
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
  userId: z.string().trim().min(3).max(50).regex(/^[A-Za-z0-9._-]+$/, "아이디는 영문/숫자/._- 만 사용할 수 있습니다."),
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
  if (data.userId !== current.userId) {
    const existing = await prisma.user.findUnique({ where: { userId: data.userId } });
    if (existing) throw new DomainError("DUPLICATE_CODE", "이미 사용 중인 아이디입니다.");
  }
  const updated = await prisma.user.update({ where: { id: targetUserId }, data: { userId: data.userId, name: data.name, email: data.email || null, department: data.department || null, jobTitle: data.jobTitle || null } });
  await writeAuditLog(projectId, adminUserId, "USER_PROFILE_UPDATE", "users", targetUserId, { userId: current.userId, name: current.name, email: current.email, department: current.department, jobTitle: current.jobTitle }, { userId: updated.userId, name: updated.name, email: updated.email, department: updated.department, jobTitle: updated.jobTitle });
  return { id: targetUserId, userId: updated.userId, name: updated.name, email: updated.email, department: updated.department, jobTitle: updated.jobTitle };
}

// 사용자 삭제 — 계정을 잠그고 모든 프로젝트 배정을 해제한다(이력 보존). 관리자 이상은 슈퍼관리자만, 마지막 슈퍼관리자는 삭제 불가.
export async function deleteUser(projectId: string, adminUserId: string, targetUserId: string) {
  await assertAdmin(projectId, adminUserId);
  if (targetUserId === adminUserId) throw new DomainError("FORBIDDEN", "본인 계정은 삭제할 수 없습니다.");
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user || user.deletedAt) throw new DomainError("NOT_FOUND", "사용자를 찾을 수 없습니다.");
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") await assertPlatformSuperAdmin(adminUserId, "관리자 이상 계정은 슈퍼관리자만 삭제할 수 있습니다.");
  if (user.role === "SUPER_ADMIN" && (await prisma.user.count({ where: { role: "SUPER_ADMIN", deletedAt: null, status: "ACTIVE" } })) <= 1) {
    throw new DomainError("LAST_ACTIVE_CODE", "플랫폼에는 최소 한 명의 슈퍼관리자가 필요합니다.");
  }
  const deletedAt = new Date();
  await prisma.$transaction([
    prisma.projectMember.updateMany({ where: { userId: targetUserId }, data: { isActive: false } }),
    prisma.user.update({ where: { id: targetUserId }, data: { status: "LOCKED", deletedAt } }),
  ]);
  await writeAuditLog(projectId, adminUserId, "USER_DELETE", "users", targetUserId, { userId: user.userId, role: user.role }, { deletedAt: deletedAt.toISOString() });
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
