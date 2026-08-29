import { describe, expect, it } from "vitest";
import { actualProgress, childPath, codeFromPath, isSameOrDescendantPath, levelOf, nextSegment, pathFromCode, plannedProgress, progressIndex, rebasePath, rollupProgress, sortKeyFromCode, workingDays } from "./wbs";

describe("nextSegment", () => {
  it("starts a fresh sibling group at 0001", () => {
    expect(nextSegment([])).toBe("0001");
  });
  it("increments past the highest existing sibling segment", () => {
    expect(nextSegment(["0001.0001", "0001.0002", "0001.0005"])).toBe("0006");
  });
});

describe("childPath / levelOf / codeFromPath", () => {
  it("appends a segment under a parent path, or stands alone at the root", () => {
    expect(childPath("0001.0002", "0003")).toBe("0001.0002.0003");
    expect(childPath(null, "0001")).toBe("0001");
  });
  it("derives level from the segment count", () => {
    expect(levelOf("0001")).toBe(1);
    expect(levelOf("0001.0002.0003.0004")).toBe(4);
  });
  it("strips the zero padding for a human-readable code", () => {
    expect(codeFromPath("0001.0002.0007")).toBe("1.2.7");
  });
});

describe("pathFromCode", () => {
  it("re-pads a human-readable code back into a storage path", () => {
    expect(pathFromCode("1.2.7")).toBe("0001.0002.0007");
    expect(pathFromCode("1")).toBe("0001");
  });
  it("round-trips with codeFromPath", () => {
    const path = "0001.0012.0003.0100";
    expect(pathFromCode(codeFromPath(path))).toBe(path);
  });
});

describe("isSameOrDescendantPath", () => {
  it("matches the path itself and any nested child path", () => {
    expect(isSameOrDescendantPath("0001.0002", "0001.0002")).toBe(true);
    expect(isSameOrDescendantPath("0001.0002", "0001.0002.0001")).toBe(true);
  });
  it("rejects siblings and unrelated paths", () => {
    expect(isSameOrDescendantPath("0001.0002", "0001.0003")).toBe(false);
    expect(isSameOrDescendantPath("0001.0002", "0001.00020")).toBe(false);
  });
});

// 원본 엑셀 B열(sort) 수식 SUMPRODUCT(EXPAND(TEXTSPLIT(F,"."),1,4,0)*10^{9,6,3,0})과 동일한 값이어야 한다.
describe("sortKeyFromCode", () => {
  it("matches the excel sort column for each level depth", () => {
    expect(sortKeyFromCode("1")).toBe(1_000_000_000);
    expect(sortKeyFromCode("1.1")).toBe(1_001_000_000);
    expect(sortKeyFromCode("1.1.1")).toBe(1_001_001_000);
    expect(sortKeyFromCode("1.1.1.1")).toBe(1_001_001_001);
    expect(sortKeyFromCode("1.1.1.9")).toBe(1_001_001_009);
  });
});

describe("rebasePath", () => {
  it("rewrites a descendant path onto a new prefix", () => {
    expect(rebasePath("0001.0002", "0003.0001", "0001.0002.0005")).toBe("0003.0001.0005");
  });
  it("rewrites the moved node itself when path equals the old prefix", () => {
    expect(rebasePath("0001.0002", "0003.0001", "0001.0002")).toBe("0003.0001");
  });
});

// 2026-07-20(월) ~ 2026-07-24(금) 평일, 25/26일은 주말.
const MON = new Date(Date.UTC(2026, 6, 20));
const WED = new Date(Date.UTC(2026, 6, 22));
const FRI = new Date(Date.UTC(2026, 6, 24));
const NEXT_MON = new Date(Date.UTC(2026, 6, 27));

describe("workingDays", () => {
  it("counts weekdays inclusive of both ends", () => {
    expect(workingDays(MON, FRI)).toBe(5);
  });
  it("skips the weekend when the range spans one", () => {
    expect(workingDays(MON, NEXT_MON)).toBe(6);
  });
  it("excludes dates in the holiday set", () => {
    expect(workingDays(MON, FRI, new Set(["2026-07-22"]))).toBe(4);
  });
});

describe("plannedProgress", () => {
  it("is 0 before the start date and 1 after the due date", () => {
    expect(plannedProgress(new Date(Date.UTC(2026, 6, 19)), MON, FRI)).toBe(0);
    expect(plannedProgress(new Date(Date.UTC(2026, 6, 25)), MON, FRI)).toBe(1);
  });
  it("interpolates linearly within the window", () => {
    expect(plannedProgress(MON, MON, FRI)).toBeCloseTo(0.2);
    expect(plannedProgress(WED, MON, FRI)).toBeCloseTo(0.6);
  });
});

describe("actualProgress", () => {
  it("is 0 when nothing is assigned", () => {
    expect(actualProgress([])).toBe(0);
  });
  it("averages assigned role percentages onto a 0-1 scale", () => {
    expect(actualProgress([100, 50])).toBeCloseTo(0.75);
    expect(actualProgress([0, 0, 0])).toBe(0);
  });
});

describe("progressIndex", () => {
  it("is 0 when nothing was planned yet", () => {
    expect(progressIndex(0.5, 0)).toBe(0);
  });
  it("divides actual by planned otherwise", () => {
    expect(progressIndex(0.6, 0.5)).toBeCloseTo(1.2);
  });
});

describe("rollupProgress", () => {
  it("returns all zeros when there is nothing to roll up", () => {
    expect(rollupProgress([])).toEqual({ planned: 0, actual: 0, progressIndex: 0 });
  });
  it("weight-averages planned/actual and derives progressIndex from the result", () => {
    const result = rollupProgress([
      { weight: 1, planned: 1, actual: 0.5 },
      { weight: 3, planned: 0.5, actual: 0.5 },
    ]);
    expect(result.planned).toBeCloseTo(0.625);
    expect(result.actual).toBeCloseTo(0.5);
    expect(result.progressIndex).toBeCloseTo(0.5 / 0.625);
  });
  it("ignores zero-weight entries in the average without dividing by zero", () => {
    const result = rollupProgress([{ weight: 0, planned: 1, actual: 1 }, { weight: 2, planned: 0.4, actual: 0.2 }]);
    expect(result.planned).toBeCloseTo(0.4);
    expect(result.actual).toBeCloseTo(0.2);
  });
});
