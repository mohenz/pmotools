import { describe, expect, it } from "vitest";
import { describeApplyFailure, describeFileFailure, displayIdConflictMessage } from "./import-failure";

const row = { row: 12, action: "I", code: "3.2.1", name: "화면 개발", displayId: "WBS-2026-000001" };

describe("엑셀 업로드 실패 상세", () => {
  it("TASK ID 중복(P2002 displayId)은 행·ID·순번 구간 조치를 알려준다", () => {
    const failure = describeApplyFailure("wbs", { code: "P2002", message: "Unique constraint failed", meta: { target: ["displayId"] } }, row, "E1");
    expect(failure.reason).toContain("TASK ID 중복");
    expect(failure.detail).toContain("엑셀 12행 (3.2.1 화면 개발)");
    expect(failure.detail).toContain("WBS-2026-000001");
    expect(failure.hint).toContain("순번 구간");
    expect(failure.rolledBack).toBe(true);
  });

  it("그 밖의 고유값 중복·연결 데이터 없음·대상 없음·시간 초과·길이 초과·기타", () => {
    expect(describeApplyFailure("requirement", { code: "P2002", meta: { target: ["projectId", "requirementId"] } }, null, "E").reason).toContain("요구사항 ID 중복");
    expect(describeApplyFailure("wbs", { code: "P2003" }, row, "E").reason).toContain("연결된 데이터");
    expect(describeApplyFailure("wbs", { code: "P2025" }, row, "E").reason).toContain("찾지 못했습니다");
    expect(describeApplyFailure("wbs", { code: "P2028" }, row, "E").hint).toContain("나눠");
    expect(describeApplyFailure("wbs", { message: "Transaction already closed: timeout" }, null, "E").reason).toContain("시간이 초과");
    expect(describeApplyFailure("wbs", { code: "P2000" }, row, "E").reason).toContain("너무 길어");
    const other = describeApplyFailure("wbs", { name: "TypeError", message: "boom" }, row, "E9");
    expect([other.reason, other.hint, other.technical]).toEqual(["반영 중 예상하지 못한 오류가 발생했습니다.", expect.stringContaining("E9"), "TypeError: boom"]);
  });

  it("파일을 못 읽는 경우: 손상·형식 vs 암호", () => {
    expect(describeFileFailure({ message: "Can't find end of central directory : is this a zip file ?" }, "E").detail).toContain(".xlsx 형식이 아니거나");
    expect(describeFileFailure({ message: "File is encrypted (CFB container)" }, "E").reason).toContain("암호");
  });

  it("사전 차단 문구에 소유 프로젝트를 넣는다", () => {
    expect(displayIdConflictMessage("wbs", "WBS-2026-000001", "PMO-DEMO")).toContain("프로젝트 PMO-DEMO에서");
  });
});
