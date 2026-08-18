import { describe, expect, it } from "vitest";
import { averageScore, axisPoints, scoreBand, totalScore, wouldCreateCycle } from "@/lib/domain/management-tasks";

describe("axisPoints", () => {
  it("퍼센트를 20점 만점으로 반올림 환산한다", () => {
    expect(axisPoints(0)).toBe(0);
    expect(axisPoints(50)).toBe(10);
    expect(axisPoints(55)).toBe(11);
    expect(axisPoints(33)).toBe(7);
    expect(axisPoints(100)).toBe(20);
  });
});

describe("totalScore", () => {
  it("5개 축 점수를 합산한다", () => {
    expect(totalScore({ prep: 100, owner: 100, progress: 100, issue: 100, close: 100 })).toBe(100);
    expect(totalScore({ prep: 0, owner: 0, progress: 0, issue: 0, close: 0 })).toBe(0);
    expect(totalScore({ prep: 100, owner: 50, progress: 0, issue: 80, close: 40 })).toBe(20 + 10 + 0 + 16 + 8);
  });
});

describe("scoreBand", () => {
  it("0~40/41~80/81~100 경계에 따라 red/yellow/green을 반환한다", () => {
    expect(scoreBand(0)).toBe("red");
    expect(scoreBand(40)).toBe("red");
    expect(scoreBand(41)).toBe("yellow");
    expect(scoreBand(80)).toBe("yellow");
    expect(scoreBand(81)).toBe("green");
    expect(scoreBand(100)).toBe("green");
  });
});

describe("averageScore", () => {
  it("등록된 항목이 없으면 null을 반환한다", () => {
    expect(averageScore([])).toBeNull();
  });

  it("총점의 평균을 반올림해서 반환한다", () => {
    expect(averageScore([100])).toBe(100);
    expect(averageScore([0, 100])).toBe(50);
    expect(averageScore([40, 40, 41])).toBe(40);
    expect(averageScore([68, 0, 40])).toBe(36);
  });
});

describe("wouldCreateCycle", () => {
  it("빈 그래프에 새 엣지를 추가하는 경우 순환이 아니다", () => {
    expect(wouldCreateCycle([], "A", "B")).toBe(false);
  });

  it("자기 자신을 선후행으로 지정하면 순환이다", () => {
    expect(wouldCreateCycle([], "A", "A")).toBe(true);
  });

  it("A→B가 있을 때 B→A를 추가하면 순환이다", () => {
    expect(wouldCreateCycle([{ predecessorId: "A", successorId: "B" }], "B", "A")).toBe(true);
  });

  it("A→B→C가 있을 때 C→A를 추가하면 순환이다", () => {
    const edges = [
      { predecessorId: "A", successorId: "B" },
      { predecessorId: "B", successorId: "C" },
    ];
    expect(wouldCreateCycle(edges, "C", "A")).toBe(true);
  });

  it("무관한 엣지가 있어도 순환을 만들지 않으면 false다", () => {
    expect(wouldCreateCycle([{ predecessorId: "X", successorId: "Y" }], "P", "Q")).toBe(false);
  });

  it("다이아몬드 그래프에서 D→A는 순환이고 D→E는 순환이 아니다", () => {
    const edges = [
      { predecessorId: "A", successorId: "B" },
      { predecessorId: "A", successorId: "C" },
      { predecessorId: "B", successorId: "D" },
      { predecessorId: "C", successorId: "D" },
    ];
    expect(wouldCreateCycle(edges, "D", "A")).toBe(true);
    expect(wouldCreateCycle(edges, "D", "E")).toBe(false);
  });
});
