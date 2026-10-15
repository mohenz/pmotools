import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  transaction: vi.fn(),
  update: vi.fn((args: unknown) => ({ op: "update", args })),
  auditCreate: vi.fn((args: unknown) => ({ op: "audit", args })),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/server/db-pg", () => ({
  getPrisma: () => ({
    user: { findUnique: async () => ({ role: "SUPER_ADMIN" }) },
    project: { findMany: async () => [{ id: ID_A }, { id: ID_B }], update: db.update },
    auditLog: { create: db.auditCreate },
    $transaction: db.transaction,
  }),
  actorNameOf: async () => "관리자",
  writeAuditLog: db.writeAuditLog,
}));

const ID_A = "4a5f3edb-8944-4535-a09b-6715553b22fe";
const ID_B = "8ed6d1f8-e61b-4b1b-8be0-989e28609e53";

import { reorderProjects } from "./projects-admin";

describe("reorderProjects", () => {
  beforeEach(() => vi.clearAllMocks());

  // 2026-10-15 운영 오류: 순서 저장 후 별도로 쓰던 감사로그가 실패(P2011)하면 순서만 반영되는 상태가 생겼다.
  it("순서 저장과 감사로그(projectId null)를 한 트랜잭션으로 보낸다", async () => {
    await reorderProjects("actor-1", [ID_B, ID_A]);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    const ops = db.transaction.mock.calls[0][0] as { op: string; args: { where?: { id: string }; data: Record<string, unknown> } }[];
    expect(ops.map((op) => op.op)).toEqual(["update", "update", "audit"]);
    expect(ops[0].args).toEqual({ where: { id: ID_B }, data: { sortOrder: 0 } });
    expect(ops[1].args).toEqual({ where: { id: ID_A }, data: { sortOrder: 1 } });
    expect(ops[2].args.data).toMatchObject({ projectId: null, actorId: "actor-1", actorName: "관리자", action: "PROJECT_REORDER", afterData: { orderedIds: [ID_B, ID_A] } });
    expect(db.writeAuditLog).not.toHaveBeenCalled();
  });

  it("감사로그가 실패하면 오류를 그대로 올린다(트랜잭션 전체 롤백)", async () => {
    db.transaction.mockRejectedValueOnce(Object.assign(new Error("Null constraint violation"), { code: "P2011" }));
    await expect(reorderProjects("actor-1", [ID_A, ID_B])).rejects.toMatchObject({ code: "P2011" });
  });

  it("전체 프로젝트 목록과 다르면 저장하지 않는다", async () => {
    await expect(reorderProjects("actor-1", [ID_A])).rejects.toThrow("프로젝트 목록이 바뀌었습니다");
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
