import { describe, expect, it } from "vitest";
import { metricsOfLeaves, projectStatusOf, scheduleWarningOf, sumMetrics, type PortfolioLeafInput } from "@/lib/domain/project-portfolio";

const TODAY = "2026-10-20";
const leaf = (over: Partial<PortfolioLeafInput> = {}): PortfolioLeafInput => ({ weight: null, workingDays: 10, plannedProgress: 0.5, actualProgress: 0, isDelayed: false, dueDate: "2026-11-30", ...over });

describe("metricsOfLeaves", () => {
  it("Task가 없으면 건수 0, 비율은 null", () => {
    const m = metricsOfLeaves([], TODAY);
    expect(m.totalCount).toBe(0);
    expect(m.progress).toBeNull();
    expect(m.expectedProgress).toBeNull();
    expect(m.delayRate).toBeNull();
  });

  it("완료는 실적 100%, 미완료는 전체 − 완료", () => {
    const m = metricsOfLeaves([leaf({ actualProgress: 1 }), leaf({ actualProgress: 0.99 }), leaf()], TODAY);
    expect(m.totalCount).toBe(3);
    expect(m.completedCount).toBe(1);
    expect(m.incompleteCount).toBe(2);
  });

  it("공정율·예상공정율은 가중치(없으면 영업일수) 가중 평균", () => {
    const m = metricsOfLeaves([
      leaf({ weight: 3, workingDays: 99, plannedProgress: 1, actualProgress: 1 }),
      leaf({ weight: null, workingDays: 1, plannedProgress: 0, actualProgress: 0 }),
    ], TODAY);
    expect(m.progress).toBeCloseTo(0.75);
    expect(m.expectedProgress).toBeCloseTo(0.75);
  });

  it("지연율 모수는 계획종료일이 오늘 이전인 Task", () => {
    const m = metricsOfLeaves([
      leaf({ dueDate: "2026-10-01", isDelayed: true }),
      leaf({ dueDate: "2026-10-19", isDelayed: false, actualProgress: 1 }),
      leaf({ dueDate: TODAY }),
      leaf({ dueDate: null }),
    ], TODAY);
    expect(m.delayedCount).toBe(1);
    expect(m.delayTrackedCount).toBe(2);
    expect(m.delayRate).toBeCloseTo(0.5);
  });
});

describe("sumMetrics", () => {
  it("공정율은 프로젝트 평균이 아니라 가중치 합으로 재계산", () => {
    const small = metricsOfLeaves([leaf({ weight: 1, actualProgress: 1 })], TODAY);
    const large = metricsOfLeaves(Array.from({ length: 9 }, () => leaf({ weight: 1, actualProgress: 0 })), TODAY);
    const total = sumMetrics([small, large]);
    expect(total.totalCount).toBe(10);
    expect(total.progress).toBeCloseTo(0.1); // 단순 평균이면 0.5
  });

  it("빈 목록은 0건", () => {
    expect(sumMetrics([]).totalCount).toBe(0);
  });
});

describe("projectStatusOf", () => {
  it("공정율 1% 미만이면 예정 — Task 없음 포함", () => {
    expect(projectStatusOf({ totalCount: 0, completedCount: 0, progress: null })).toBe("PLANNED");
    expect(projectStatusOf({ totalCount: 10, completedCount: 0, progress: 0.0099 })).toBe("PLANNED");
  });

  it("1% 이상이면 진행", () => {
    expect(projectStatusOf({ totalCount: 10, completedCount: 0, progress: 0.01 })).toBe("IN_PROGRESS");
    expect(projectStatusOf({ totalCount: 10, completedCount: 9, progress: 0.9999 })).toBe("IN_PROGRESS");
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
