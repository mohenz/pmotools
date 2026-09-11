import { describe, expect, it } from "vitest";
import { buildSummaryPrompt, computeSourceHash, hasSummarizableContent, normalizeSummaryFormatting, parseSummarySections, type WeeklySummaryModule } from "@/lib/domain/weekly-report-summary";

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

describe("parseSummarySections", () => {
  it("3개 섹션 제목과 본문을 분리한다", () => {
    const text = "이번 주 핵심 성과\n• 성과1\n• 성과2\n\n다음 주 계획\n• 계획1\n\n주의가 필요한 이슈/의사결정\n• 이슈1";
    expect(parseSummarySections(text)).toEqual([
      { title: "이번 주 핵심 성과", content: "• 성과1\n• 성과2" },
      { title: "다음 주 계획", content: "• 계획1" },
      { title: "주의가 필요한 이슈/의사결정", content: "• 이슈1" },
    ]);
  });

  it("알려진 섹션 제목이 없으면 전체를 하나의 섹션으로 반환한다", () => {
    expect(parseSummarySections("형식을 벗어난 요약 텍스트")).toEqual([{ title: "요약", content: "형식을 벗어난 요약 텍스트" }]);
  });
});

describe("normalizeSummaryFormatting", () => {
  it("쉼표와 공백으로 이어진 불릿을 줄 단위로 분리한다", () => {
    expect(normalizeSummaryFormatting("이번 주 핵심 성과 • API 완료, • 화면 완료; • 테스트 완료")).toBe(
      "이번 주 핵심 성과\n• API 완료\n• 화면 완료\n• 테스트 완료",
    );
  });

  it("불릿 내용 안의 일반 쉼표는 유지한다", () => {
    expect(normalizeSummaryFormatting("• API, 화면 개발 완료\n• 테스트 완료")).toBe("• API, 화면 개발 완료\n• 테스트 완료");
  });
});
