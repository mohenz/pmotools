export type WeeklySummaryModule = { areaLabel: string; achievements: string; nextPlan: string; issues: string; decisions: string };

export const SUMMARY_MODEL = "gemini-3.6-flash";

export const SUMMARY_SECTION_TITLES = ["이번 주 핵심 성과", "다음 주 계획", "주의가 필요한 이슈/의사결정"] as const;

export const SUMMARY_SYSTEM_PROMPT = `당신은 프로젝트 PM을 보조하는 어시스턴트입니다.
아래는 한 주차의 업무모듈별 실적/계획/이슈/의사결정 기록입니다.
전체를 종합해 PM이 임원 보고에 바로 쓸 수 있는 한국어 요약을 작성하세요.
- ${SUMMARY_SECTION_TITLES.map((title) => `"${title}"`).join(", ")} 3개 섹션으로 구성하세요.
- 모듈명을 단순 나열하지 말고 내용 기준으로 통합·재구성하세요.
- 원문에 없는 내용을 추정하거나 지어내지 마세요.
- 각 섹션 3~5개 불릿, 전체 400자 내외로 작성하세요.
- 마크다운 기호(**, #, - 등)를 쓰지 말고 일반 텍스트로 작성하세요. 섹션 제목 뒤에는 줄바꿈만 넣고, 불릿은 "• "로 시작하세요.`;

export type SummarySection = { title: string; content: string };

export function parseSummarySections(text: string): SummarySection[] {
  const escaped = SUMMARY_SECTION_TITLES.map((title) => title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "g")).map((part) => part.trim()).filter(Boolean);
  const sections: SummarySection[] = [];
  for (let i = 0; i < parts.length; i++) {
    if ((SUMMARY_SECTION_TITLES as readonly string[]).includes(parts[i])) {
      sections.push({ title: parts[i], content: parts[i + 1] ?? "" });
      i++;
    }
  }
  return sections.length ? sections : [{ title: "요약", content: text }];
}

// 리포트 원문이 바뀌었는지만 감지하는 변경 지문이라 암호학적 해시가 필요 없다.
// node:crypto를 쓰면 이 파일을 참조하는 클라이언트 컴포넌트의 웹팩 번들이 깨지므로 순수 JS 해시로 대체한다.
export function computeSourceHash(modules: WeeklySummaryModule[]): string {
  const content = modules.map((m) => `${m.areaLabel}|${m.achievements}|${m.nextPlan}|${m.issues}|${m.decisions}`).join("\n---\n");
  let hash1 = 0xdeadbeef;
  let hash2 = 0x41c6ce57;
  for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i);
    hash1 = Math.imul(hash1 ^ code, 2654435761);
    hash2 = Math.imul(hash2 ^ code, 1597334677);
  }
  hash1 = Math.imul(hash1 ^ (hash1 >>> 16), 2246822507) ^ Math.imul(hash2 ^ (hash2 >>> 13), 3266489909);
  hash2 = Math.imul(hash2 ^ (hash2 >>> 16), 2246822507) ^ Math.imul(hash1 ^ (hash1 >>> 13), 3266489909);
  return (hash1 >>> 0).toString(16).padStart(8, "0") + (hash2 >>> 0).toString(16).padStart(8, "0");
}

export function hasSummarizableContent(modules: WeeklySummaryModule[]): boolean {
  return modules.some((m) => m.achievements.trim() || m.nextPlan.trim() || m.issues.trim() || m.decisions.trim());
}

export function buildSummaryPrompt(modules: WeeklySummaryModule[]): string {
  return modules
    .filter((m) => m.achievements.trim() || m.nextPlan.trim() || m.issues.trim() || m.decisions.trim())
    .map((m) => {
      const lines = [`## ${m.areaLabel}`];
      if (m.achievements.trim()) lines.push(`실적: ${m.achievements.trim()}`);
      if (m.nextPlan.trim()) lines.push(`계획: ${m.nextPlan.trim()}`);
      if (m.issues.trim()) lines.push(`이슈: ${m.issues.trim()}`);
      if (m.decisions.trim()) lines.push(`의사결정: ${m.decisions.trim()}`);
      return lines.join("\n");
    })
    .join("\n\n");
}
