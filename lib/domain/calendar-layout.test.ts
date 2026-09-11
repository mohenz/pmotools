import { describe, expect, it } from "vitest";
import { calendarDateKey, calendarDayDifference, calendarOverlapLayout, calendarTimePlacement, calendarTodayKey } from "@/lib/domain/calendar-layout";

describe("calendarTodayKey", () => {
  it("한국시간 자정 이후에는 UTC 날짜가 아닌 한국 날짜를 반환한다", () => {
    expect(calendarTodayKey(new Date("2026-08-19T15:30:00.000Z"))).toBe("2026-08-20");
  });

  it("한국시간 자정 직전에는 현재 한국 날짜를 유지한다", () => {
    expect(calendarTodayKey(new Date("2026-08-19T14:59:59.999Z"))).toBe("2026-08-19");
  });

  it("일정 시각을 한국 날짜로 변환한다", () => {
    expect(calendarDateKey(new Date("2026-08-19T15:30:00.000Z"))).toBe("2026-08-20");
  });

  it("시각을 제외한 날짜 차이로 D-Day를 계산한다", () => {
    expect(calendarDayDifference("2026-08-20", "2026-08-20")).toBe(0);
    expect(calendarDayDifference("2026-08-21", "2026-08-20")).toBe(1);
    expect(calendarDayDifference("2026-08-19", "2026-08-20")).toBe(-1);
  });
});

describe("calendarTimePlacement", () => {
  it("15:00~17:00 일정을 4개 슬롯 높이로 표시한다", () => {
    expect(calendarTimePlacement("15:00", 120)).toEqual({ slot: 900, offsetPx: 0, heightPx: 144 });
  });

  it("10분 단위 시작 시각을 직전 30분 슬롯 안에 배치한다", () => {
    expect(calendarTimePlacement("15:10", 50)).toEqual({ slot: 900, offsetPx: 12, heightPx: 60 });
  });

  it("캘린더 종료 시각을 넘어가는 높이는 화면 범위로 제한한다", () => {
    expect(calendarTimePlacement("17:30", 120)).toEqual({ slot: 1050, offsetPx: 0, heightPx: 36 });
  });
});

describe("calendarOverlapLayout", () => {
  it("같은 시간의 일정을 서로 다른 열에 배치한다", () => {
    expect(calendarOverlapLayout([
      { id: "a", startTime: "10:00", durationMinutes: 120 },
      { id: "b", startTime: "10:00", durationMinutes: 60 },
      { id: "c", startTime: "10:30", durationMinutes: 30 },
    ])).toEqual({ a: { column: 0, columnCount: 3 }, b: { column: 1, columnCount: 3 }, c: { column: 2, columnCount: 3 } });
  });

  it("종료 시각과 시작 시각이 같은 일정은 열을 재사용한다", () => {
    expect(calendarOverlapLayout([
      { id: "a", startTime: "10:00", durationMinutes: 60 },
      { id: "b", startTime: "11:00", durationMinutes: 60 },
    ])).toEqual({ a: { column: 0, columnCount: 1 }, b: { column: 0, columnCount: 1 } });
  });

  it("연쇄적으로 겹치는 일정은 하나의 충돌 그룹으로 계산한다", () => {
    expect(calendarOverlapLayout([
      { id: "a", startTime: "10:00", durationMinutes: 60 },
      { id: "b", startTime: "10:30", durationMinutes: 60 },
      { id: "c", startTime: "11:00", durationMinutes: 60 },
    ])).toEqual({ a: { column: 0, columnCount: 2 }, b: { column: 1, columnCount: 2 }, c: { column: 0, columnCount: 2 } });
  });
});
