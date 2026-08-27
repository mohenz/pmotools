import { describe, expect, it } from "vitest";
import { delayDays, delayedTaskCount, delayedTaskRate, overallProgress, scheduleProgress, taskDelayRate } from "./pmo-daily";

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
});
