import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/server/permissions", () => ({ assertManager: vi.fn() }));

const mockMember = {
  id: "member-1",
  userId: "user-uuid-1",
  user: { id: "user-uuid-1", userId: "023017", name: "정재균" },
};

const mockItems = [
  {
    id: "item-1",
    displayId: "WBS-001",
    projectId: "project-1",
    parentId: null,
    path: "0001",
    level: 1,
    name: "착수",
    description: "",
    configStatus: "",
    ownerUserId: "user-uuid-1",
    ownerNameRaw: "",
    ownerLoginId: "",
    groupId: null,
    startDate: new Date("2026-07-20T00:00:00.000Z"),
    dueDate: new Date("2026-07-20T00:00:00.000Z"),
    actualStartDate: new Date("2026-07-20T00:00:00.000Z"),
    actualDueDate: new Date("2026-07-20T00:00:00.000Z"),
    isDelayedCompletion: false,
    delayedCompletionDate: null,
    delayDays: null,
    status: "completed",
    weight: 0,
    createdBy: "user-uuid-1",
    version: 1,
    createdAt: new Date("2026-07-20T00:00:00.000Z"),
    updatedAt: new Date("2026-07-20T00:00:00.000Z"),
    archivedAt: null,
    owner: { name: "정재균", userId: "023017" },
    group: null,
    assignments: [],
    deliverable: null,
  },
  {
    id: "item-2",
    displayId: "WBS-002",
    projectId: "project-1",
    parentId: "item-1",
    path: "0001.0001",
    level: 2,
    name: "착수",
    description: "",
    configStatus: "",
    ownerUserId: "user-uuid-1",
    ownerNameRaw: "",
    ownerLoginId: "",
    groupId: null,
    startDate: new Date("2026-07-20T00:00:00.000Z"),
    dueDate: new Date("2026-07-20T00:00:00.000Z"),
    actualStartDate: new Date("2026-07-20T00:00:00.000Z"),
    actualDueDate: new Date("2026-07-20T00:00:00.000Z"),
    isDelayedCompletion: false,
    delayedCompletionDate: null,
    delayDays: null,
    status: "completed",
    weight: 0,
    createdBy: "user-uuid-1",
    version: 1,
    createdAt: new Date("2026-07-20T00:00:00.000Z"),
    updatedAt: new Date("2026-07-20T00:00:00.000Z"),
    archivedAt: null,
    owner: { name: "정재균", userId: "023017" },
    group: null,
    assignments: [],
    deliverable: null,
  },
  {
    id: "item-3",
    displayId: "WBS-003",
    projectId: "project-1",
    parentId: "item-2",
    path: "0001.0001.0001",
    level: 3,
    name: "인력투입",
    description: "",
    configStatus: "",
    ownerUserId: "user-uuid-1",
    ownerNameRaw: "",
    ownerLoginId: "",
    groupId: null,
    startDate: new Date("2026-07-20T00:00:00.000Z"),
    dueDate: new Date("2026-07-20T00:00:00.000Z"),
    actualStartDate: new Date("2026-07-20T00:00:00.000Z"),
    actualDueDate: new Date("2026-07-20T00:00:00.000Z"),
    isDelayedCompletion: false,
    delayedCompletionDate: null,
    delayDays: null,
    status: "completed",
    weight: 0,
    createdBy: "user-uuid-1",
    version: 1,
    createdAt: new Date("2026-07-20T00:00:00.000Z"),
    updatedAt: new Date("2026-07-20T00:00:00.000Z"),
    archivedAt: null,
    owner: { name: "정재균", userId: "023017" },
    group: null,
    assignments: [],
    deliverable: null,
  },
  // Subtask of item-3 owned by someone else so item-3 is NOT a leaf
  {
    id: "item-4",
    displayId: "WBS-004",
    projectId: "project-1",
    parentId: "item-3",
    path: "0001.0001.0001.0001",
    level: 4,
    name: "세부작업",
    description: "",
    configStatus: "",
    ownerUserId: "other-user",
    ownerNameRaw: "",
    ownerLoginId: "",
    groupId: null,
    startDate: new Date("2026-07-20T00:00:00.000Z"),
    dueDate: new Date("2026-07-20T00:00:00.000Z"),
    actualStartDate: new Date("2026-07-20T00:00:00.000Z"),
    actualDueDate: new Date("2026-07-20T00:00:00.000Z"),
    isDelayedCompletion: false,
    delayedCompletionDate: null,
    delayDays: null,
    status: "completed",
    weight: 0,
    createdBy: "other-user",
    version: 1,
    createdAt: new Date("2026-07-20T00:00:00.000Z"),
    updatedAt: new Date("2026-07-20T00:00:00.000Z"),
    archivedAt: null,
    owner: { name: "이정우", userId: "183209" },
    group: null,
    assignments: [],
    deliverable: null,
  },
];

vi.mock("@/lib/server/db-pg", () => ({
  getPrisma: () => ({
    project: {
      findUnique: async () => ({ code: "PRJ-001" }),
    },
    projectMember: {
      findFirst: async () => mockMember,
    },
    wbsItem: {
      findMany: async () => mockItems,
    },
    holiday: {
      findMany: async () => [],
    },
  }),
}));

import { getWbsOwnerStatus, listWbsItemsExcelColumns } from "./wbs";

describe("getWbsOwnerStatus", () => {
  it("falls back to all assigned tasks when owner has only non-leaf tasks", async () => {
    const status = await getWbsOwnerStatus("project-1", "023017");
    expect(status).not.toBeNull();
    expect(status?.items).toHaveLength(3);
    // All 3 items owned by user-uuid-1 are non-leaves because item-1 has item-2, item-2 has item-3, item-3 has item-4.
    expect(status?.items.every((i) => !i.isLeaf)).toBe(true);
    // Overall progress should be 100% (1.0), not 0%
    expect(status?.overall.progressIndex).toBe(1);
    expect(status?.overall.planned).toBe(1);
    expect(status?.overall.actual).toBe(1);
    expect(status?.hasDelayed).toBe(false);
  });

  it("filters out completed items when excludeCompleted is true", async () => {
    // 모든 mockItems는 status: 'completed' 및 actualDueDate가 설정되어 100% 완료 상태임
    const withExclude = await listWbsItemsExcelColumns("project-1", { pageSize: "all", excludeCompleted: true });
    expect(withExclude.rows).toHaveLength(0);
    expect(withExclude.total).toBe(0);

    const withoutExclude = await listWbsItemsExcelColumns("project-1", { pageSize: "all", excludeCompleted: false });
    expect(withoutExclude.rows).toHaveLength(4);
    expect(withoutExclude.total).toBe(4);
  });

  it("keeps only CP targets sorted by working days when cp is set", async () => {
    // mockItems는 모두 상위 항목이 있는 체인이라 leaf는 마지막 1건뿐이다.
    const all = await listWbsItemsExcelColumns("project-1", { pageSize: "all", excludeCompleted: false });
    const cp = await listWbsItemsExcelColumns("project-1", { pageSize: "all", excludeCompleted: false, cp: true, cpMinWorkingDays: 1 });
    const expected = all.rows.filter((row) => row.isLeaf && row.workingDays !== null && row.workingDays >= 1);
    expect(cp.rows.map((row) => row.id)).toEqual(expected.map((row) => row.id));
    const none = await listWbsItemsExcelColumns("project-1", { pageSize: "all", excludeCompleted: false, cp: true, cpMinWorkingDays: 10_000 });
    expect(none.total).toBe(0);
  });
});

