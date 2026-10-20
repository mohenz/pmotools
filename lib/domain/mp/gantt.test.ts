import { describe, expect, it } from "vitest";
import { buildGanttRows, ganttRange, ganttTicks, groupGanttSourcesByProject, isGanttProjectRow, leafState, type GanttSource } from "./gantt";

const src = (over: Partial<GanttSource> & { id: string }): GanttSource => ({
  parentId: null, code: over.id, name: over.id, level: 1, stage: "분석", isLeaf: true, ownerUserId: null, ownerName: null, ownerLoginId: null, groupLabel: null,
  startDate: "2026-09-01", dueDate: "2026-09-10", actualStartDate: null, actualDueDate: null, plannedProgress: 0.5, actualProgress: 0, weight: null, workingDays: 8,
  isDelayed: false, isDelayedCompletion: false, delayDays: null, ...over,
});

// 1(분석) ─ 1.1 ─ 1.1.1(완료, 김) · 1.1.2(지연, 이, 1일짜리) ; 2(설계) ─ 2.1(진행, 김)
const items: GanttSource[] = [
  src({ id: "1", isLeaf: false, startDate: null, dueDate: null }),
  src({ id: "1.1", parentId: "1", isLeaf: false, level: 2, startDate: null, dueDate: null }),
  src({ id: "1.1.1", parentId: "1.1", level: 3, ownerUserId: "u1", ownerName: "김", startDate: "2026-09-01", dueDate: "2026-09-05", actualStartDate: "2026-09-01", actualDueDate: "2026-09-05", actualProgress: 1, workingDays: 5 }),
  src({ id: "1.1.2", parentId: "1.1", level: 3, ownerUserId: "u2", ownerName: "이", startDate: "2026-09-20", dueDate: "2026-09-20", isDelayed: true, workingDays: 1, delayDays: 3 }),
  src({ id: "2", isLeaf: false, stage: "설계", startDate: null, dueDate: null }),
  src({ id: "2.1", parentId: "2", level: 2, stage: "설계", ownerUserId: "u1", ownerName: "김", startDate: "2026-10-01", dueDate: "2026-10-20", actualStartDate: "2026-10-01", actualProgress: 0.3, workingDays: 14 }),
];

describe("WBS2 간트", () => {
  it("상태 판정: 완료·지연완료·지연·진행·미착수", () => {
    expect(leafState({ actualDueDate: "2026-09-05", actualStartDate: "2026-09-01", actualProgress: 1, isDelayed: false, isDelayedCompletion: false })).toBe("completed");
    expect(leafState({ actualDueDate: "2026-09-08", actualStartDate: "2026-09-01", actualProgress: 1, isDelayed: false, isDelayedCompletion: true })).toBe("delayedCompletion");
    expect(leafState({ actualDueDate: null, actualStartDate: null, actualProgress: 0, isDelayed: true, isDelayedCompletion: false })).toBe("delayed");
    expect(leafState({ actualDueDate: null, actualStartDate: "2026-09-01", actualProgress: 0.2, isDelayed: false, isDelayedCompletion: false })).toBe("inProgress");
    expect(leafState({ actualDueDate: null, actualStartDate: null, actualProgress: 0, isDelayed: false, isDelayedCompletion: false })).toBe("notStarted");
  });

  it("상위 단계는 하위 Task로 기간·진척·상태를 요약하고, 하루짜리 Task는 마일스톤", () => {
    const rows = buildGanttRows(items);
    expect(rows.map((r) => `${r.id}:${r.depth}`)).toEqual(["1:0", "1.1:1", "1.1.1:2", "1.1.2:2", "2:0", "2.1:1"]);
    const stage = rows.find((r) => r.id === "1")!;
    expect([stage.start, stage.due, stage.state, stage.hasChildren]).toEqual(["2026-09-01", "2026-09-20", "delayed", true]);
    expect(stage.actual).toBeCloseTo(1 / 2); // 건수 기준(2026-10-20): 하위 Task 2건 중 1건 완료
    expect(rows.find((r) => r.id === "1.1.2")!.milestone).toBe(true);
  });

  it("필터는 최하위 Task에만 적용하고 상위 단계는 남긴다", () => {
    expect(buildGanttRows(items, { delayed: true }).map((r) => r.id)).toEqual(["1", "1.1", "1.1.2"]);
    expect(buildGanttRows(items, { ownerUserId: "u1" }).map((r) => r.id)).toEqual(["1", "1.1", "1.1.1", "2", "2.1"]);
    expect(buildGanttRows(items, { cp: true, cpMinWorkingDays: 5 }).map((r) => r.id)).toEqual(["1", "1.1", "1.1.1", "2", "2.1"]);
    expect(buildGanttRows(items, { excludeCompleted: true, stage: "설계" }).map((r) => r.id)).toEqual(["2", "2.1"]);
  });

  it("표시 기간은 월요일에서 시작하고 오늘을 포함, 주 눈금은 월요일 기준", () => {
    const range = ganttRange(buildGanttRows(items), "2026-09-30");
    expect(new Date(`${range.start}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(range.start <= "2026-08-25").toBe(true);
    expect(range.end).toBe("2026-11-03");
    const { top, bottom } = ganttTicks(range, "week");
    expect(bottom.every((t) => t.days <= 7)).toBe(true);
    expect(top.map((t) => t.label)).toContain("2026.09");
  });

  it("최상위 통합: 프로젝트 요약 행 아래에 각 프로젝트 트리, 코드가 겹쳐도 분리", () => {
    const b = [src({ id: "b1", code: "1", isLeaf: false, startDate: null, dueDate: null }), src({ id: "b1.1", code: "1.1", parentId: "b1", level: 2, startDate: "2026-11-01", dueDate: "2026-11-05", isDelayed: true })];
    const merged = groupGanttSourcesByProject([{ id: "pa", code: "A", name: "프로젝트A", items }, { id: "pb", code: "B", name: "프로젝트B", items: b }]);
    const rows = buildGanttRows(merged);
    expect(rows.filter((r) => isGanttProjectRow(r.id)).map((r) => `${r.code}:${r.depth}`)).toEqual(["A:0", "B:0"]);
    expect(rows.find((r) => r.id === "1")!.depth).toBe(1);
    const projectB = rows.find((r) => r.id === "project:pb")!;
    expect([projectB.start, projectB.due, projectB.state]).toEqual(["2026-11-01", "2026-11-05", "delayed"]);
    expect(buildGanttRows(merged, { delayed: true }).map((r) => r.id)).toEqual(["project:pa", "1", "1.1", "1.1.2", "project:pb", "b1", "b1.1"]);
  });
});
