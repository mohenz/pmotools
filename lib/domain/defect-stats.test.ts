import { describe, expect, it } from "vitest";
import { buildDefectStats, mapUtSeverity, utStatusClass, type DefectStatRow } from "@/lib/domain/defect-stats";

const row = (o: Partial<DefectStatRow> = {}): DefectStatRow => ({ source: "DEFECT", stage: "통합", statusClass: "OPEN", severity: "Major", isMajor: true, priority: "높음", group: "주문", wbsItemId: "w1", wbsName: "주문 개발", caseId: null, assigneeId: "u1", assigneeName: "김", dueDate: null, ...o });

describe("결함 통계 집계", () => {
  it("결함이 0건이면 모두 0이고 조치완료율은 null", () => {
    const s = buildDefectStats([], "2026-10-24");
    expect(s.totals.total).toBe(0);
    expect(s.totals.resolutionRate).toBeNull();
    expect(s.byStage).toEqual([]);
  });

  it("상태 분류·미조치 중대·미배정·기한 초과를 센다", () => {
    const s = buildDefectStats([
      row(), row({ statusClass: "DONE" }), row({ statusClass: "CLOSED", isMajor: false }),
      row({ assigneeId: null, assigneeName: null, dueDate: "2026-10-01" }), row({ isMajor: false, dueDate: "2026-12-01" }),
    ], "2026-10-24");
    expect(s.totals).toMatchObject({ total: 5, open: 3, done: 1, closed: 1, unresolvedMajor: 2, unassigned: 1, overdue: 1 });
    expect(s.totals.resolutionRate).toBeCloseTo(0.4);
  });

  it("조치 완료된 결함은 기한이 지나도 초과로 세지 않는다", () => {
    expect(buildDefectStats([row({ statusClass: "DONE", dueDate: "2026-01-01" })], "2026-10-24").totals.overdue).toBe(0);
  });

  it("단계·Task·담당자별로 묶고 출처를 구분한다", () => {
    const s = buildDefectStats([row(), row({ source: "UT", stage: "단위테스트", wbsItemId: null, wbsName: null, assigneeId: null, assigneeName: null })], "2026-10-24");
    expect(s.byStage.map((g) => g.label).sort()).toEqual(["단위테스트", "통합"]);
    expect(s.byTask.map((g) => g.label)).toContain("(Task 미연결)");
    expect(s.byAssignee.map((g) => g.label)).toContain("(미배정)");
    expect(s.bySource).toEqual({ defect: 1, ut: 1 });
  });

  it("단계 표는 설정된 테스트 순서로 나온다(단위테스트 결함은 맨 앞)", () => {
    const s = buildDefectStats([row({ stage: "오픈" }), row({ stage: "통합" }), row({ source: "UT", stage: "단위테스트" }), row({ stage: "기타" })], "2026-10-24", null, ["통합", "오픈"]);
    expect(s.byStage.map((g) => g.label)).toEqual(["단위테스트", "통합", "오픈", "기타"]);
  });

  it("심각도별 조치현황은 설정된 심각도 순서로 정렬되고 미조치/완료 등이 집계된다", () => {
    const s = buildDefectStats([
      row({ severity: "Minor", statusClass: "OPEN" }),
      row({ severity: "Critical", statusClass: "DONE" }),
      row({ severity: "Critical", statusClass: "OPEN", isMajor: true }),
      row({ severity: "기타", statusClass: "CLOSED" }),
    ], "2026-10-24", null, [], ["Critical", "Major", "Minor"]);
    expect(s.bySeverityGrouped.map((g) => g.label)).toEqual(["Critical", "Minor", "기타"]);
    const critical = s.bySeverityGrouped.find((g) => g.label === "Critical")!;
    expect(critical.total).toBe(2);
    expect(critical.open).toBe(1);
    expect(critical.done).toBe(1);
    expect(critical.unresolvedMajor).toBe(1);
  });

  it("결함 밀도 = 결함 수 / 수행 케이스 수", () => {
    const s = buildDefectStats([row({ caseId: "c1" }), row({ caseId: "c1" })], "2026-10-24", 4);
    expect(s.caseDensity).toEqual({ defectCases: 1, executedCases: 4, density: 0.5 });
    expect(buildDefectStats([row()], "2026-10-24").caseDensity.density).toBeNull();
  });

  it("단위테스트 결함 상태·심각도 매핑", () => {
    expect(["REGISTERED", "REFIX", "FIXED", "VERIFIED"].map(utStatusClass)).toEqual(["OPEN", "OPEN", "DONE", "CLOSED"]);
    const sev = [{ code: "CRITICAL", label: "치명", isMajorImpact: true }, { code: "MINOR", label: "Minor", isMajorImpact: false }];
    expect(mapUtSeverity("CRITICAL", sev)).toEqual({ label: "치명", isMajor: true });
    expect(mapUtSeverity("MINOR", sev)).toEqual({ label: "Minor", isMajor: false });
    expect(mapUtSeverity("TRIVIAL", sev)).toEqual({ label: "기타", isMajor: false });
  });
});
