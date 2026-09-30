import "server-only";
import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";

export type ProjectSummary = { id: string; code: string; name: string; parentId: string | null; memberCount: number; createdAt: string };

const codePattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const createProjectSchema = z.object({
  code: z.string().trim().min(1).max(50).regex(codePattern, "프로젝트 코드는 영문으로 시작하는 영문/숫자/_- 조합이어야 합니다."),
  name: z.string().trim().min(1).max(150),
  parentId: z.string().uuid().nullable().optional(),
});
const updateParentSchema = z.object({ parentId: z.string().uuid().nullable() });

async function assertSuperAdmin(actorId: string) {
  const actor = await getPrisma().user.findUnique({ where: { id: actorId }, select: { role: true } });
  if (actor?.role !== "SUPER_ADMIN") throw new DomainError("FORBIDDEN", "프로젝트 생성·관리 권한이 없습니다.");
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const projects = await getPrisma().project.findMany({
    select: { id: true, code: true, name: true, parentId: true, createdAt: true, _count: { select: { members: true } } },
    orderBy: { name: "asc" },
  });
  return projects.map((p) => ({ id: p.id, code: p.code, name: p.name, parentId: p.parentId, memberCount: p._count.members, createdAt: p.createdAt.toISOString() }));
}

export async function createProject(actorId: string, input: unknown) {
  const data = createProjectSchema.parse(input);
  await assertSuperAdmin(actorId);
  const prisma = getPrisma();
  if (data.parentId) {
    const parent = await prisma.project.findUnique({ where: { id: data.parentId } });
    if (!parent) throw new DomainError("NOT_FOUND", "상위 프로젝트를 찾을 수 없습니다.");
  }
  const existing = await prisma.project.findUnique({ where: { code: data.code } });
  if (existing) throw new DomainError("DUPLICATE_CODE", "이미 사용 중인 프로젝트 코드입니다.");
  const project = await prisma.project.create({ data: { code: data.code, name: data.name, parentId: data.parentId ?? null } });
  await writeAuditLog(project.id, actorId, "PROJECT_CREATE", "projects", project.id, null, project);
  return project;
}

export async function updateProjectParent(actorId: string, projectId: string, input: unknown) {
  const data = updateParentSchema.parse(input);
  await assertSuperAdmin(actorId);
  const prisma = getPrisma();
  const current = await prisma.project.findUnique({ where: { id: projectId } });
  if (!current) throw new DomainError("NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
  if (data.parentId === projectId) throw new DomainError("CYCLE_DETECTED", "자기 자신을 상위 프로젝트로 지정할 수 없습니다.");
  if (data.parentId) {
    const parent = await prisma.project.findUnique({ where: { id: data.parentId } });
    if (!parent) throw new DomainError("NOT_FOUND", "상위 프로젝트를 찾을 수 없습니다.");
    // 순환 참조 방지: 지정하려는 상위가 현재 프로젝트의 하위 트리에 속하면 안 된다.
    let cursor: string | null = parent.parentId;
    while (cursor) {
      if (cursor === projectId) throw new DomainError("CYCLE_DETECTED", "상하위 관계에 순환 참조가 발생합니다.");
      cursor = (await prisma.project.findUnique({ where: { id: cursor }, select: { parentId: true } }))?.parentId ?? null;
    }
  }
  const updated = await prisma.project.update({ where: { id: projectId }, data: { parentId: data.parentId } });
  await writeAuditLog(projectId, actorId, "PROJECT_PARENT_UPDATE", "projects", projectId, current, updated);
  return updated;
}
