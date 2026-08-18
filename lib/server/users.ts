import "server-only";
import { z } from "zod";
import { compare, hash } from "bcryptjs";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import type { ThemeMode, UserRole, UserStatus } from "@/lib/generated/prisma/client";

export type ProjectMemberOption = { id: string; userId: string; name: string };

export type MyProfile = { userId: string; name: string; email: string | null; department: string | null; jobTitle: string | null; role: UserRole; status: UserStatus; theme: ThemeMode; createdAt: string };

export async function getMyProfile(projectId: string, userId: string): Promise<MyProfile> {
  const member = await getPrisma().projectMember.findUnique({ where: { projectId_userId: { projectId, userId } }, include: { user: true } });
  if (!member) throw new DomainError("NOT_FOUND", "사용자 정보를 찾을 수 없습니다.");
  return { userId: member.user.userId, name: member.user.name, email: member.user.email, department: member.user.department, jobTitle: member.user.jobTitle, role: member.role, status: member.user.status, theme: member.user.theme, createdAt: member.user.createdAt.toISOString() };
}

const updateMyProfileSchema = z.object({
  name: z.string().trim().min(1).max(50),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  department: z.string().trim().max(100).nullable().optional(),
  jobTitle: z.string().trim().max(100).nullable().optional(),
});
export async function updateMyProfile(projectId: string, userId: string, input: unknown) {
  const data = updateMyProfileSchema.parse(input);
  const prisma = getPrisma();
  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (!current) throw new DomainError("NOT_FOUND", "사용자 정보를 찾을 수 없습니다.");
  const updated = await prisma.user.update({ where: { id: userId }, data: { name: data.name, email: data.email || null, department: data.department || null, jobTitle: data.jobTitle || null } });
  await writeAuditLog(projectId, userId, "USER_PROFILE_UPDATE", "users", userId, { name: current.name, email: current.email, department: current.department, jobTitle: current.jobTitle }, { name: updated.name, email: updated.email, department: updated.department, jobTitle: updated.jobTitle });
  return { name: updated.name, email: updated.email, department: updated.department, jobTitle: updated.jobTitle };
}

const changeMyPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});
export async function changeMyPassword(projectId: string, userId: string, input: unknown) {
  const data = changeMyPasswordSchema.parse(input);
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new DomainError("NOT_FOUND", "사용자 정보를 찾을 수 없습니다.");
  const valid = await compare(data.currentPassword, user.passwordHash);
  if (!valid) throw new DomainError("INVALID_PASSWORD", "현재 비밀번호가 일치하지 않습니다.");
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hash(data.newPassword, 12) } });
  await writeAuditLog(projectId, userId, "USER_PASSWORD_CHANGE", "users", userId, null, null);
  return { ok: true };
}

export async function listProjectMembers(projectId: string): Promise<ProjectMemberOption[]> {
  const members = await getPrisma().projectMember.findMany({ where: { projectId, isActive: true, user: { status: "ACTIVE" } }, include: { user: true } });
  return members.map((member) => ({ id: member.user.id, userId: member.user.userId, name: member.user.name })).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
