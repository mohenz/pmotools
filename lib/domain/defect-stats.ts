import type { DefectStatusClassType } from "@/lib/domain/defects";
import { resolutionRate } from "@/lib/domain/defects";

// ---------------------------------------------------------------------------
// 결함 통계 집계(설계서 7장) — 순수 함수. 결함관리 결함과 단위테스트 결함(읽기 전용 합산)을 같은 행 형태로 받는다.
// WBS 진척·실적일·이정표는 건드리지 않고 숫자만 만든다.
// ---------------------------------------------------------------------------

export type DefectStatRow = {
  source: "DEFECT" | "UT";
  stage: string; // 테스트 단계 이름(단위테스트 결함은 "단위테스트")
  statusClass: DefectStatusClassType;
  severity: string; // 심각도 이름 (매핑 실패는 "기타")
  isMajor: boolean; // 심각도가 중대 기준 이상
  priority: string | null;
  group: string | null;
  wbsItemId: string | null;
  wbsName: string | null;
  caseId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null; // YYYY-MM-DD
};

export type StatCounts = { total: number; open: number; done: number; closed: number; unresolvedMajor: number; unassigned: number; overdue: number; resolutionRate: number | null };

export const emptyCounts = (): StatCounts => ({ total: 0, open: 0, done: 0, closed: 0, unresolvedMajor: 0, unassigned: 0, overdue: 0, resolutionRate: null });

export function addRow(c: StatCounts, r: DefectStatRow, today: string) {
  c.total += 1;
  if (r.statusClass === "OPEN") c.open += 1; else if (r.statusClass === "DONE") c.done += 1; else c.closed += 1;
  if (r.statusClass === "OPEN" && r.isMajor) c.unresolvedMajor += 1;
  if (!r.assigneeId) c.unassigned += 1;
  if (r.statusClass === "OPEN" && r.dueDate && r.dueDate < today) c.overdue += 1;
  c.resolutionRate = resolutionRate({ OPEN: c.open, DONE: c.done, CLOSED: c.closed });
}

export type GroupedCounts = StatCounts & { key: string; label: string };

function groupBy(rows: DefectStatRow[], today: string, keyOf: (r: DefectStatRow) => [string, string]) {
  const map = new Map<string, GroupedCounts>();
  for (const r of rows) {
    const [key, label] = keyOf(r);
    let g = map.get(key);
    if (!g) { g = { key, label, ...emptyCounts() }; map.set(key, g); }
    addRow(g, r, today);
  }
  return [...map.values()];
}

export type DefectStats = {
  totals: StatCounts;
  bySource: { defect: number; ut: number };
  byStage: GroupedCounts[];
  bySeverityGrouped: GroupedCounts[];
  byTask: GroupedCounts[];
  byGroup: GroupedCounts[];
  byAssignee: GroupedCounts[];
  bySeverity: { label: string; count: number }[];
  byPriority: { label: string; count: number }[];
  caseDensity: { defectCases: number; executedCases: number | null; density: number | null };
};

const UNASSIGNED = "(미배정)";

/** stageOrder: 프로젝트 테스트 단계 이름을 설정된 순서로 준 목록. 단위테스트 결함("단위테스트")은 맨 앞, 목록에 없는 단계는 맨 뒤. */
export function buildDefectStats(rows: DefectStatRow[], today: string, executedCaseCount: number | null = null, stageOrder: string[] = [], severityOrder: string[] = []): DefectStats {
  const rank = (label: string) => (label === "단위테스트" ? -1 : stageOrder.indexOf(label) === -1 ? stageOrder.length : stageOrder.indexOf(label));
  const severityRank = (label: string) => {
    const idx = severityOrder.indexOf(label);
    return idx === -1 ? severityOrder.length : idx;
  };
  const totals = emptyCounts();
  for (const r of rows) addRow(totals, r, today);
  const count = (labelOf: (r: DefectStatRow) => string | null) => {
    const m = new Map<string, number>();
    for (const r of rows) { const l = labelOf(r); if (l) m.set(l, (m.get(l) ?? 0) + 1); }
    return [...m].map(([label, n]) => ({ label, count: n }));
  };
  const caseIds = new Set(rows.map((r) => r.caseId).filter((v): v is string => !!v));
  return {
    totals,
    bySource: { defect: rows.filter((r) => r.source === "DEFECT").length, ut: rows.filter((r) => r.source === "UT").length },
    byStage: groupBy(rows, today, (r) => [r.stage, r.stage]).sort((a, b) => rank(a.label) - rank(b.label)),
    bySeverityGrouped: groupBy(rows, today, (r) => [r.severity, r.severity]).sort((a, b) => severityRank(a.label) - severityRank(b.label) || b.total - a.total),
    byTask: groupBy(rows, today, (r) => (r.wbsItemId ? [r.wbsItemId, r.wbsName ?? r.wbsItemId] : ["-", "(Task 미연결)"])).sort((a, b) => b.total - a.total),
    byGroup: groupBy(rows, today, (r) => (r.group ? [r.group, r.group] : ["-", "(업무단위 없음)"])),
    byAssignee: groupBy(rows, today, (r) => (r.assigneeId ? [r.assigneeId, r.assigneeName ?? r.assigneeId] : ["-", UNASSIGNED])).sort((a, b) => b.open - a.open || b.total - a.total),
    bySeverity: count((r) => r.severity),
    byPriority: count((r) => r.priority),
    caseDensity: { defectCases: caseIds.size, executedCases: executedCaseCount, density: executedCaseCount ? Math.round((rows.length / executedCaseCount) * 100) / 100 : null },
  };
}

/** 단위테스트 결함 상태 → 분류(설계서 7장). */
export function utStatusClass(status: string): DefectStatusClassType {
  if (status === "FIXED") return "DONE";
  if (status === "VERIFIED") return "CLOSED";
  return "OPEN"; // REGISTERED, REFIX
}

const UT_SEVERITY_LABEL: Record<string, string> = { CRITICAL: "Critical", MAJOR: "Major", MINOR: "Minor", TRIVIAL: "Trivial" };
/** 단위테스트 심각도를 프로젝트 심각도 이름과 맞춘다(대소문자 무시). 맞는 이름이 없으면 "기타". */
export function mapUtSeverity(utSeverity: string, projectSeverities: { label: string; code: string; isMajorImpact: boolean }[]) {
  const target = UT_SEVERITY_LABEL[utSeverity] ?? utSeverity;
  const hit = projectSeverities.find((s) => s.code.toLowerCase() === utSeverity.toLowerCase() || s.label.toLowerCase() === target.toLowerCase());
  return hit ? { label: hit.label, isMajor: hit.isMajorImpact } : { label: "기타", isMajor: false };
}
