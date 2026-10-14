import { describe, expect, it } from "vitest";
import { formatWorkPeriod, isHiddenToday, koreaDateKey, parseKoreaDateTime, toKoreaDateTimeInput, validateWorkNoticeTimes, workImpactLabel, workNoticePhase } from "./work-notice";

const kst = (value: string) => new Date(`${value}:00+09:00`);

describe("작업 알림", () => {
  it("단계: 안내 전 → 예정 → 작업 중 → 종료", () => {
    const [n, s, e] = ["2026-10-01T09:00", "2026-10-02T20:00", "2026-10-02T20:10"].map(kst);
    expect(workNoticePhase(kst("2026-10-01T08:59"), n, s, e)).toBe("BEFORE_NOTICE");
    expect(workNoticePhase(kst("2026-10-01T09:00"), n, s, e)).toBe("SCHEDULED");
    expect(workNoticePhase(kst("2026-10-02T20:05"), n, s, e)).toBe("IN_PROGRESS");
    expect(workNoticePhase(kst("2026-10-02T20:10"), n, s, e)).toBe("ENDED");
  });

  it("시각 검증", () => {
    const [n, s, e] = ["2026-10-01T09:00", "2026-10-02T20:00", "2026-10-02T20:10"].map(kst);
    expect(validateWorkNoticeTimes(n, s, e)).toBeNull();
    expect(validateWorkNoticeTimes(null, s, e)).toContain("모두 입력");
    expect(validateWorkNoticeTimes(e, s, e)).toContain("안내 시작");
    expect(validateWorkNoticeTimes(n, e, s)).toContain("작업 종료");
    expect(validateWorkNoticeTimes(n, s, s)).toContain("작업 종료");
  });

  it("오늘 하루 보지 않기: 한국 날짜 기준", () => {
    expect(koreaDateKey(new Date("2026-10-01T15:30:00Z"))).toBe("2026-10-02"); // UTC 15:30 = KST 다음날 00:30
    expect([isHiddenToday("2026-10-02", "2026-10-02"), isHiddenToday("2026-10-01", "2026-10-02"), isHiddenToday(null, "2026-10-02")]).toEqual([true, false, false]);
  });

  it("표시·입력 변환(한국 시간)", () => {
    expect(formatWorkPeriod(kst("2026-10-02T20:00"), kst("2026-10-02T20:10"))).toBe("2026-10-02 (금) 20:00 ~ 20:10");
    expect(formatWorkPeriod(kst("2026-10-02T23:00"), kst("2026-10-03T02:00"))).toBe("2026-10-02 (금) 23:00 ~ 10-03 (토) 02:00");
    expect(parseKoreaDateTime("2026-10-02T20:00")?.toISOString()).toBe("2026-10-02T11:00:00.000Z");
    expect([parseKoreaDateTime(""), parseKoreaDateTime("2026-10-02")]).toEqual([null, null]);
    expect(toKoreaDateTimeInput("2026-10-02T11:00:00.000Z")).toBe("2026-10-02T20:00");
    expect(workImpactLabel("OUTAGE")).toBe("접속 중단");
  });
});
