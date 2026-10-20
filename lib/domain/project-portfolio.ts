// ---------------------------------------------------------------------------
// 프로젝트 포트폴리오(PMO Daily 하위 탭) — 프로젝트별 WBS 지표와 상태 산정, 대표 행·전체 합계 재계산.
// 설계: docs/프로젝트 포트폴리오 관리 설계서.md 4·5장. 기존 통합 현황(/portfolio, 개인 대시보드)과는 별개다.
// 지표는 Leaf WBS **건수 기준**(2026-10-20 사용자 확정) — 공정율은 PMO Daily "전체 공정률"(완료 ÷ 전체)과 같은 방식이며,
// WBS 통계 화면의 "실적 공정율"(작업기간 가중 평균)과는 값이 다르다. 지연율은 WBS 통계·PMO Daily와 같은 기준(현행 유지).
// ---------------------------------------------------------------------------

export type PortfolioStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED";
export const PORTFOLIO_STATUS_LABEL: Record<PortfolioStatus, string> = { PLANNED: "예정", IN_PROGRESS: "진행", COMPLETED: "완료" };

/** 지표 계산에 쓰는 Leaf WBS 항목 — lib/server/wbs.ts WbsItemRow의 필요한 필드만. 날짜는 "YYYY-MM-DD". */
export type PortfolioLeafInput = {
  actualProgress: number;
  isDelayed: boolean;
  dueDate: string | null;
};

export type PortfolioMetrics = {
  totalCount: number;
  /** 완료 — 실적 진척 100%(실적종료일 입력 또는 역할 트랙 평균 100%) */
  completedCount: number;
  incompleteCount: number;
  /** 지연 Task — WBS 지연 판정(isWbsItemDelayed) 해당 건수 */
  delayedCount: number;
  /** 계획종료일 ≤ 오늘 — 예상공정율 분자 */
  plannedDueCount: number;
  /** 계획종료일 < 오늘 — 지연율 분모(WBS 통계 delayStatsOf와 같음) */
  delayTrackedCount: number;
  /** 예상공정율 = 계획종료일 ≤ 오늘 Task ÷ 전체 Task. Task가 없으면 null */
  expectedProgress: number | null;
  /** 공정율 = 완료 Task ÷ 전체 Task. Task가 없으면 null */
  progress: number | null;
  /** 지연율 = 지연 Task ÷ 계획종료일 < 오늘 Task. 분모가 0이면 null */
  delayRate: number | null;
};

type Counts = Pick<PortfolioMetrics, "totalCount" | "completedCount" | "delayedCount" | "plannedDueCount" | "delayTrackedCount">;
const COUNT_KEYS = ["totalCount", "completedCount", "delayedCount", "plannedDueCount", "delayTrackedCount"] as const;
const ZERO: Counts = { totalCount: 0, completedCount: 0, delayedCount: 0, plannedDueCount: 0, delayTrackedCount: 0 };

function finalize(c: Counts): PortfolioMetrics {
  return {
    ...c,
    incompleteCount: c.totalCount - c.completedCount,
    expectedProgress: c.totalCount > 0 ? c.plannedDueCount / c.totalCount : null,
    progress: c.totalCount > 0 ? c.completedCount / c.totalCount : null,
    delayRate: c.delayTrackedCount > 0 ? c.delayedCount / c.delayTrackedCount : null,
  };
}

/** Leaf 항목으로 프로젝트 지표를 만든다. today는 "YYYY-MM-DD". */
export function metricsOfLeaves(leaves: PortfolioLeafInput[], today: string): PortfolioMetrics {
  const c = { ...ZERO, totalCount: leaves.length };
  for (const item of leaves) {
    if (item.actualProgress >= 1) c.completedCount += 1;
    if (item.isDelayed) c.delayedCount += 1;
    if (item.dueDate !== null && item.dueDate <= today) c.plannedDueCount += 1;
    if (item.dueDate !== null && item.dueDate < today) c.delayTrackedCount += 1;
  }
  return finalize(c);
}

/** 여러 프로젝트의 지표를 합친다 — 건수를 합한 뒤 다시 나눈다(프로젝트 비율의 단순 평균이 아님). */
export function sumMetrics(list: PortfolioMetrics[]): PortfolioMetrics {
  const c = { ...ZERO };
  for (const m of list) for (const key of COUNT_KEYS) c[key] += m[key];
  return finalize(c);
}

/** 상태(2026-10-20 확정 D1) — 예정: 공정율 < 1%(Task 없음 포함), 진행: 1% 이상, 완료: 전 Task 완료(공정율 100%). */
export function projectStatusOf(metrics: Pick<PortfolioMetrics, "totalCount" | "completedCount" | "progress">): PortfolioStatus {
  if (metrics.totalCount > 0 && metrics.completedCount === metrics.totalCount) return "COMPLETED";
  if (metrics.progress !== null && metrics.progress >= 0.01) return "IN_PROGRESS";
  return "PLANNED";
}

/** 보조 경고(상태 판정에는 영향 없음) — 종료일이 지났는데 미완료, 시작일이 지났는데 예정. 날짜는 "YYYY-MM-DD". */
export function scheduleWarningOf(status: PortfolioStatus, startDate: string | null, endDate: string | null, today: string): string | null {
  if (status !== "COMPLETED" && endDate !== null && endDate < today) return "종료일 경과";
  if (status === "PLANNED" && startDate !== null && startDate < today) return "착수 지연";
  return null;
}
