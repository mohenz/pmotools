import { describe, expect, it } from "vitest";
import { formatSessions, isValidSession, meetingMinuteFileName } from "./meeting-minutes";

describe("회의록 양식 규칙", () => {
  it("builds the file name like the source template", () => {
    expect(meetingMinuteFileName("2026-09-28", "DES", "상품전시 내부리뷰")).toBe("EOCP_20260928_DES_상품전시 내부리뷰");
    expect(meetingMinuteFileName("2026-09-28", "", "주간 회의")).toBe("EOCP_20260928_주간 회의");
    expect(meetingMinuteFileName("2026-09-28", "DES", "FO/BO: 리뷰?")).toBe("EOCP_20260928_DES_FO BO 리뷰");
  });

  it("formats and validates multiple sessions", () => {
    expect(formatSessions([{ start: "09:30", end: "12:00" }, { start: "13:30", end: "15:00" }])).toBe("09:30~12:00, 13:30~15:00");
    expect(isValidSession({ start: "09:30", end: "12:00" })).toBe(true);
    expect(isValidSession({ start: "12:00", end: "09:30" })).toBe(false);
    expect(isValidSession({ start: "9:30", end: "12:00" })).toBe(false);
  });
});
