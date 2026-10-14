import "server-only";

import { resolveProjectRole } from "@/lib/server/project-access";
import type { UserRole } from "@/lib/generated/prisma/client";
import { DomainError } from "@/lib/server/errors";

// 이 프로젝트에서 사용자가 동작하는 역할 — 계정 역할 하나로 판단한다(2026-09-29, R-1).
// 슈퍼관리자·관리자는 모든 프로젝트에서 계정 역할, 운영자·사용자는 배정된 프로젝트에서만 계정 역할, 그 외 null.
// 프로젝트별 역할(ProjectMember.role)은 더 이상 쓰지 않는다. 모든 기능의 권한 검사(assertManager 등)가 이 함수를 거친다.
export async function getMemberRole(projectId: string, userId: string): Promise<UserRole | null> {
  return resolveProjectRole(userId, projectId);
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
