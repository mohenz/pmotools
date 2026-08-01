import { describe, expect, it } from "vitest";
import { csvCell } from "./csv";

describe("csvCell", () => {
  it("quotes and escapes text", () => expect(csvCell('일정 "지연"')).toBe('"일정 ""지연"""'));
  it("blocks spreadsheet formulas", () => expect(csvCell("=1+1")).toBe('"\'=1+1"'));
  it("handles null", () => expect(csvCell(null)).toBe('""'));
});

