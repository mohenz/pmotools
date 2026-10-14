import { beforeEach, describe, expect, it, vi } from "vitest";

// 프로젝트 계층: REP(대표) ─ A(로그인 프로젝트) · B · C (같은 등급), 그리고 다른 대표 아래의 OTHER
const PROJECTS = [
  { id: "rep", code: "REP", name: "대표", parentId: null, sortOrder: 0 },
  { id: "a", code: "A", name: "가", parentId: "rep", sortOrder: 0 },
  { id: "b", code: "B", name: "나", parentId: "rep", sortOrder: 0 },
  { id: "c", code: "C", name: "다", parentId: "rep", sortOrder: 0 },
  { id: "other", code: "OTHER", name: "무관", parentId: null, sortOrder: 0 },
];
const state = { cookie: undefined as string | undefined, globalRole: "MEMBER", memberships: [] as { projectId: string; role: string; isActive: boolean }[] };

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (state.cookie ? { value: state.cookie } : undefined) }) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT ${to}`); } }));
vi.mock("@/lib/server/auth", () => ({ auth: async () => ({ user: { id: "u1", loginId: "u1", projectId: "a", role: "OPERATOR", globalRole: state.globalRole, jobTitle: "PMO" } }) }));
vi.mock("@/lib/server/db-pg", () => ({
  getPrisma: () => ({
    project: { findMany: async () => PROJECTS, findUnique: async ({ where }: { where: { id: string } }) => PROJECTS.find((p) => p.id === where.id) ?? null },
    user: { findUnique: async () => ({ role: state.globalRole, status: "ACTIVE", deletedAt: null }) },
    projectMember: {
      findMany: async () => state.memberships.filter((m) => m.isActive).map((m) => ({ projectId: m.projectId })),
      findUnique: async ({ where }: { where: { projectId_userId: { projectId: string } } }) => state.memberships.find((m) => m.projectId === where.projectId_userId.projectId) ?? null,
    },
  }),
}));

import { getLocalContext, listMpProjects, requireManagerContext } from "./context";

describe("WBS2 선택 프로젝트 컨텍스트", () => {
  beforeEach(() => {
    state.cookie = undefined; state.globalRole = "MEMBER";
    state.memberships = [{ projectId: "a", role: "OPERATOR", isActive: true }, { projectId: "c", role: "MEMBER", isActive: true }, { projectId: "other", role: "ADMIN", isActive: true }];
  });

  it("D-2: 로그인 프로젝트가 속한 대표 프로젝트 계층 전체 중 소속된 것만 선택 가능 (같은 등급 프로젝트 포함)", async () => {
    expect((await listMpProjects()).map((p) => `${p.code}:${p.depth}`)).toEqual(["A:1", "C:1"]);
  });

  it("쿠키가 없으면 로그인 프로젝트", async () => {
    expect((await getLocalContext()).projectId).toBe("a");
  });

  it("D-3: 소속된 같은 등급 프로젝트를 고르면 그 프로젝트 역할로 바뀐다", async () => {
    state.cookie = "c";
    const context = await getLocalContext();
    expect([context.projectId, context.role]).toEqual(["c", "MEMBER"]);
    await expect(requireManagerContext()).rejects.toThrow("REDIRECT");
  });

  it("비소속 프로젝트·다른 대표 아래 프로젝트는 쿠키를 조작해도 로그인 프로젝트로 되돌린다", async () => {
    state.cookie = "b";
    expect((await getLocalContext()).projectId).toBe("a");
    state.cookie = "other"; // 소속은 있지만 다른 대표 프로젝트 소속
    expect((await getLocalContext()).projectId).toBe("a");
  });

  it("대표 프로젝트도 소속이 있으면 선택할 수 있다", async () => {
    state.memberships.push({ projectId: "rep", role: "MEMBER", isActive: true });
    expect((await listMpProjects()).map((p) => p.code)).toEqual(["REP", "A", "C"]);
  });

  it("소속이 비활성화되면 즉시 로그인 프로젝트로 되돌린다", async () => {
    state.cookie = "c";
    state.memberships = state.memberships.map((m) => (m.projectId === "c" ? { ...m, isActive: false } : m));
    expect((await getLocalContext()).projectId).toBe("a");
  });

  it("플랫폼 슈퍼관리자는 소속과 무관하게 대표 프로젝트 계층 전체를 선택할 수 있다", async () => {
    state.globalRole = "SUPER_ADMIN";
    expect((await listMpProjects()).map((p) => p.code)).toEqual(["REP", "A", "B", "C"]);
    state.cookie = "b";
    const context = await getLocalContext();
    expect([context.projectId, context.role]).toEqual(["b", "SUPER_ADMIN"]);
  });

  it("같은 등급 프로젝트는 노출 우선순위(sortOrder) → 이름순으로 나온다", async () => {
    state.globalRole = "SUPER_ADMIN";
    const original = PROJECTS.map((p) => p.sortOrder);
    PROJECTS.find((p) => p.id === "c")!.sortOrder = -1; // "다"를 맨 위로
    try { expect((await listMpProjects()).map((p) => p.code)).toEqual(["REP", "C", "A", "B"]); }
    finally { PROJECTS.forEach((p, i) => { p.sortOrder = original[i]; }); }
  });

  it("계정 관리자는 배정 없이도 대표 프로젝트 계층 전체를 관리자 역할로 선택할 수 있다", async () => {
    state.globalRole = "ADMIN";
    expect((await listMpProjects()).map((p) => p.code)).toEqual(["REP", "A", "B", "C"]);
    state.cookie = "b"; // 배정 없음
    const context = await getLocalContext();
    expect([context.projectId, context.role]).toEqual(["b", "ADMIN"]);
  });
});

