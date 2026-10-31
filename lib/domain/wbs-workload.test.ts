import { describe, expect, it } from "vitest";
import { analyzeWorkload, rateProductivity, type WorkloadTask } from "./wbs-workload";

const task = (ownerKey: string | null, startDate: string | null, dueDate: string | null, groupLabel = "개발", completed = false, actualDueDate: string | null = null): WorkloadTask => ({ ownerKey, ownerName: ownerKey, groupLabel, startDate, dueDate, completed, actualDueDate });

describe("analyzeWorkload", () => {
  it("returns an empty analysis when no task has a valid schedule", () => {
    const result = analyzeWorkload([task("a", null, "2026-10-05"), task("b", "2026-10-09", "2026-10-01")]);
    expect(result.months).toEqual([]);
    expect(result.excludedTasks).toBe(2);
  });

  it("spans every month between the first start and last due date", () => {
    const result = analyzeWorkload([task("a", "2026-10-26", "2026-10-30"), task("a", "2026-12-01", "2026-12-04")]);
    expect(result.months).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(result.timeline.map((row) => row.started)).toEqual([1, 0, 1]);
  });

  it("measures load as average concurrent tasks over the month's business days", () => {
    // 2026-11: 영업일 21일. 두 Task가 11월 전체(1~30일)에 걸치면 부하 2.0.
    const result = analyzeWorkload([task("a", "2026-11-01", "2026-11-30"), task("a", "2026-11-01", "2026-11-30")]);
    expect(result.timeline[0].businessDays).toBe(21);
    expect(result.owners[0].loads).toEqual([2]);
  });

  it("counts unassigned tasks separately from owner load", () => {
    const result = analyzeWorkload([task(null, "2026-11-02", "2026-11-06"), task("a", "2026-11-02", "2026-11-06")]);
    expect(result.unassignedTasks).toBe(1);
    expect(result.timeline[0].unassignedActive).toBe(1);
    expect(result.timeline[0].owners).toBe(1);
  });

  it("flags heavy and light owners against the monthly median", () => {
    const full = ["2026-11-02", "2026-11-30"] as const;
    const tasks = [
      task("a", ...full), task("b", ...full), task("c", ...full),
      task("d", ...full), task("d", ...full), task("d", ...full), // d는 중앙값의 3배
    ];
    const result = analyzeWorkload(tasks);
    const level = (key: string) => result.owners.find((owner) => owner.ownerKey === key)!.levels[0];
    expect(level("d")).toBe("heavy");
    expect(level("a")).toBe("normal");
    expect(result.timeline[0].balance).not.toBe("balanced");
  });

  it("reports gap months between an owner's first and last assignment", () => {
    const result = analyzeWorkload([task("a", "2026-10-05", "2026-10-09"), task("a", "2026-12-07", "2026-12-11")]);
    expect(result.owners[0].gapMonths).toBe(1);
  });

  it("measures output against tasks due by the as-of date", () => {
    const result = analyzeWorkload([
      task("a", "2026-11-02", "2026-11-06", "개발", true, "2026-11-06"), // 정시 완료
      task("a", "2026-11-02", "2026-11-06", "개발", true, "2026-11-10"), // 지연 완료
      task("a", "2026-11-02", "2026-11-06", "개발", false), // 기한 경과 미완료
      task("a", "2026-12-01", "2026-12-04", "개발", false), // 아직 도래 전
    ], "2026-11-30");
    const perf = result.owners[0].perf;
    expect(perf).toMatchObject({ assigned: 4, due: 3, dueDone: 2, done: 2, overdue: 1, doneOnTime: 1, doneDated: 2, grade: "C" });
    expect(perf.dueRate).toBeCloseTo(2 / 3, 5);
    expect(perf.onTimeRate).toBe(0.5);
    expect(perf.dayRate).toBeCloseTo(2 / 3, 5);
  });

  it("computes throughput per unit of load up to the as-of month and compares owners within a group", () => {
    const full = (key: string, done: boolean) => task(key, "2026-11-02", "2026-11-30", "개발", done, done ? "2026-11-30" : null);
    const tasks = [
      ...Array.from({ length: 10 }, () => full("fast", true)),
      ...Array.from({ length: 10 }, (_, i) => full("slow", i < 5)),
    ];
    const result = analyzeWorkload(tasks, "2026-11-30");
    const byKey = (key: string) => result.owners.find((owner) => owner.ownerKey === key)!.perf;
    expect(byKey("fast").grade).toBe("A");
    expect(byKey("fast").dueRate).toBe(1);
    expect(byKey("slow").dueRate).toBe(0.5);
    expect(byKey("fast").throughput!).toBeGreaterThan(byKey("slow").throughput!);
    expect(result.groups[0].rateMin).toBe(0.5);
    expect(result.groups[0].rateMax).toBe(1);
  });

  it("reports how concentrated task starts are", () => {
    const result = analyzeWorkload([task("a", "2026-10-05", "2026-10-09"), task("b", "2026-10-06", "2026-10-09"), task("c", "2026-11-02", "2026-11-06")]);
    expect(result.peakStartMonth).toBe("2026-10");
    expect(result.peakStartShare).toBeCloseTo(0.67, 2);
  });
});

describe("rateProductivity", () => {
  it("rates by on-due completion rate with fixed boundaries", () => {
    expect(rateProductivity({ dueRate: 0.95, grade: "A" })).toBe("high");
    expect(rateProductivity({ dueRate: 0.949, grade: "A" })).toBe("mid");
    expect(rateProductivity({ dueRate: 0.8, grade: "B" })).toBe("mid");
    expect(rateProductivity({ dueRate: 0.799, grade: "B" })).toBe("low");
  });

  it("does not rate samples that are too small to compare", () => {
    expect(rateProductivity({ dueRate: 1, grade: "C" })).toBeNull();
    expect(rateProductivity({ dueRate: null, grade: "D" })).toBeNull();
  });
});

describe("group ordering", () => {
  it("orders owners and groups by groupOrder before label", () => {
    const withOrder = (key: string, groupLabel: string, groupOrder: string): WorkloadTask => ({ ...task(key, "2026-11-02", "2026-11-06", groupLabel), groupOrder });
    const result = analyzeWorkload([withOrder("a", "[A] 개발", "0001·X"), withOrder("b", "[B] 개발", "0000·X"), withOrder("c", "미지정", "￿")]);
    expect(result.groups.map((group) => group.groupLabel)).toEqual(["[B] 개발", "[A] 개발", "미지정"]);
    expect(result.owners.map((owner) => owner.ownerKey)).toEqual(["b", "a", "c"]);
  });
});
