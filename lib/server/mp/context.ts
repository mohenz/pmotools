import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth";
import { getPrisma } from "@/lib/server/db-pg";
import { hasPmPmoAccess } from "@/lib/domain/job-access";
import { hasAllProjectAccess } from "@/lib/domain/project-access";
import { resolveProjectRole } from "@/lib/server/project-access";
import { DomainError } from "@/lib/server/errors";

// ---------------------------------------------------------------------------
// 다중 프로젝트 메뉴(WBS2 · WBS상세내용2 · 요구사항관리2) 전용 컨텍스트.
// 원본 lib/server/context.ts와 같은 이름·반환 형태를 제공해, 복사한 화면·API·서버 로직이 import 경로만 바꿔 쓰도록 한다.
// 대상 프로젝트는 로그인 세션의 프로젝트가 아니라 "선택 프로젝트" 쿠키로 정한다(로그인 세션은 바꾸지 않는다).
// 쿠키는 사용자가 조작할 수 있으므로 매 요청마다 아래 규칙으로 다시 검증하고, 어긋나면 로그인 프로젝트로 되돌린다.
//   D-2: 로그인 프로젝트가 속한 대표(최상위) 프로젝트의 계층 전체 중 소속된 것만 선택 가능
//        (2026-09-29 변경 — 대표 프로젝트 아래 여러 프로젝트가 같은 등급으로 있는 구조. 이전: 로그인 프로젝트+하위)
//   D-3: 선택 프로젝트에 접근할 수 있어야 함 — 계정 역할 규칙(2026-09-29): 슈퍼관리자·관리자는 전체, 운영자·사용자는 배정된 프로젝트
// ---------------------------------------------------------------------------

export const MP_PROJECT_COOKIE = "pmotools_mp_project";

type Role = "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "MEMBER";
export type MpProjectOption = { id: string; code: string; name: string; depth: number; isLoginProject: boolean };

async function sessionUser() {
  const session = await auth();
  if (!session?.user) throw new Error("인증되지 않은 요청입니다.");
  return session.user;
}

// 대표(최상위) 프로젝트 — parentId를 끝까지 따라 올라간다. 계층이 꼬여 순환하면 멈춘 지점을 대표로 본다.
export function topAncestorOf(projectId: string, projects: { id: string; parentId: string | null }[]) {
  const byId = new Map(projects.map((project) => [project.id, project]));
  let current = byId.get(projectId);
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.id) && byId.has(current.parentId)) { seen.add(current.id); current = byId.get(current.parentId); }
  return current?.id ?? projectId;
}

// 뿌리 프로젝트부터 하위 계층 전체(자기 자신 포함)를 깊이 우선 순서로 반환한다.
export function descendantsOf(rootId: string, projects: { id: string; code: string; name: string; parentId: string | null; sortOrder: number }[]) {
  const children = new Map<string, typeof projects>();
  for (const project of projects) if (project.parentId) children.set(project.parentId, [...(children.get(project.parentId) ?? []), project]);
  const root = projects.find((project) => project.id === rootId);
  if (!root) return [];
  const result: { project: (typeof projects)[number]; depth: number }[] = [];
  const visit = (project: (typeof projects)[number], depth: number, seen: Set<string>) => {
    if (seen.has(project.id)) return; // 계층 데이터가 꼬여도 무한 루프 방지
    seen.add(project.id);
    result.push({ project, depth });
    for (const child of (children.get(project.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ko")) /* 백오피스 노출 우선순위 → 이름순 */) visit(child, depth + 1, seen);
  };
  visit(root, 0, new Set());
  return result;
}

/** 선택 상자에 보여줄 프로젝트 — 로그인 프로젝트의 대표 프로젝트 계층 전체 중 접근 가능한 것(관리자 이상은 계층 전체, 그 외는 배정된 것). */
export async function listMpProjects(): Promise<MpProjectOption[]> {
  const user = await sessionUser();
  const prisma = getPrisma();
  const [projects, memberships] = await Promise.all([
    prisma.project.findMany({ select: { id: true, code: true, name: true, parentId: true, sortOrder: true } }),
    prisma.projectMember.findMany({ where: { userId: user.id, isActive: true }, select: { projectId: true } }),
  ]);
  const memberOf = new Set(memberships.map((m) => m.projectId));
  const allAccess = hasAllProjectAccess(user.globalRole);
  return descendantsOf(topAncestorOf(user.projectId, projects), projects)
    .filter(({ project }) => project.id === user.projectId || allAccess || memberOf.has(project.id))
    .map(({ project, depth }) => ({ id: project.id, code: project.code, name: project.name, depth, isLoginProject: project.id === user.projectId }));
}

/** 원본 getLocalContext와 같은 형태 — projectId·role만 "선택 프로젝트" 기준이다. */
export async function getLocalContext() {
  const user = await sessionUser();
  const base = { userId: user.id, loginId: user.loginId, projectId: user.projectId, role: user.role as Role, globalRole: user.globalRole as Role, jobTitle: user.jobTitle };
  const selected = (await cookies()).get(MP_PROJECT_COOKIE)?.value;
  if (!selected || selected === user.projectId) return base;
  const allowed = (await listMpProjects()).some((project) => project.id === selected);
  if (!allowed) return base;
  const role = await resolveProjectRole(user.id, selected);
  return role ? { ...base, projectId: selected, role } : base;
}

export async function requireAdminContext() {
  const context = await getLocalContext();
  if (context.role !== "ADMIN" && context.role !== "SUPER_ADMIN") redirect("/");
  return context;
}

export async function requireManagerContext() {
  const context = await getLocalContext();
  if (context.role !== "ADMIN" && context.role !== "OPERATOR" && context.role !== "SUPER_ADMIN") redirect("/calendar");
  return context;
}

export async function requireSuperAdminContext() {
  const context = await getLocalContext();
  if (context.globalRole !== "SUPER_ADMIN") redirect("/");
  return context;
}

export async function requirePmPmoContext() {
  const context = await getLocalContext();
  if (!hasPmPmoAccess(context.jobTitle, context.role)) redirect("/announcements");
  return context;
}

/** 선택 프로젝트 정보 — 화면 상단 선택 상자 표시용. */
export async function getMpSelection() {
  const [context, projects] = await Promise.all([getLocalContext(), listMpProjects()]);
  return { current: projects.find((project) => project.id === context.projectId) ?? null, projects, role: context.role };
}

// ---------------------------------------------------------------------------
// 최상위(대표) 프로젝트 통합 조회 (2026-09-30 결정)
//   1) 목록 화면(WBS2 전체 목록·간트, 요구사항정의서)만 최상위 + 하위 프로젝트를 합쳐 보여준다. 통계 등은 선택 프로젝트 1개 기준 유지.
//   2) 통합 목록에서 연 하위 프로젝트 항목은 선택을 바꾸지 않고, 항목이 속한 프로젝트 기준으로 권한·판정을 다시 한다(getMpItemContext).
//   3) 합산 범위는 선택 상자와 같다 — 관리자 이상은 계층 전체, 운영자·사용자는 배정된 프로젝트만.
//   4) 최상위 선택 상태에서는 등록·엑셀 업로드를 막는다(assertMpWritableProject).
// ---------------------------------------------------------------------------

export type MpScope = { context: Awaited<ReturnType<typeof getLocalContext>>; isTopLevel: boolean; projects: MpProjectOption[]; projectIds: string[] };

/** 선택 프로젝트가 최상위(계층 맨 위)이고 하위 프로젝트가 있으면 합산 대상 전체, 아니면 선택 프로젝트 하나. */
export async function getMpScope(): Promise<MpScope> {
  const [context, options] = await Promise.all([getLocalContext(), listMpProjects()]);
  const current = options.find((project) => project.id === context.projectId);
  const isTopLevel = Boolean(current && current.depth === 0 && options.length > 1);
  const projects = isTopLevel ? options : current ? [current] : [];
  return { context, isTopLevel, projects, projectIds: isTopLevel ? options.map((project) => project.id) : [context.projectId] };
}

type MpItemKind = "wbsItem" | "requirement" | "requirementChange";

async function projectIdOfItem(kind: MpItemKind, id: string) {
  const prisma = getPrisma();
  if (kind === "wbsItem") return (await prisma.wbsItem.findUnique({ where: { id }, select: { projectId: true } }))?.projectId ?? null;
  if (kind === "requirement") return (await prisma.requirement.findUnique({ where: { id }, select: { projectId: true } }))?.projectId ?? null;
  return (await prisma.requirementChange.findUnique({ where: { id }, select: { projectId: true } }))?.projectId ?? null;
}

/**
 * 항목 단위 화면·API용 컨텍스트 — 최상위 선택 상태에서 하위 프로젝트 항목을 열면 projectId·role을 그 항목의 프로젝트로 바꿔 준다.
 * 합산 범위 밖이거나 id가 형식에 맞지 않으면 선택 프로젝트 그대로 돌려주어, 이후 로직이 원래대로 "찾을 수 없음"을 낸다.
 */
export async function getMpItemContext(kind: MpItemKind, id: string) {
  const scope = await getMpScope();
  if (!scope.isTopLevel || !/^[0-9a-f-]{36}$/i.test(id)) return scope.context;
  const itemProjectId = await projectIdOfItem(kind, id);
  if (!itemProjectId || itemProjectId === scope.context.projectId || !scope.projectIds.includes(itemProjectId)) return scope.context;
  const role = await resolveProjectRole(scope.context.userId, itemProjectId);
  return role ? { ...scope.context, projectId: itemProjectId, role } : scope.context;
}

export const MP_TOP_LEVEL_WRITE_MESSAGE = "최상위 프로젝트에서는 등록·엑셀 업로드를 할 수 없습니다. 대상 프로젝트를 하위 프로젝트로 바꾼 뒤 진행해 주세요.";

/** 등록·엑셀 업로드 API 가드 — 최상위 선택 상태면 INVALID_STATE. */
export async function assertMpWritableProject() {
  const scope = await getMpScope();
  if (scope.isTopLevel) throw new DomainError("INVALID_STATE", MP_TOP_LEVEL_WRITE_MESSAGE);
  return scope.context;
}
