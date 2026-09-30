import "server-only";

import { getPrisma } from "@/lib/server/db-pg";
import type { UserRole } from "@/lib/generated/prisma/client";
import { DomainError } from "@/lib/server/errors";

export async function getMemberRole(projectId: string, userId: string): Promise<UserRole | null> {
  const prisma = getPrisma();
  const [member, user] = await Promise.all([
    prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);
  // 플랫폼 전역 SUPER_ADMIN(User.role)은 실제 프로젝트 소속 역할과 무관하게 모든 프로젝트를
  // 관리할 수 있어야 한다 — 그렇지 않으면 백오피스에서 SUPER_ADMIN으로 로그인해도
  // 소속이 없거나 낮은 프로젝트의 설정 화면(사용자 관리 등)에서 차단당한다.
  if (user?.role === "SUPER_ADMIN") return "SUPER_ADMIN";
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
