import { describe, expect, it } from "vitest";
import { actionItemAxisBand, averageScore, bandToAxisScore, scoreBand, totalScore, wouldCreateCycle } from "@/lib/domain/management-tasks";

describe("totalScore", () => {
  it("5개 축 점수를 합산한다", () => {
    expect(totalScore({ prep: 20, owner: 20, progress: 20, issue: 20, close: 20 })).toBe(100);
    expect(totalScore({ prep: 0, owner: 0, progress: 0, issue: 0, close: 0 })).toBe(0);
    expect(totalScore({ prep: 20, owner: 10, progress: 0, issue: 10, close: 20 })).toBe(60);
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

describe("actionItemAxisBand", () => {
  it("액션아이템이 없으면 red다", () => {
    expect(actionItemAxisBand([])).toBe("red");
  });

  it("이슈가 하나라도 있으면 red다", () => {
    expect(actionItemAxisBand(["CLOSED", "ISSUE", "IN_PROGRESS"])).toBe("red");
  });

  it("이슈가 없고 지연이 하나라도 있으면 yellow다", () => {
    expect(actionItemAxisBand(["CLOSED", "DELAYED"])).toBe("yellow");
  });

  it("전부 종료면 green이다", () => {
    expect(actionItemAxisBand(["CLOSED", "CLOSED"])).toBe("green");
  });

  it("식별/진행이 혼재하면 yellow다", () => {
    expect(actionItemAxisBand(["IDENTIFIED", "IN_PROGRESS"])).toBe("yellow");
  });
});

describe("bandToAxisScore", () => {
  it("red/yellow/green을 0/10/20점으로 환산한다", () => {
    expect(bandToAxisScore("red")).toBe(0);
    expect(bandToAxisScore("yellow")).toBe(10);
    expect(bandToAxisScore("green")).toBe(20);
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
