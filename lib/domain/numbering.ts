// 프로젝트 번호 시작점(2026-09-30 결정) — 시스템 전체에서 유일해야 하는 표시 ID 7종은 순번을 프로젝트별로 세므로,
// 프로젝트마다 10만 단위 구간(블록)을 겹치지 않게 나눠 준다. 새 프로젝트는 생성 시 "지금 쓰이는 가장 큰 값"의 다음 블록을 받는다.
// pmotools와 백오피스에 같은 내용으로 둔다(lib/domain/numbering.ts).
export const NUMBERING_BLOCK = 100_000;

/** 시작점을 미리 넣어 둘 순번 7종 — 표시 ID가 전역 유일(@unique)인데 순번이 프로젝트별인 것. 회의록(MM-)은 프로젝트 안에서만 유일해 제외. */
export const NUMBERED_SEQUENCES = [
  { model: "wbsItemSequence", prefix: "WBS-", label: "WBS Task" },
  { model: "workLogSequence", prefix: "WL-", label: "WBS상세내용" },
  { model: "requirementSequence", prefix: "REQ-", label: "요구사항" },
  { model: "requirementChangeSequence", prefix: "REQ-CHG-", label: "요구사항 변경" },
  { model: "issueSequence", prefix: "ISU-", label: "이슈" },
  { model: "managementTaskSequence", prefix: "MT-", label: "관리업무" },
  { model: "pmoDelayedTaskSequence", prefix: "DT-", label: "PMO 지연Task" },
] as const;

/** 값이 속한 블록의 시작(0, 100000, 200000 …). */
export function blockOf(value: number) {
  return Math.floor(Math.max(0, value) / NUMBERING_BLOCK) * NUMBERING_BLOCK;
}

/** 새 프로젝트 시작점 — 쓰이는 값(기존 시작점·순번 값) 중 최댓값의 다음 블록. 아무것도 없으면 첫 블록 다음(100000). */
export function nextNumberingBase(usedValues: (number | null | undefined)[]) {
  const max = usedValues.reduce<number>((acc, value) => (typeof value === "number" && value > acc ? value : acc), 0);
  return blockOf(max) + NUMBERING_BLOCK;
}

/** 화면 표시용 — 시작점 다음 번호(첫 발급 번호). 예: 500000 → "500001" */
export function firstNumberOf(base: number) {
  return String(base + 1).padStart(6, "0");
}
