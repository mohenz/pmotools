export type ManagementTaskAxisKey = "prep" | "owner" | "progress" | "issue" | "close";

export const MANAGEMENT_TASK_AXES: { key: ManagementTaskAxisKey; label: string }[] = [
  { key: "prep", label: "준비사항" },
  { key: "owner", label: "담당자" },
  { key: "progress", label: "수행현황" },
  { key: "issue", label: "이슈관리" },
  { key: "close", label: "작업종료" },
];

export type ManagementTaskPercents = Record<ManagementTaskAxisKey, number>;

function clampPercent(percent: number) {
  return Math.min(100, Math.max(0, percent));
}

export function axisPoints(percent: number) {
  return Math.round(clampPercent(percent) * 0.2);
}

export function totalScore(percents: ManagementTaskPercents) {
  return MANAGEMENT_TASK_AXES.reduce((sum, axis) => sum + axisPoints(percents[axis.key]), 0);
}

export type ManagementTaskBand = "red" | "yellow" | "green";

export function scoreBand(score: number): ManagementTaskBand {
  if (score <= 40) return "red";
  if (score <= 80) return "yellow";
  return "green";
}

export const BAND_LABEL: Record<ManagementTaskBand, string> = { red: "위험", yellow: "주의", green: "양호" };

// 등록된 관리업무항목 총점의 평균으로 프로젝트 전체 신호등 점수를 산출한다. 항목이 없으면 null.
export function averageScore(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export type ManagementTaskEdge = { predecessorId: string; successorId: string };

// 제안된 predecessor → successor 엣지를 추가했을 때 순환이 생기는지, successor에서 predecessor로
// 이미 도달 가능한 경로가 있는지를 BFS로 확인한다.
export function wouldCreateCycle(edges: ManagementTaskEdge[], predecessorId: string, successorId: string) {
  if (predecessorId === successorId) return true;
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.predecessorId) ?? [];
    list.push(edge.successorId);
    adjacency.set(edge.predecessorId, list);
  }
  const visited = new Set<string>();
  const queue = [successorId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === predecessorId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) queue.push(next);
  }
  return false;
}
