import { describe, expect, it } from "vitest";
import { metricsOfLeaves, projectStatusOf, scheduleWarningOf, sumMetrics, type PortfolioLeafInput } from "@/lib/domain/project-portfolio";

const TODAY = "2026-10-20";
const leaf = (over: Partial<PortfolioLeafInput> = {}): PortfolioLeafInput => ({ actualProgress: 0, isDelayed: false, dueDate: "2026-11-30", ...over });

describe("metricsOfLeaves (건수 기준)", () => {
  it("Task가 없으면 건수 0, 비율은 null", () => {
    const m = metricsOfLeaves([], TODAY);
    expect(m.totalCount).toBe(0);
    expect(m.progress).toBeNull();
    expect(m.expectedProgress).toBeNull();
    expect(m.delayRate).toBeNull();
  });

  it("공정율 = 완료 ÷ 전체 — 완료는 실적 100%", () => {
    const m = metricsOfLeaves([leaf({ actualProgress: 1 }), leaf({ actualProgress: 0.99 }), leaf(), leaf({ actualProgress: 1 })], TODAY);
    expect(m.completedCount).toBe(2);
    expect(m.incompleteCount).toBe(2);
    expect(m.progress).toBeCloseTo(0.5);
  });

  it("사용자 예시: 2155건 중 991건 완료면 46%", () => {
    const leaves = Array.from({ length: 2155 }, (_, i) => leaf({ actualProgress: i < 991 ? 1 : 0 }));
    expect(Math.round(metricsOfLeaves(leaves, TODAY).progress! * 100)).toBe(46);
  });

  it("예상공정율 = 계획종료일이 오늘 이하인 Task ÷ 전체", () => {
    const m = metricsOfLeaves([leaf({ dueDate: "2026-10-01" }), leaf({ dueDate: TODAY }), leaf({ dueDate: "2026-10-21" }), leaf({ dueDate: null })], TODAY);
    expect(m.plannedDueCount).toBe(2);
    expect(m.expectedProgress).toBeCloseTo(0.5);
  });

  it("지연율 = 지연 Task ÷ 계획종료일이 오늘 이전인 Task (오늘 종료 예정은 분모 제외)", () => {
    const m = metricsOfLeaves([
      leaf({ dueDate: "2026-10-01", isDelayed: true }),
      leaf({ dueDate: "2026-10-19", actualProgress: 1 }),
      leaf({ dueDate: TODAY }),
      leaf({ dueDate: null }),
    ], TODAY);
    expect(m.delayedCount).toBe(1);
    expect(m.delayTrackedCount).toBe(2);
    expect(m.delayRate).toBeCloseTo(0.5);
  });
});

describe("sumMetrics", () => {
  it("비율은 프로젝트 평균이 아니라 건수 합으로 재계산", () => {
    const small = metricsOfLeaves([leaf({ actualProgress: 1 })], TODAY);
    const large = metricsOfLeaves(Array.from({ length: 9 }, () => leaf()), TODAY);
    const total = sumMetrics([small, large]);
    expect(total.totalCount).toBe(10);
    expect(total.completedCount).toBe(1);
    expect(total.progress).toBeCloseTo(0.1); // 단순 평균이면 0.5
  });

  it("빈 목록은 0건", () => {
    expect(sumMetrics([]).totalCount).toBe(0);
  });
});

describe("projectStatusOf", () => {
  it("공정율 1% 미만이면 예정 — Task 없음 포함", () => {
    expect(projectStatusOf({ totalCount: 0, completedCount: 0, progress: null })).toBe("PLANNED");
    expect(projectStatusOf({ totalCount: 200, completedCount: 1, progress: 0.005 })).toBe("PLANNED");
  });

  it("1% 이상이면 진행", () => {
    expect(projectStatusOf({ totalCount: 100, completedCount: 1, progress: 0.01 })).toBe("IN_PROGRESS");
    expect(projectStatusOf({ totalCount: 10, completedCount: 9, progress: 0.9 })).toBe("IN_PROGRESS");
  });

  it("전 Task 완료면 완료", () => {
    expect(projectStatusOf({ totalCount: 10, completedCount: 10, progress: 1 })).toBe("COMPLETED");
  });
});

describe("scheduleWarningOf", () => {
  it("종료일이 지났는데 미완료면 종료일 경과", () => {
    expect(scheduleWarningOf("IN_PROGRESS", "2026-01-01", "2026-10-19", TODAY)).toBe("종료일 경과");
    expect(scheduleWarningOf("COMPLETED", "2026-01-01", "2026-10-19", TODAY)).toBeNull();
  });

  it("시작일이 지났는데 예정이면 착수 지연", () => {
    expect(scheduleWarningOf("PLANNED", "2026-10-01", "2026-12-31", TODAY)).toBe("착수 지연");
    expect(scheduleWarningOf("PLANNED", TODAY, "2026-12-31", TODAY)).toBeNull();
  });
});
