import { beforeEach, describe, expect, it, vi } from "vitest";

// 메모리 안의 가짜 DB — 결함관리 공통 코드 보장·채번 로직만 검증한다(실제 DB 동작은 마이그레이션 검증에서 확인).
const db = vi.hoisted(() => {
  const state = {
    groups: [] as { id: string; projectId: string; code: string }[],
    codes: [] as { id: string; projectId: string; groupId: string; groupCode: string; code: string; label: string; sortOrder: number; isActive: boolean }[],
    classes: [] as { projectId: string; statusCodeId: string; statusClass: string }[],
    settings: [] as { projectId: string; severityCodeId: string; isMajorImpact: boolean }[],
    seq: new Map<string, number>(),
    nextId: 1,
  };
  const id = () => `id${state.nextId++}`;
  const tx = {
    commonCodeGroup: {
      findMany: async ({ where }: { where: { projectId: string; code: { in: string[] } } }) => state.groups.filter((g) => g.projectId === where.projectId && where.code.in.includes(g.code)).map((g) => ({ code: g.code })),
      create: async ({ data }: { data: { projectId: string; code: string } }) => { const g = { id: id(), projectId: data.projectId, code: data.code }; state.groups.push(g); return g; },
    },
    commonCode: {
      createMany: async ({ data }: { data: { projectId: string; groupId: string; groupCode: string; code: string; label: string; sortOrder: number; isActive: boolean }[] }) => { for (const d of data) state.codes.push({ id: id(), ...d }); },
      findMany: async ({ where, select }: { where: { groupId?: string; projectId?: string; isActive?: boolean; groupCode?: { in: string[] } }; select?: unknown }) => {
        void select;
        return state.codes.filter((c) => (where.groupId ? c.groupId === where.groupId : true) && (where.projectId ? c.projectId === where.projectId : true) && (where.groupCode ? where.groupCode.in.includes(c.groupCode) : true) && (where.isActive === undefined ? true : c.isActive === where.isActive))
          .sort((a, b) => a.groupCode.localeCompare(b.groupCode) || a.sortOrder - b.sortOrder);
      },
      findUnique: async ({ where }: { where: { id: string } }) => state.codes.find((c) => c.id === where.id) ?? null,
    },
    defectStatusClass: {
      createMany: async ({ data }: { data: { projectId: string; statusCodeId: string; statusClass: string }[] }) => { state.classes.push(...data); },
      findMany: async ({ where }: { where: { projectId: string } }) => state.classes.filter((c) => c.projectId === where.projectId),
    },
    defectSeveritySetting: {
      createMany: async ({ data }: { data: { projectId: string; severityCodeId: string; isMajorImpact: boolean }[] }) => { state.settings.push(...data); },
      findMany: async ({ where }: { where: { projectId: string } }) => state.settings.filter((c) => c.projectId === where.projectId),
    },
    defectSequence: {
      upsert: async ({ where, create }: { where: { scope: string }; create: { value: number } }) => {
        const next = state.seq.has(where.scope) ? state.seq.get(where.scope)! + 1 : create.value;
        state.seq.set(where.scope, next);
        return { scope: where.scope, value: next };
      },
    },
  };
  return { state, tx };
});
vi.mock("@/lib/server/db-pg", () => ({ getPrisma: () => ({ ...db.tx, $transaction: async (fn: (value: typeof db.tx) => unknown) => fn(db.tx) }) }));

import { assertDefectCode, ensureDefectCommonCodes, getDefectCodes, nextDefectNumber } from "./common";

beforeEach(() => {
  db.state.groups.length = 0; db.state.codes.length = 0; db.state.classes.length = 0; db.state.settings.length = 0; db.state.seq.clear(); db.state.nextId = 1;
});

describe("결함 공통코드 보장", () => {
  it("빈 프로젝트에 그룹 5개와 기본 코드, 상태 분류, 중대 결함 설정을 만든다", async () => {
    await ensureDefectCommonCodes("p1");
    expect(db.state.groups).toHaveLength(5);
    expect(db.state.codes).toHaveLength(4 + 6 + 4 + 4 + 4);
    expect(db.state.classes).toHaveLength(6);
    expect(db.state.settings).toHaveLength(4);
  });

  it("다시 실행해도 중복으로 만들지 않는다(멱등)", async () => {
    await ensureDefectCommonCodes("p1");
    await ensureDefectCommonCodes("p1");
    expect(db.state.groups).toHaveLength(5);
    expect(db.state.codes).toHaveLength(22);
  });

  it("프로젝트별로 따로 만든다", async () => {
    await ensureDefectCommonCodes("p1");
    await ensureDefectCommonCodes("p2");
    expect(db.state.groups).toHaveLength(10);
    expect(db.state.classes.filter((c) => c.projectId === "p2")).toHaveLength(6);
  });

  it("코드 묶음에는 상태 분류와 중대 여부가 붙는다", async () => {
    const codes = await getDefectCodes("p1");
    expect(codes.stages.map((s) => s.label)).toEqual(["단위", "통합", "3자", "오픈"]);
    expect(Object.fromEntries(codes.statuses.map((s) => [s.code, s.statusClass]))).toEqual({ OPEN: "OPEN", IN_PROGRESS: "OPEN", REOPENED: "OPEN", RESOLVED: "DONE", STAGING: "DONE", CLOSED: "CLOSED" });
    expect(Object.fromEntries(codes.severities.map((s) => [s.code, s.isMajorImpact]))).toEqual({ CRITICAL: true, MAJOR: true, MINOR: false, TRIVIAL: false });
    expect(codes.priorities).toHaveLength(4);
    expect(codes.identifications).toHaveLength(4);
  });

  it("이미 있는 그룹은 건드리지 않는다(관리자가 이름을 바꾼 경우)", async () => {
    await ensureDefectCommonCodes("p1");
    db.state.codes.find((c) => c.code === "UNIT")!.label = "개발자 테스트";
    await ensureDefectCommonCodes("p1");
    expect(db.state.codes.find((c) => c.code === "UNIT")!.label).toBe("개발자 테스트");
  });

  it("코드 검증: 같은 프로젝트의 활성 코드만 통과", async () => {
    await ensureDefectCommonCodes("p1");
    const unit = db.state.codes.find((c) => c.code === "UNIT")!;
    await expect(assertDefectCode("p1", unit.id, "defect_test_stage", "테스트 단계")).resolves.toBeUndefined();
    await expect(assertDefectCode("p2", unit.id, "defect_test_stage", "테스트 단계")).rejects.toThrow(/사용할 수 없습니다/);
    await expect(assertDefectCode("p1", unit.id, "defect_status", "상태")).rejects.toThrow();
    unit.isActive = false;
    await expect(assertDefectCode("p1", unit.id, "defect_test_stage", "테스트 단계")).rejects.toThrow();
    await expect(assertDefectCode("p1", null, "defect_test_stage", "테스트 단계")).resolves.toBeUndefined();
  });
});

describe("결함 번호 발급", () => {
  const tx = db.tx as unknown as Parameters<typeof nextDefectNumber>[0];

  it("그날 첫 결함은 5001, 다음은 5002", async () => {
    expect(await nextDefectNumber(tx, "p1", "2026-10-24")).toEqual({ seq: 5001, displayId: "DF-261024-5001" });
    expect(await nextDefectNumber(tx, "p1", "2026-10-24")).toEqual({ seq: 5002, displayId: "DF-261024-5002" });
  });

  it("날짜·프로젝트별로 따로 센다", async () => {
    await nextDefectNumber(tx, "p1", "2026-10-24");
    expect((await nextDefectNumber(tx, "p1", "2026-10-25")).seq).toBe(5001);
    expect((await nextDefectNumber(tx, "p2", "2026-10-24")).seq).toBe(5001);
  });

  it("9999를 넘기면 오류", async () => {
    db.state.seq.set("defect:p1:261024", 9999);
    await expect(nextDefectNumber(tx, "p1", "2026-10-24")).rejects.toThrow(/5001~9999/);
  });

  it("발급 번호는 단위테스트 구간(0001~4999)과 겹치지 않는다", async () => {
    for (let i = 0; i < 20; i += 1) expect((await nextDefectNumber(tx, "p1", "2026-10-24")).seq).toBeGreaterThanOrEqual(5001);
  });
});
