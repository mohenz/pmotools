import { describe, expect, it } from "vitest";
import {
  DEFECT_CODE_DEFAULTS, DEFECT_GROUP, DEFECT_SEQ_MAX, DEFECT_SEQ_MIN, defectDisplayId, defectNumberSource, isUnresolvedMajorDefect, planDefectSeed, resolutionRate, statusClassOf,
  type DefectStatusClassType,
} from "@/lib/domain/defects";

describe("결함번호 체번 체계(설계서 3.4)", () => {
  it("형식은 DF-yymmdd-순번4자리이고 결함관리 순번은 5001부터다", () => {
    expect(defectDisplayId("2026-10-24", 5001)).toBe("DF-261024-5001");
    expect(defectDisplayId("2027-02-12", DEFECT_SEQ_MAX)).toBe("DF-270212-9999");
  });

  it("범위를 벗어난 순번(단위테스트 구간·예비·초과)은 발급하지 않는다", () => {
    expect(() => defectDisplayId("2026-10-24", 1)).toThrow(/5001~9999/);
    expect(() => defectDisplayId("2026-10-24", 4999)).toThrow();
    expect(() => defectDisplayId("2026-10-24", 5000)).toThrow();
    expect(() => defectDisplayId("2026-10-24", DEFECT_SEQ_MAX + 1)).toThrow();
    expect(() => defectDisplayId("2026-10-24", 5001.5)).toThrow();
  });

  it("날짜 형식이 잘못되면 발급하지 않는다", () => {
    expect(() => defectDisplayId("20261024", DEFECT_SEQ_MIN)).toThrow(/날짜/);
  });

  it("번호만 보고 출처를 판별한다", () => {
    expect(defectNumberSource("DF-261024-0001")).toBe("UNIT_TEST");
    expect(defectNumberSource("DF-261024-4999")).toBe("UNIT_TEST");
    expect(defectNumberSource("DF-261024-5001")).toBe("DEFECT");
    expect(defectNumberSource("DF-261024-9999")).toBe("DEFECT");
    expect(defectNumberSource("DF-261024-5000")).toBeNull();
    expect(defectNumberSource("DF-261024-0000")).toBeNull();
    expect(defectNumberSource("UTC-2026-001")).toBeNull();
  });

  it("단위테스트 번호 형식과 같은 모양이다(전체 테스트 통일)", () => {
    expect(defectDisplayId("2026-10-24", 5001)).toMatch(/^DF-\d{6}-\d{4}$/);
  });
});

describe("기본 코드 값(설계서 3.2)", () => {
  const byGroup = (code: string) => DEFECT_CODE_DEFAULTS.find((g) => g.code === code)!;

  it("그룹 5개, 코드 개수가 설계서와 같다", () => {
    expect(DEFECT_CODE_DEFAULTS).toHaveLength(5);
    expect(byGroup(DEFECT_GROUP.stage).codes.map((c) => c.code)).toEqual(["UNIT", "INTEGRATION", "THIRD_PARTY", "OPEN_TEST"]);
    expect(byGroup(DEFECT_GROUP.status).codes).toHaveLength(6);
    expect(byGroup(DEFECT_GROUP.severity).codes).toHaveLength(4);
    expect(byGroup(DEFECT_GROUP.priority).codes.map((c) => c.code)).toEqual(["P1", "P2", "P3", "P4"]);
    expect(byGroup(DEFECT_GROUP.identification).codes).toHaveLength(4);
  });

  it("그룹 코드와 정렬 번호가 단위테스트 그룹(900~903)과 겹치지 않는다", () => {
    expect(new Set(DEFECT_CODE_DEFAULTS.map((g) => g.code)).size).toBe(5);
    expect(DEFECT_CODE_DEFAULTS.every((g) => g.code.startsWith("defect_") && g.sortOrder >= 910)).toBe(true);
  });

  it("상태 분류: 접수·조치중·재오픈=미조치, 조치완료·반영대기=조치완료, 종결=종결", () => {
    const m = Object.fromEntries(byGroup(DEFECT_GROUP.status).codes.map((c) => [c.code, c.statusClass]));
    expect(m).toEqual({ OPEN: "OPEN", IN_PROGRESS: "OPEN", REOPENED: "OPEN", RESOLVED: "DONE", STAGING: "DONE", CLOSED: "CLOSED" });
  });

  it("중대 결함 기본값은 Critical·Major", () => {
    const m = Object.fromEntries(byGroup(DEFECT_GROUP.severity).codes.map((c) => [c.code, c.isMajorImpact]));
    expect(m).toEqual({ CRITICAL: true, MAJOR: true, MINOR: false, TRIVIAL: false });
  });

  it("시드 계획은 없는 그룹만 만든다(관리자가 바꾼 그룹은 건드리지 않음)", () => {
    expect(planDefectSeed([]).map((g) => g.code)).toHaveLength(5);
    expect(planDefectSeed([DEFECT_GROUP.status, DEFECT_GROUP.stage]).map((g) => g.code)).toEqual([DEFECT_GROUP.severity, DEFECT_GROUP.priority, DEFECT_GROUP.identification]);
    expect(planDefectSeed(DEFECT_CODE_DEFAULTS.map((g) => g.code))).toEqual([]);
  });
});

describe("미조치 중대 결함·조치완료율", () => {
  const classes = new Map<string, DefectStatusClassType>([["open", "OPEN"], ["staging", "DONE"], ["closed", "CLOSED"]]);
  const major = new Set(["critical", "major"]);

  it("미조치이면서 심각도가 중대일 때만 센다", () => {
    expect(isUnresolvedMajorDefect({ statusCodeId: "open", severityCodeId: "critical" }, classes, major)).toBe(true);
    expect(isUnresolvedMajorDefect({ statusCodeId: "open", severityCodeId: "minor" }, classes, major)).toBe(false);
    expect(isUnresolvedMajorDefect({ statusCodeId: "staging", severityCodeId: "critical" }, classes, major)).toBe(false);
    expect(isUnresolvedMajorDefect({ statusCodeId: "closed", severityCodeId: "major" }, classes, major)).toBe(false);
  });

  it("분류가 없는 상태는 미조치로 본다", () => {
    expect(statusClassOf("unknown", classes)).toBe("OPEN");
  });

  it("심각도와 조치 상태는 서로 독립이다", () => {
    // 같은 심각도라도 상태에 따라 결과가 달라지고, 같은 상태라도 심각도에 따라 달라진다
    expect(isUnresolvedMajorDefect({ statusCodeId: "open", severityCodeId: "major" }, classes, major)).toBe(true);
    expect(isUnresolvedMajorDefect({ statusCodeId: "closed", severityCodeId: "major" }, classes, major)).toBe(false);
    expect(isUnresolvedMajorDefect({ statusCodeId: "open", severityCodeId: "trivial" }, classes, major)).toBe(false);
  });

  it("조치완료율은 (조치완료+종결)/전체, 전체 0건이면 null", () => {
    expect(resolutionRate({ OPEN: 2, DONE: 1, CLOSED: 1 })).toBe(0.5);
    expect(resolutionRate({ OPEN: 0, DONE: 0, CLOSED: 0 })).toBeNull();
  });
});
