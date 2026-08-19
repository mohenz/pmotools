import { describe, expect, it } from "vitest";
import { calendarTimePlacement } from "@/lib/domain/calendar-layout";

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
