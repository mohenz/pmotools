import "server-only";

import { getPrisma } from "@/lib/server/db-pg";
import type { UserRole } from "@/lib/generated/prisma/client";
import { DomainError } from "@/lib/server/errors";

export async function getMemberRole(projectId: string, userId: string): Promise<UserRole | null> {
  const prisma = getPrisma();
  const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
  return member?.role ?? null;
}

export function isManagerRole(role: UserRole | null) {
  return role === "ADMIN" || role === "OPERATOR" || role === "SUPER_ADMIN";
}

export function isSuperAdminRole(role: UserRole | null) {
  return role === "SUPER_ADMIN";
}

export async function assertAdmin(projectId: string, userId: string) {
  const role = await getMemberRole(projectId, userId);
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") throw new DomainError("FORBIDDEN", "관리자 권한이 필요합니다.");
}

export async function assertManager(projectId: string, userId: string) {
  const role = await getMemberRole(projectId, userId);
  if (!isManagerRole(role)) throw new DomainError("FORBIDDEN", "운영자 이상 권한이 필요합니다.");
}

export async function assertSuperAdmin(projectId: string, userId: string) {
  const role = await getMemberRole(projectId, userId);
  if (!isSuperAdminRole(role)) throw new DomainError("FORBIDDEN", "슈퍼관리자 권한이 필요합니다.");
}
