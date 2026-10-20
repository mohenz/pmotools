// WBS2 간트 차트(조회 전용, 2026-09-30) — 표시할 행 추리기, 상위 단계 요약, 상태 판정, 기간 계산.
// 화면(클라이언트)과 서버가 함께 쓰므로 순수 함수로만 둔다.
import { rollupProgressByCount } from "@/lib/domain/wbs";

export type GanttState = "completed" | "delayedCompletion" | "delayed" | "inProgress" | "notStarted";

export type GanttSource = {
  id: string; parentId: string | null; code: string; name: string; level: number; stage: string | null; isLeaf: boolean;
  ownerUserId: string | null; ownerName: string | null; ownerLoginId: string | null; groupLabel: string | null;
  startDate: string | null; dueDate: string | null; actualStartDate: string | null; actualDueDate: string | null;
  plannedProgress: number | null; actualProgress: number; weight: number | null; workingDays: number | null;
  isDelayed: boolean; isDelayedCompletion: boolean; delayDays: number | null;
};

export type GanttRow = {
  id: string; parentId: string | null; code: string; name: string; depth: number; hasChildren: boolean; isLeaf: boolean;
  ownerName: string | null; ownerLoginId: string | null; groupLabel: string | null;
  start: string | null; due: string | null; actualStart: string | null; actualDue: string | null;
  planned: number; actual: number; workingDays: number | null; delayDays: number | null;
  state: GanttState; milestone: boolean;
};

export type GanttFilters = { q?: string; assignee?: string; stage?: string; delayed?: boolean; cp?: boolean; cpMinWorkingDays?: number; excludeCompleted?: boolean; ownerUserId?: string };

export function leafState(item: Pick<GanttSource, "actualDueDate" | "actualStartDate" | "actualProgress" | "isDelayed" | "isDelayedCompletion">): GanttState {
  if (item.actualDueDate || item.actualProgress >= 1) return item.isDelayedCompletion ? "delayedCompletion" : "completed";
  if (item.isDelayed) return "delayed";
  if (item.actualStartDate) return "inProgress";
  return "notStarted";
}

function leafMatches(item: GanttSource, f: GanttFilters) {
  const q = f.q?.trim().toLowerCase(), assignee = f.assignee?.trim().toLowerCase(), stage = f.stage?.trim().toLowerCase();
  if (q && !item.code.toLowerCase().includes(q) && !item.name.toLowerCase().includes(q)) return false;
  if (assignee && !(item.ownerName ?? "").toLowerCase().includes(assignee)) return false;
  if (stage && !(item.stage ?? "").toLowerCase().includes(stage)) return false;
  if (f.delayed && !item.isDelayed) return false;
  if (f.cp && !(item.workingDays !== null && item.workingDays >= (f.cpMinWorkingDays ?? 5))) return false;
  if (f.excludeCompleted && (item.actualDueDate || item.actualProgress >= 1)) return false;
  if (f.ownerUserId && item.ownerUserId !== f.ownerUserId) return false;
  return true;
}

const minDate = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
const maxDate = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/**
 * WBS 트리 순서(path 순) 행에서 간트 행을 만든다.
 * - 최하위 Task만 필터를 적용하고, 조건에 맞는 Task의 상위 단계는 함께 남긴다(요약 막대).
 * - 상위 단계 기간 = 자기 일정과 남은 하위 Task 일정의 합집합, 진척 = WBS 통계와 같은 건수 기준(완료 ÷ 전체, 2026-10-20).
 */
export function buildGanttRows(items: GanttSource[], filters: GanttFilters = {}): GanttRow[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const children = new Map<string, GanttSource[]>();
  for (const item of items) if (item.parentId && byId.has(item.parentId)) children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]);
  const filtering = Boolean(filters.q || filters.assignee || filters.stage || filters.delayed || filters.cp || filters.excludeCompleted || filters.ownerUserId);

  const keptLeaves = new Map<string, GanttSource[]>(); // 상위 id → 남은 하위 최하위 Task
  const keep = new Set<string>();
  for (const item of items) {
    if (!item.isLeaf || !leafMatches(item, filters)) continue;
    keep.add(item.id);
    let cursor = item.parentId;
    const seen = new Set<string>();
    while (cursor && byId.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor); keep.add(cursor);
      keptLeaves.set(cursor, [...(keptLeaves.get(cursor) ?? []), item]);
      cursor = byId.get(cursor)!.parentId;
    }
  }
  // 필터가 없으면 하위가 없는 빈 단계도 보여 준다.
  if (!filtering) for (const item of items) keep.add(item.id);

  const depthOf = (item: GanttSource) => { let depth = 0, cursor = item.parentId; const seen = new Set<string>(); while (cursor && byId.has(cursor) && !seen.has(cursor)) { seen.add(cursor); depth += 1; cursor = byId.get(cursor)!.parentId; } return depth; };

  return items.filter((item) => keep.has(item.id)).map((item) => {
    const leaves = item.isLeaf ? [item] : keptLeaves.get(item.id) ?? [];
    const kids = (children.get(item.id) ?? []).filter((child) => keep.has(child.id));
    if (item.isLeaf) {
      return {
        id: item.id, parentId: item.parentId, code: item.code, name: item.name, depth: depthOf(item), hasChildren: false, isLeaf: true,
        ownerName: item.ownerName, ownerLoginId: item.ownerLoginId, groupLabel: item.groupLabel,
        start: item.startDate, due: item.dueDate, actualStart: item.actualStartDate, actualDue: item.actualDueDate,
        planned: item.plannedProgress ?? 0, actual: item.actualProgress, workingDays: item.workingDays, delayDays: item.delayDays,
        state: leafState(item), milestone: Boolean(item.startDate && item.startDate === item.dueDate),
      } satisfies GanttRow;
    }
    const start = leaves.reduce<string | null>((acc, leaf) => minDate(acc, leaf.startDate), item.startDate);
    const due = leaves.reduce<string | null>((acc, leaf) => maxDate(acc, leaf.dueDate), item.dueDate);
    const rollup = rollupProgressByCount(leaves);
    const states = leaves.map(leafState);
    const state: GanttState = !leaves.length ? "notStarted"
      : states.includes("delayed") ? "delayed"
      : states.every((s) => s === "completed" || s === "delayedCompletion") ? (states.includes("delayedCompletion") ? "delayedCompletion" : "completed")
      : states.some((s) => s !== "notStarted") ? "inProgress" : "notStarted";
    return {
      id: item.id, parentId: item.parentId, code: item.code, name: item.name, depth: depthOf(item), hasChildren: kids.length > 0, isLeaf: false,
      ownerName: item.ownerName, ownerLoginId: item.ownerLoginId, groupLabel: item.groupLabel,
      start, due, actualStart: null, actualDue: null,
      planned: rollup.planned, actual: rollup.actual, workingDays: null, delayDays: null, state, milestone: false,
    } satisfies GanttRow;
  });
}

// ---------------------------------------------------------------------------
// 기간 · 눈금
// ---------------------------------------------------------------------------
export type GanttUnit = "day" | "week" | "month" | "quarter";
export const GANTT_DAY_WIDTH: Record<GanttUnit, number> = { day: 28, week: 12, month: 3, quarter: 1.2 };
const DAY = 86_400_000;

export const dayIndex = (from: string, date: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
export const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** 표시 기간 — 모든 계획·실적 일자와 오늘을 포함하고, 앞은 월요일로 맞추며 앞뒤로 여유를 둔다. */
export function ganttRange(rows: Pick<GanttRow, "start" | "due" | "actualStart" | "actualDue">[], today: string) {
  let min = today, max = today;
  for (const row of rows) for (const date of [row.start, row.due, row.actualStart, row.actualDue]) if (date) { if (date < min) min = date; if (date > max) max = date; }
  let start = addDays(min, -7);
  const weekday = new Date(`${start}T00:00:00Z`).getUTCDay(); // 0=일
  start = addDays(start, -((weekday + 6) % 7)); // 월요일
  const end = addDays(max, 14);
  return { start, end, days: dayIndex(start, end) + 1 };
}

export type GanttTick = { label: string; offset: number; days: number };

/** 눈금 — 위 줄(연·월)과 아래 줄(일·주·월·분기). offset/days는 범위 시작일 기준 일 수. */
export function ganttTicks(range: { start: string; days: number }, unit: GanttUnit): { top: GanttTick[]; bottom: GanttTick[] } {
  const top: GanttTick[] = [], bottom: GanttTick[] = [];
  const push = (list: GanttTick[], label: string, offset: number) => { const last = list[list.length - 1]; if (last && last.label === label) last.days += 1; else list.push({ label, offset, days: 1 }); };
  for (let i = 0; i < range.days; i += 1) {
    const date = addDays(range.start, i), d = new Date(`${date}T00:00:00Z`);
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, q = Math.floor((m - 1) / 3) + 1;
    push(top, unit === "day" || unit === "week" ? `${y}.${String(m).padStart(2, "0")}` : `${y}`, i);
    if (unit === "day") bottom.push({ label: String(d.getUTCDate()), offset: i, days: 1 });
    else if (unit === "week") { const monday = addDays(date, -((d.getUTCDay() + 6) % 7)); push(bottom, `${monday.slice(5).replace("-", "/")}`, i); }
    else if (unit === "month") push(bottom, `${m}월`, i);
    else push(bottom, `${y} Q${q}`, i);
  }
  return { top, bottom };
}

// ---------------------------------------------------------------------------
// 최상위 프로젝트 통합 간트(2026-09-30) — 프로젝트마다 WBS 코드가 1부터 시작해 겹치므로 프로젝트를 한 단계 위 요약 행으로 둔다.
// ---------------------------------------------------------------------------
export const GANTT_PROJECT_PREFIX = "project:";
export const isGanttProjectRow = (id: string) => id.startsWith(GANTT_PROJECT_PREFIX);

/** 프로젝트별 WBS 행을 [프로젝트 요약 행 → 그 프로젝트 WBS 트리] 순서로 잇는다. 뿌리 항목의 상위를 프로젝트 행으로 바꾼다. */
export function groupGanttSourcesByProject<T extends GanttSource>(groups: { id: string; code: string; name: string; items: T[] }[]): GanttSource[] {
  return groups.flatMap((group) => {
    const nodeId = `${GANTT_PROJECT_PREFIX}${group.id}`;
    const ids = new Set(group.items.map((item) => item.id));
    const node: GanttSource = {
      id: nodeId, parentId: null, code: group.code, name: group.name, level: 0, stage: null, isLeaf: false,
      ownerUserId: null, ownerName: null, ownerLoginId: null, groupLabel: null,
      startDate: null, dueDate: null, actualStartDate: null, actualDueDate: null,
      plannedProgress: null, actualProgress: 0, weight: null, workingDays: null, isDelayed: false, isDelayedCompletion: false, delayDays: null,
    };
    return [node, ...group.items.map((item) => (item.parentId && ids.has(item.parentId) ? item : { ...item, parentId: nodeId }))];
  });
}
