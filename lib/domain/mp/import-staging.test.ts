import { describe, expect, it } from "vitest";
import { canApplyStaging, isBlankRow, mapReportToRows, normalizeCellValue, patchCells, stagingSummary } from "./import-staging";

describe("엑셀 업로드 임시 저장", () => {
  it("셀 값 정규화: 날짜·리치텍스트·하이퍼링크·수식·오류·기본값", () => {
    expect(normalizeCellValue(new Date(Date.UTC(2026, 9, 5)))).toBe("2026-10-05");
    expect(normalizeCellValue({ richText: [{ text: "화면 " }, { text: "개발" }] })).toBe("화면 개발");
    expect(normalizeCellValue({ text: "링크", hyperlink: "http://x" })).toBe("링크");
    expect(normalizeCellValue({ text: "", hyperlink: "http://x" })).toBe("http://x");
    expect(normalizeCellValue({ formula: "A1+1", result: 3 })).toBe(3);
    expect(normalizeCellValue({ formula: "TODAY()", result: new Date(Date.UTC(2026, 8, 30)) })).toBe("2026-09-30");
    expect(normalizeCellValue({ error: "#N/A" })).toBeNull();
    expect([normalizeCellValue(null), normalizeCellValue(3.5), normalizeCellValue("I"), normalizeCellValue(true)]).toEqual([null, 3.5, "I", true]);
    expect([isBlankRow([null, " ", ""]), isBlankRow([null, "x"])]).toEqual([true, false]);
  });

  it("검증 보고서 → 행 상태: 보고서에 없는 행은 정상, 임시 행에 없는 오류는 파일 단위", () => {
    const { byRow, fileErrors } = mapReportToRows([2, 3, 4], [
      { row: 2, errors: [], warnings: ["담당자 미지정"] },
      { row: 3, errors: ["상위 Task(88)가 없습니다."], warnings: [] },
      { row: 1, errors: ["'작업구분' 컬럼을 찾을 수 없습니다."], warnings: [] },
    ]);
    expect(byRow.get(2)).toEqual({ status: "OK", errors: [], warnings: ["담당자 미지정"] });
    expect(byRow.get(3)!.status).toBe("ERROR");
    expect(byRow.get(4)!.status).toBe("OK");
    expect(fileErrors).toEqual(["'작업구분' 컬럼을 찾을 수 없습니다."]);
    const summary = stagingSummary(byRow, fileErrors, { willDeleteCount: 2 });
    expect(summary).toEqual({ total: 3, ok: 2, error: 1, fileErrors, willDeleteCount: 2 });
    expect(canApplyStaging(summary)).toBe(false);
    expect(canApplyStaging({ total: 3, ok: 3, error: 0, fileErrors: [] })).toBe(true);
    expect(canApplyStaging({ total: 0, ok: 0, error: 0, fileErrors: [] })).toBe(false);
  });

  it("화면 수정값 적용: 범위 밖 무시, 빈 값은 빈 칸, 폭 맞춤", () => {
    expect(patchCells(["I", "9.1", null], { 1: " 9.2 ", 2: "", 7: "x", [-1]: "y" } as Record<number, string>, 4)).toEqual(["I", "9.2", null, null]);
  });
});
