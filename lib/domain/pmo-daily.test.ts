import { describe, expect, it } from "vitest";
import { dailyTaskState, delayDays, delayedTaskCount, shiftBusinessDay, delayedTaskRate, overallProgress, scheduleProgress, taskDelayRate } from "./pmo-daily";

describe("PMO Daily calculations", () => {
  it("calculates progress and delayed task counts", () => {
    expect(scheduleProgress(10, 8)).toBe(80);
    expect(scheduleProgress(0, 0)).toBe(0);
    expect(delayedTaskCount(10, 8)).toBe(2);
    expect(delayedTaskCount(8, 10)).toBe(0);
    expect(taskDelayRate(70, 55)).toBe(15);
    expect(taskDelayRate(50, 60)).toBe(0);
  });

  it("calculates aggregate rates safely", () => {
    expect(delayedTaskRate(2, 8)).toBe(25);
    expect(delayedTaskRate(2, 0)).toBe(0);
    expect(overallProgress(3, 4, 10)).toBe(75);
    expect(overallProgress(0, 0, 40)).toBe(40);
  });

  it("calculates calendar delay days", () => {
    expect(delayDays("2026-08-20", "2026-08-27", false)).toBe(7);
    expect(delayDays("2026-08-30", "2026-08-27", false)).toBe(0);
    expect(delayDays("2026-08-20", "2026-08-27", true)).toBe(0);
  });

  it("classifies today's WBS task state", () => {
    const task = (startDate: string | null, dueDate: string | null, actualStartDate: string | null = null, actualDueDate: string | null = null) => ({ startDate, dueDate, actualStartDate, actualDueDate });
    expect(dailyTaskState("2026-09-28", task("2026-09-20", "2026-09-25", "2026-09-20", "2026-09-28"))).toBe("done");
    expect(dailyTaskState("2026-09-28", task("2026-09-20", "2026-09-25", "2026-09-20"))).toBe("delayed");
    expect(dailyTaskState("2026-09-28", task("2026-09-25", "2026-10-02"))).toBe("in_progress"); // 계획종료일 미도래 미착수는 WBS 규칙상 지연 아님
    expect(dailyTaskState("2026-09-28", task("2026-09-28", "2026-10-02"))).toBe("in_progress");
    expect(dailyTaskState("2026-09-28", task("2026-09-25", "2026-10-02", "2026-09-25"))).toBe("in_progress");
    expect(dailyTaskState("2026-09-28", task("2026-09-29", "2026-10-02"))).toBe("waiting");
  });

  it("shifts to adjacent business days", () => {
    expect(shiftBusinessDay("2026-09-28", -1)).toBe("2026-09-25");
    expect(shiftBusinessDay("2026-09-25", 1)).toBe("2026-09-28");
    expect(shiftBusinessDay("2026-09-29", 1, new Set(["2026-09-30"]))).toBe("2026-10-01");
  });
});
