import { describe, expect, it } from "vitest";
import { calculateWeeklyReportPeriod, inferWeekOfMonth, weeklyReportName } from "@/lib/domain/weekly-reports";

describe("calculateWeeklyReportPeriod", () => {
  it("2026년 8월 4주 실적·계획 기간을 월~금으로 계산한다", () => {
    expect(calculateWeeklyReportPeriod(2026, 8, 4)).toEqual({
      year: 2026,
      month: 8,
      weekOfMonth: 4,
      weekKey: "2026-08-W4",
      label: "2026년 8월 4주",
      actualStart: "2026-08-17",
      actualEnd: "2026-08-21",
      planStart: "2026-08-24",
      planEnd: "2026-08-28",
    });
  });

  it("해당 월에 존재하지 않는 주차를 거부한다", () => {
    expect(() => calculateWeeklyReportPeriod(2026, 2, 5)).toThrow("2월에는 5주가 없습니다.");
  });

  it("시작일에서 월 주차를 역산한다", () => {
    expect(inferWeekOfMonth("2026-08-24")).toBe(4);
  });
});

describe("weeklyReportName", () => {
  it("PMO CONTROL 프로젝트의 신규·기존 리포트명에서 CONTROL을 제외한다", () => {
    expect(weeklyReportName("2026년 8월 4주", "PMO CONTROL")).toBe("2026년 8월 4주 PMO 위클리 리포트");
  });

  it("PMO 통제 프로젝트의 신규·기존 리포트명에서 통제 프로젝트를 제외한다", () => {
    expect(weeklyReportName("2026년 8월 4주", "PMO 통제 프로젝트")).toBe("2026년 8월 4주 PMO 위클리 리포트");
  });

  it("다른 프로젝트명은 그대로 유지한다", () => {
    expect(weeklyReportName("2026년 8월 4주", "차세대 시스템")).toBe("2026년 8월 4주 차세대 시스템 위클리 리포트");
  });
});
