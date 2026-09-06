import type { ActionItemStatus } from "@/lib/domain/action-items";

export type ManagementTaskAxisKey = "prep" | "owner" | "progress" | "issue" | "close";

export const MANAGEMENT_TASK_AXES: { key: ManagementTaskAxisKey; label: string }[] = [
  { key: "prep", label: "일정관리" },
  { key: "owner", label: "범위관리" },
  { key: "progress", label: "자원관리" },
  { key: "issue", label: "소통관리" },
  { key: "close", label: "품질관리" },
];

export const MANAGEMENT_TASK_STATUSES = [
  { value: "IDENTIFIED", label: "식별" },
  { value: "IN_PROGRESS", label: "진행" },
  { value: "ISSUE_TRANSFERRED", label: "이슈이관" },
  { value: "RISK_TRANSFERRED", label: "리스크이관" },
  { value: "CLOSED", label: "종료" },
] as const;

export type ManagementTaskAxisScores = Record<ManagementTaskAxisKey, number>;

export function totalScore(axisScores: ManagementTaskAxisScores) {
  return MANAGEMENT_TASK_AXES.reduce((sum, axis) => sum + axisScores[axis.key], 0);
}

export type ManagementTaskBand = "red" | "yellow" | "green";

export function scoreBand(score: number): ManagementTaskBand {
  if (score <= 40) return "red";
  if (score <= 80) return "yellow";
  return "green";
}

export const BAND_LABEL: Record<ManagementTaskBand, string> = { red: "위험", yellow: "주의", green: "양호" };

// 집중관리업무 등록·수정 권한: 업무그룹 리더 + PM/PMO + 담당자(등록 시엔 함께 지정하는 담당자, 수정 시엔 기존 담당자) + 관리자 이상.
export function canManageManagementTask(input: { viewerUserId: string; assigneeIds: string[]; groupLeaderId: string | null; isPmPmo: boolean; isManager: boolean }) {
  return input.isManager || input.isPmPmo || input.viewerUserId === input.groupLeaderId || input.assigneeIds.includes(input.viewerUserId);
}

// 세부항목(축) 하나에 속한 액션아이템들의 상태 분포로 그 축의 밴드를 판정한다.
// 이슈가 하나라도 있으면 RED, (이슈 없이) 지연이 하나라도 있으면 YELLOW, 전부 종료면 GREEN, 그 외(식별/진행 혼재, 액션아이템 0건 포함)는 YELLOW/RED.
export function actionItemAxisBand(statuses: ActionItemStatus[]): ManagementTaskBand {
  if (statuses.length === 0) return "red";
  if (statuses.some((status) => status === "ISSUE")) return "red";
  if (statuses.some((status) => status === "DELAYED")) return "yellow";
  if (statuses.every((status) => status === "CLOSED")) return "green";
  return "yellow";
}

export function bandToAxisScore(band: ManagementTaskBand): number {
  if (band === "green") return 20;
  if (band === "yellow") return 10;
  return 0;
}

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
