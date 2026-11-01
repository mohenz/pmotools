import { describe, expect, it } from "vitest";
import { mergeHolidaysByDate, parseHolidayMarkdown, parseRestDeResponse } from "./public-holidays";

const body = (items: unknown) => ({ response: { body: { items } } });

describe("parseRestDeResponse", () => {
  it("reads an item array and keeps only holiday rows", () => {
    const result = parseRestDeResponse(body({ item: [
      { locdate: 20260101, dateName: "1월1일", isHoliday: "Y" },
      { locdate: 20260102, dateName: "근무일", isHoliday: "N" },
    ] }));
    expect(result).toEqual([{ date: "2026-01-01", label: "1월1일" }]);
  });

  it("reads a single item given as an object", () => {
    expect(parseRestDeResponse(body({ item: { locdate: "20260505", dateName: "어린이날", isHoliday: "Y" } }))).toEqual([{ date: "2026-05-05", label: "어린이날" }]);
  });

  it("returns nothing for an empty month or malformed body", () => {
    expect(parseRestDeResponse(body(""))).toEqual([]);
    expect(parseRestDeResponse({})).toEqual([]);
    expect(parseRestDeResponse(body({ item: { locdate: "bad", dateName: "x", isHoliday: "Y" } }))).toEqual([]);
  });
});

describe("mergeHolidaysByDate", () => {
  it("joins names that share a date and sorts by date", () => {
    expect(mergeHolidaysByDate([
      { date: "2026-05-05", label: "어린이날" },
      { date: "2026-01-01", label: "신정" },
      { date: "2026-05-05", label: "대체공휴일" },
      { date: "2026-05-05", label: "어린이날" },
    ])).toEqual([{ date: "2026-01-01", label: "신정" }, { date: "2026-05-05", label: "어린이날, 대체공휴일" }]);
  });
});

describe("parseHolidayMarkdown", () => {
  it("reads date and name columns and skips headings, headers and separators", () => {
    const text = ["# 제목", "", "| 날짜 | 요일 | 이름 |", "| --- | --- | --- |", "| 2026-01-01 | 목 | 1월1일 |", "| 2026-03-02 | 월 | 대체공휴일(삼일절) |", "설명 줄"].join("\n");
    expect(parseHolidayMarkdown(text)).toEqual([{ date: "2026-01-01", label: "1월1일" }, { date: "2026-03-02", label: "대체공휴일(삼일절)" }]);
  });
});
