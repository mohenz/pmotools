export type WeeklySummaryModule = { areaLabel: string; achievements: string; nextPlan: string; issues: string; decisions: string };

export const SUMMARY_MODEL = "gemini-3.6-flash";

export const SUMMARY_SECTION_TITLES = ["이번 주 핵심 성과", "다음 주 계획", "주의가 필요한 이슈/의사결정"] as const;

export const SUMMARY_SYSTEM_PROMPT = `당신은 프로젝트 PM을 보조하는 어시스턴트입니다.
아래는 한 주차의 업무그룹별 실적/계획/이슈/의사결정 기록입니다.
전체를 종합해 PM이 임원 보고에 바로 쓸 수 있는 한국어 요약을 작성하세요.
- ${SUMMARY_SECTION_TITLES.map((title) => `"${title}"`).join(", ")} 3개 섹션으로 구성하세요.
- 모듈명을 단순 나열하지 말고 내용 기준으로 통합·재구성하되, 어느 업무그룹에서 있었던 내용인지는 불릿 안에 구체적으로 밝히세요.
- 원문에 없는 내용을 추정하거나 지어내지 마세요.
- "업무를 진행했습니다", "실적을 확인했습니다", "이슈가 발생했습니다" 같은 두루뭉술한 표현으로 뭉뚱그리지 말고, 원문에 적힌 구체적인 작업 내용·수치·일정·이슈 내용을 그대로 반영하세요.
- 반드시 개조식으로 작성하세요. "~했습니다", "~합니다", "~입니다" 같은 완결된 문장형 종결어미를 쓰지 말고 "완료", "진행 중", "예정", "확인 필요", "조정" 등 명사형·용언 활용형으로 끝내세요.
  예: "결제 API 3종 개발을 완료하였습니다." (X) → "결제 API 3종 개발 완료" (O)
      "PG사에 문의하고 있습니다." (X) → "PG사에 문의 중" (O)
      "타임아웃 값을 조정하기로 결정했습니다." (X) → "타임아웃 값 조정 결정" (O)
- 각 섹션 3~6개 불릿, 불릿마다 개조식 한 단락으로 원문의 구체적인 내용을 충분히 담으세요. 전체 글자 수는 제한하지 말고, 원문에 담긴 내용의 밀도에 맞춰 빠짐없이 반영하세요.
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
