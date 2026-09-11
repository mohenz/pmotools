import { describe, expect, it } from "vitest";
import { enumerateRecurringDates, seoulDateTime, validateMeetingTime } from "./meeting-rooms";

describe("meeting room domain", () => {
  it("enumerates ISO weekdays", () => {
    expect(enumerateRecurringDates("2026-08-10", "2026-08-16", { patternType: "WEEKLY", patternDetail: { daysOfWeek: [1, 3] } })).toEqual(["2026-08-10", "2026-08-12"]);
  });
  it("skips missing monthly dates", () => {
    expect(enumerateRecurringDates("2026-02-01", "2026-03-31", { patternType: "MONTHLY", patternDetail: { dayOfMonth: 31 } })).toEqual(["2026-03-31"]);
  });
  it("accepts Seoul business slots and rejects overlaps with the past", () => {
    const start = seoulDateTime("2026-08-12", 600), end = seoulDateTime("2026-08-12", 660);
    expect(validateMeetingTime(start, end, new Date("2026-08-11T00:00:00Z"))).toBeNull();
    expect(validateMeetingTime(start, end, new Date("2026-08-13T00:00:00Z"))).toContain("과거");
  });
});
