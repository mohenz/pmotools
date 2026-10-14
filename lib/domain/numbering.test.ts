import { describe, expect, it } from "vitest";
import { NUMBERED_SEQUENCES, blockOf, firstNumberOf, nextNumberingBase } from "./numbering";

describe("프로젝트 번호 시작점", () => {
  it("쓰이는 값 최댓값의 다음 10만 블록", () => {
    expect(nextNumberingBase([3418, 100028, 200014, 300035, 400022, 0, null])).toBe(500000);
    expect(nextNumberingBase([400000])).toBe(500000); // 시작점만 잡히고 아직 발급 전인 블록도 사용 중으로 본다
    expect(nextNumberingBase([])).toBe(100000);
    expect(nextNumberingBase([99_999])).toBe(100000);
  });
  it("블록·첫 번호", () => {
    expect([blockOf(3418), blockOf(100028), blockOf(400000), blockOf(-1)]).toEqual([0, 100000, 400000, 0]);
    expect([firstNumberOf(500000), firstNumberOf(0)]).toEqual(["500001", "000001"]);
  });
  it("대상 순번 7종", () => {
    expect(NUMBERED_SEQUENCES.map((s) => s.prefix)).toEqual(["WBS-", "WL-", "REQ-", "REQ-CHG-", "ISU-", "MT-", "DT-"]);
  });
});
