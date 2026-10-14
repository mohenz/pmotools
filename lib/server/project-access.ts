import "server-only";

import { getPrisma } from "@/lib/server/db-pg";
import { effectiveProjectRole, hasAllProjectAccess, type AccountRole } from "@/lib/domain/project-access";

// 프로젝트 접근 판정의 서버 쪽 단일 진입점 — 로그인·프로젝트 전환·세션·권한 검사(getMemberRole)·프로젝트 목록이 모두 이것만 쓴다.
// pmotools · 백오피스가 같은 내용을 쓴다(양쪽 파일을 함께 고친다).

/** 이 사용자가 이 프로젝트에서 동작할 역할(계정 역할). 잠금·삭제 계정이거나 접근할 수 없으면 null. */
export async function resolveProjectRole(userId: string, projectId: string): Promise<AccountRole | null> {
  if (!userId || !projectId) return null;
  const prisma = getPrisma();
  const [user, project, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true, deletedAt: true } }),
    prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }),
    prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } }, select: { isActive: true } }),
  ]);
  if (!user || !project || user.deletedAt || user.status === "LOCKED") return null;
  return effectiveProjectRole(user.role, Boolean(membership?.isActive));
}

export type AccessibleProject = { projectId: string; code: string; name: string; role: AccountRole };

/** 접근 가능한 프로젝트 — 관리자 이상은 전체, 그 외는 배정된 프로젝트. 노출 우선순위 → 이름순. */
export async function listAccessibleProjects(userId: string): Promise<AccessibleProject[]> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true, deletedAt: true } });
  if (!user || user.deletedAt || user.status === "LOCKED") return [];
  const role = user.role as AccountRole;
  const projects = await prisma.project.findMany({
    where: hasAllProjectAccess(role) ? {} : { members: { some: { userId, isActive: true } } },
    select: { id: true, code: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return projects.map((project) => ({ projectId: project.id, code: project.code, name: project.name, role }));
}

/** 주어진 프로젝트의 최상위 부모(Root) 프로젝트 ID를 재귀적으로 찾아서 반환합니다. 부모가 없으면 자기 자신을 반환합니다. */
export async function resolveRootProjectId(projectId: string): Promise<string> {
  if (!projectId) return projectId;
  const prisma = getPrisma();
  let currentId = projectId;
  for (let i = 0; i < 5; i++) { // 최대 5단계 제한 (무한루프 방지)
    const p = await prisma.project.findUnique({ where: { id: currentId }, select: { parentId: true } });
    if (!p || !p.parentId) break;
    currentId = p.parentId;
  }
  return currentId;
}
