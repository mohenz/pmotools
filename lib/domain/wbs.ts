// WBS 트리 정렬키 — 레벨당 4자리 고정폭 세그먼트를 "."으로 이어붙인 문자열(예: "0001.0002.0007").
// 고정폭이라 문자열 정렬이 곧 트리 순서이며, 세그먼트 자체가 형제 내 순번이라 별도 sortOrder 컬럼이 필요 없다.

const SEGMENT_WIDTH = 4;

export type WbsItemStatus = "not_started" | "in_progress" | "completed" | "on_hold";
export const WBS_ITEM_STATUSES: { value: WbsItemStatus; label: string }[] = [
  { value: "not_started", label: "대기" },
  { value: "in_progress", label: "진행중" },
  { value: "completed", label: "완료" },
  { value: "on_hold", label: "보류" },
];
export const WBS_ITEM_STATUS_LABEL: Record<WbsItemStatus, string> = Object.fromEntries(WBS_ITEM_STATUSES.map((s) => [s.value, s.label])) as Record<WbsItemStatus, string>;

function pad(value: number) {
  return String(value).padStart(SEGMENT_WIDTH, "0");
}

/** 주어진 부모 아래 형제 세그먼트들(마지막 조각) 중 다음에 붙일 세그먼트를 계산한다. */
export function nextSegment(siblingPaths: string[]): string {
  const last = siblingPaths.reduce((max, path) => {
    const segment = Number(path.split(".").at(-1));
    return Number.isFinite(segment) ? Math.max(max, segment) : max;
  }, 0);
  return pad(last + 1);
}

export function childPath(parentPath: string | null, segment: string): string {
  return parentPath ? `${parentPath}.${segment}` : segment;
}

export function levelOf(path: string): number {
  return path.split(".").length;
}

/** 화면 표시용 코드("1.2.7") — 저장된 path의 4자리 패딩을 제거해 사람이 읽는 번호로 바꾼다. */
export function codeFromPath(path: string): string {
  return path.split(".").map((segment) => String(Number(segment))).join(".");
}

/** codeFromPath의 역함수 — 엑셀 Task 컬럼("1.2.7")을 저장용 path("0001.0002.0007")로 되돌린다. */
export function pathFromCode(code: string): string {
  return code.split(".").map((segment) => pad(Number(segment))).join(".");
}

const SORT_KEY_WEIGHTS = [1_000_000_000, 1_000_000, 1_000, 1];

/** 엑셀 B열(sort) 대응 — code("1.2.7")를 4레벨×3자리 가중치(10^9,10^6,10^3,10^0)로 합산한 정렬키. 저장 path와는 다른 값이다. */
export function sortKeyFromCode(code: string): number {
  return code.split(".").reduce((sum, segment, index) => (index < SORT_KEY_WEIGHTS.length ? sum + Number(segment) * SORT_KEY_WEIGHTS[index] : sum), 0);
}

/** target이 ancestorPath 자신이거나 그 하위 경로인지 — 재배치 시 자기 자신/자손을 새 부모로 고르는 걸 막는 데 쓴다. */
export function isSameOrDescendantPath(ancestorPath: string, target: string): boolean {
  return target === ancestorPath || target.startsWith(`${ancestorPath}.`);
}

/** 서브트리 이동 — oldPrefix로 시작하는 경로를 newPrefix 기준으로 다시 쓴다(자손 경로 일괄 재계산용). */
export function rebasePath(oldPrefix: string, newPrefix: string, path: string): string {
  return newPrefix + path.slice(oldPrefix.length);
}

// ---------------------------------------------------------------------------
// 엑셀 W(Sort/Working Day), AS(목표), AT(실적), AU(진척율) 계산 — 저장하지 않고 조회 시점에 산출한다.
// ---------------------------------------------------------------------------

const isWeekend = (date: Date) => date.getUTCDay() === 0 || date.getUTCDay() === 6;
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const dayCount = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 86_400_000);

/** 엑셀 W열(NETWORKDAYS) 대응 — start~due(포함) 사이 주말·공휴일을 뺀 영업일 수. */
export function workingDays(start: Date, due: Date, holidays: Set<string> = new Set()): number {
  let count = 0;
  for (let offset = 0; offset <= dayCount(start, due); offset += 1) {
    const cursor = new Date(start.getTime() + offset * 86_400_000);
    if (!isWeekend(cursor) && !holidays.has(dateKey(cursor))) count += 1;
  }
  return count;
}

/** 엑셀 AS열(목표, today 기준 계획 진행률) — 시작 전 0, 종료 후 1, 구간 내 선형보간. */
export function plannedProgress(today: Date, start: Date, due: Date): number {
  if (today < start) return 0;
  if (today > due) return 1;
  return (dayCount(start, today) + 1) / (dayCount(start, due) + 1);
}

/** 엑셀 AT열(실적) — 배정된 역할(Track)들의 진도율(0~100) 평균을 0~1로 환산. */
export function actualProgress(assignmentPercents: number[]): number {
  if (assignmentPercents.length === 0) return 0;
  return assignmentPercents.reduce((sum, percent) => sum + percent, 0) / (assignmentPercents.length * 100);
}

/** 엑셀 AU열(진척율) — 실적/목표. 목표가 0(착수 전)이면 0. */
export function progressIndex(actual: number, planned: number): number {
  return planned === 0 ? 0 : actual / planned;
}

// ---------------------------------------------------------------------------
// WBS 목록 화면의 지연율/지연일자 — 계획종료일 대비 실적종료일만 사용한다. 실적종료일이 비어 있어도
// 계획종료일이 지났으면(아래 isWbsItemDelayed 조건 2) 오늘을 임시 실적종료일 삼아 진행 중인 지연을 계산한다.
// ---------------------------------------------------------------------------

/** 계획종료일 대비 실적종료일 지연일수(달력일) — 조기·정시 완료는 0. */
export function wbsDelayDays(plannedDue: Date, actualDue: Date): number {
  return Math.max(0, dayCount(plannedDue, actualDue));
}

/** 지연율(%) = 지연일수 ÷ 계획소요일(영업일) × 100. 계획소요일이 0이면 0. */
export function wbsDelayRate(delayDays: number, plannedWorkingDays: number): number {
  return plannedWorkingDays > 0 ? Math.round((delayDays / plannedWorkingDays) * 100) : 0;
}

// ---------------------------------------------------------------------------
// 지연업무 기준(2026-09-01 사용자 확정, 2026-09-01 예외 보정) — 날짜만 비교하므로 "YYYY-MM-DD" 문자열 그대로 비교한다(시각 오차 방지).
// 1) 계획시작일이 오늘 이전인데 실적시작일이 공백이거나, 2) 계획종료일이 오늘 이전인데 실적종료일이 공백이면 지연.
// 단, 계획종료일이 아직 오늘 이전이 아니면서(=마감 전) 실적시작일·실적종료일이 둘 다 공백이면(=아직 착수 전 대기 상태)
// 조건 1만으로는 지연으로 보지 않는다 — 마감 전까지는 착수가 늦어도 아직 지연이 확정된 게 아니라는 사용자 판단.
// WBS 목록·통계·업무그룹별 통계·지연 Task 조회가 모두 이 판정 하나를 공유한다.
// ---------------------------------------------------------------------------
export type WbsDelayCheckInput = { plannedStart: string | null; actualStart: string | null; plannedDue: string | null; actualDue: string | null };

export function isWbsItemDelayed(today: string, item: WbsDelayCheckInput): boolean {
  const startDelayed = item.plannedStart !== null && item.plannedStart < today && item.actualStart === null;
  const dueDelayed = item.plannedDue !== null && item.plannedDue < today && item.actualDue === null;
  const notYetDue = item.plannedDue !== null && item.plannedDue >= today && item.actualStart === null && item.actualDue === null;
  return (startDelayed || dueDelayed) && !notYetDue;
}

// ---------------------------------------------------------------------------
// 통계 화면 — leaf 항목(상세진도 진도관리대상)의 가중치(weight ?? workingDays) 기준 가중평균 롤업.
// ---------------------------------------------------------------------------

export type WbsRollupInput = { weight: number; planned: number; actual: number };
export type WbsRollup = { planned: number; actual: number; progressIndex: number };

/** 프로젝트/Stage 단위 공정율 롤업 — 가중치 합이 0(대상 없음)이면 전부 0을 반환한다. */
export function rollupProgress(inputs: WbsRollupInput[]): WbsRollup {
  const totalWeight = inputs.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight === 0) return { planned: 0, actual: 0, progressIndex: 0 };
  const planned = inputs.reduce((sum, i) => sum + i.weight * i.planned, 0) / totalWeight;
  const actual = inputs.reduce((sum, i) => sum + i.weight * i.actual, 0) / totalWeight;
  return { planned, actual, progressIndex: progressIndex(actual, planned) };
}
