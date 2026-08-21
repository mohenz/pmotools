import { describe, expect, it } from "vitest";
import { buildSummaryPrompt, computeSourceHash, hasSummarizableContent, type WeeklySummaryModule } from "@/lib/domain/weekly-report-summary";

const filled: WeeklySummaryModule = { areaLabel: "개발", achievements: "API 구현 완료", nextPlan: "테스트 작성", issues: "일정 지연 우려", decisions: "" };
const empty: WeeklySummaryModule = { areaLabel: "디자인", achievements: "", nextPlan: "", issues: "", decisions: "" };

describe("buildSummaryPrompt", () => {
  it("모듈명과 항목별 내용을 섹션으로 조립한다", () => {
    const prompt = buildSummaryPrompt([filled]);
    expect(prompt).toContain("## 개발");
    expect(prompt).toContain("실적: API 구현 완료");
    expect(prompt).toContain("계획: 테스트 작성");
    expect(prompt).toContain("이슈: 일정 지연 우려");
    expect(prompt).not.toContain("의사결정:");
  });

  it("모든 항목이 비어 있는 모듈은 제외한다", () => {
    expect(buildSummaryPrompt([empty])).toBe("");
    expect(buildSummaryPrompt([filled, empty])).not.toContain("디자인");
  });
});

describe("computeSourceHash", () => {
  it("동일한 내용은 같은 해시를 낸다", () => {
    expect(computeSourceHash([filled])).toBe(computeSourceHash([{ ...filled }]));
  });

  it("내용이 바뀌면 해시도 바뀐다", () => {
    const changed = { ...filled, achievements: "API 구현 및 배포 완료" };
    expect(computeSourceHash([filled])).not.toBe(computeSourceHash([changed]));
  });
});

describe("hasSummarizableContent", () => {
  it("모든 모듈이 비어 있으면 false", () => {
    expect(hasSummarizableContent([empty])).toBe(false);
  });

  it("하나라도 내용이 있으면 true", () => {
    expect(hasSummarizableContent([empty, filled])).toBe(true);
  });
});
