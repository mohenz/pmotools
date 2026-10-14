import "server-only";
import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { allocateNumberingBase, isNumberingBaseConflict, presetNumberingSequences } from "@/lib/server/numbering";
import { updateProjectInformation } from "@/lib/server/project-information";

export type ProjectSummary = { id: string; code: string; name: string; isPublic: boolean; parentId: string | null; memberCount: number; sortOrder: number; numberingBase: number | null; createdAt: string; startDate: string | null; endDate: string | null; customerName: string; vendorPm: string };

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
    select: { id: true, code: true, name: true, parentId: true, sortOrder: true, numberingBase: true, createdAt: true, startDate: true, endDate: true, customerName: true, vendorPm: true, _count: { select: { members: true } } },
    // 노출 우선순위(작을수록 위) → 같으면 이름순. pmotools의 프로젝트 전환·WBS2 대상 프로젝트 선택도 같은 기준을 쓴다.
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const date = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);
  let pubMap = new Map<string, boolean>();
  try {
    await getPrisma().$executeRawUnsafe(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT true;`);
    const pubFlags = await getPrisma().$queryRaw<{ id: string, isPublic: boolean }[]>`SELECT id::text, "isPublic" FROM projects`;
    pubMap = new Map(pubFlags.map(f => [f.id, f.isPublic]));
  } catch (e) {
    console.error("isPublic DB fetch failed:", e);
  }
  return projects.map((p) => ({ id: p.id, code: p.code, name: p.name, isPublic: pubMap.get(p.id) ?? true, parentId: p.parentId, memberCount: p._count.members, sortOrder: p.sortOrder, numberingBase: p.numberingBase, createdAt: p.createdAt.toISOString(), startDate: date(p.startDate), endDate: date(p.endDate), customerName: p.customerName, vendorPm: p.vendorPm }));
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
  // 번호 시작점 자동 발번(2026-09-30) — 같은 트랜잭션에서 시작점 기록·7개 순번 선생성. 동시 생성으로 같은 블록을 잡으면 다음 블록으로 재시도.
  let project: Awaited<ReturnType<typeof prisma.project.create>> | null = null;
  for (let attempt = 0; !project; attempt += 1) {
    try {
      project = await prisma.$transaction(async (tx) => {
        const numberingBase = await allocateNumberingBase(tx);
        const created = await tx.project.create({ data: { code: data.code, name: data.name, parentId: data.parentId ?? null, numberingBase } });
        await presetNumberingSequences(tx, created.id, numberingBase);
        return created;
      });
    } catch (error) {
      if (isNumberingBaseConflict(error) && attempt < 2) continue;
      if ((error as { code?: string })?.code === "P2002") throw new DomainError("DUPLICATE_CODE", "이미 사용 중인 프로젝트 코드입니다.");
      throw error;
    }
  }
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

// 플랫폼 관리 → 프로젝트 관리에서 로그인 프로젝트와 무관하게 임의 프로젝트의 정보(기간·오픈·발주/수행 조직·등급)를 수정한다.
// 검증 규칙과 저장은 "프로젝트정보 설정"(로그인 프로젝트 전용)과 같은 updateProjectInformation을 그대로 쓴다.
export async function updateProjectInfoAsAdmin(actorId: string, projectId: string, input: unknown) {
  await assertSuperAdmin(actorId);
  const exists = await getPrisma().project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!exists) throw new DomainError("NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
  const result = await updateProjectInformation(projectId, input);
  await writeAuditLog(projectId, actorId, "PROJECT_UPDATE_BY_PLATFORM_ADMIN", "projects", projectId, null, { code: result.code });
  return result;
}

const reorderSchema = z.array(z.string().uuid()).min(1).max(1000);

// 프로젝트 관리 목록의 노출 우선순위 저장 — 화면에 보이는 전체 순서를 그대로 받아 0부터 다시 매긴다.
// 목록에 없는 프로젝트가 섞이거나 일부만 오면 순서가 꼬이므로 전체 프로젝트와 정확히 같은 집합인지 확인한다.
export async function reorderProjects(actorId: string, orderedIds: unknown) {
  await assertSuperAdmin(actorId);
  const ids = reorderSchema.parse(orderedIds);
  const prisma = getPrisma();
  const all = await prisma.project.findMany({ select: { id: true } });
  if (new Set(ids).size !== ids.length || ids.length !== all.length || !all.every((p) => ids.includes(p.id))) {
    throw new DomainError("INVALID_CODE", "프로젝트 목록이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.");
  }
  await prisma.$transaction(ids.map((id, index) => prisma.project.update({ where: { id }, data: { sortOrder: index } })));
  await writeAuditLog(null, actorId, "PROJECT_REORDER", "projects", null, null, { orderedIds: ids });
}

export type ProjectMemberAdminRow = { userId: string; loginId: string; name: string; jobTitle: string | null; role: string; status: string };

// 프로젝트별 배정 현황 — 활성 소속(배정)된 사용자. 관리자 이상은 배정 없이도 접근하지만 여기에는 배정된 사람만 나온다.
export async function listProjectAssignees(actorId: string, projectId: string): Promise<ProjectMemberAdminRow[]> {
  await assertSuperAdmin(actorId);
  const rows = await getPrisma().projectMember.findMany({ where: { projectId, isActive: true, user: { deletedAt: null } }, include: { user: true }, orderBy: { user: { name: "asc" } } });
  return rows.map(({ user }) => ({ userId: user.id, loginId: user.userId, name: user.name, jobTitle: user.jobTitle, role: user.role, status: user.status }));
}

export async function listAssignableUsers(actorId: string, projectId: string) {
  await assertSuperAdmin(actorId);
  const users = await getPrisma().user.findMany({ where: { deletedAt: null, NOT: { memberships: { some: { projectId, isActive: true } } } }, select: { id: true, userId: true, name: true, role: true }, orderBy: { name: "asc" } });
  return users.map((user) => ({ userId: user.id, loginId: user.userId, name: user.name, role: user.role }));
}

// 프로젝트 관리 → 프로젝트별 배정·해제 (사용자 관리의 사용자별 배정과 같은 데이터). 해제는 소속 비활성(이력 보존).
const assignSchema = z.object({ userId: z.string().uuid(), assigned: z.boolean() });
export async function setProjectAssignment(actorId: string, projectId: string, input: unknown) {
  await assertSuperAdmin(actorId);
  const data = assignSchema.parse(input);
  const prisma = getPrisma();
  const [project, user] = await Promise.all([prisma.project.findUnique({ where: { id: projectId } }), prisma.user.findUnique({ where: { id: data.userId } })]);
  if (!project) throw new DomainError("NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
  if (!user || user.deletedAt) throw new DomainError("NOT_FOUND", "사용자를 찾을 수 없습니다.");
  if (data.assigned) {
    await prisma.projectMember.upsert({ where: { projectId_userId: { projectId, userId: user.id } }, create: { projectId, userId: user.id, role: user.role }, update: { isActive: true, role: user.role } });
  } else {
    await prisma.projectMember.updateMany({ where: { projectId, userId: user.id }, data: { isActive: false } });
  }
  await writeAuditLog(projectId, actorId, data.assigned ? "PROJECT_MEMBER_ASSIGN" : "PROJECT_MEMBER_UNASSIGN", "project_members", user.id, null, { userId: user.userId });
  return { userId: user.id, assigned: data.assigned };
}
