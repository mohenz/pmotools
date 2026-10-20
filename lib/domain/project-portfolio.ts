// ---------------------------------------------------------------------------
// 프로젝트 포트폴리오(PMO Daily 하위 탭) — 프로젝트별 WBS 지표와 상태 산정, 대표 행·전체 합계 재계산.
// 설계: docs/프로젝트 포트폴리오 관리 설계서.md 4·5장. 기존 통합 현황(/portfolio, 개인 대시보드)과는 별개다.
// ---------------------------------------------------------------------------

export type PortfolioStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED";
export const PORTFOLIO_STATUS_LABEL: Record<PortfolioStatus, string> = { PLANNED: "예정", IN_PROGRESS: "진행", COMPLETED: "완료" };

/** 지표 계산에 쓰는 Leaf WBS 항목 — lib/server/wbs.ts WbsItemRow의 필요한 필드만. */
export type PortfolioLeafInput = {
  weight: number | null;
  workingDays: number | null;
  plannedProgress: number | null;
  actualProgress: number;
  isDelayed: boolean;
  dueDate: string | null;
};

/** 프로젝트 1개 또는 합계의 지표. 공정율 재계산을 위해 가중치 합(분모·분자)을 함께 보관한다. */
export type PortfolioMetrics = {
  totalCount: number;
  completedCount: number;
  incompleteCount: number;
  delayedCount: number;
  delayTrackedCount: number;
  totalWeight: number;
  weightedPlanned: number;
  weightedActual: number;
  /** 예상공정율 — 오늘 기준 계획 진척의 가중 평균(0~1). 가중치 합이 0이면 null. */
  expectedProgress: number | null;
  /** 공정율 — 실적 진척의 가중 평균(0~1). 가중치 합이 0이면 null. */
  progress: number | null;
  /** 지연율 — 지연 Task ÷ 계획종료일이 오늘 이전인 Task(0~1). 대상이 없으면 null. */
  delayRate: number | null;
};

const EMPTY: PortfolioMetrics = { totalCount: 0, completedCount: 0, incompleteCount: 0, delayedCount: 0, delayTrackedCount: 0, totalWeight: 0, weightedPlanned: 0, weightedActual: 0, expectedProgress: null, progress: null, delayRate: null };

function finalize(m: Omit<PortfolioMetrics, "incompleteCount" | "expectedProgress" | "progress" | "delayRate">): PortfolioMetrics {
  return {
    ...m,
    incompleteCount: m.totalCount - m.completedCount,
    expectedProgress: m.totalWeight > 0 ? m.weightedPlanned / m.totalWeight : null,
    progress: m.totalWeight > 0 ? m.weightedActual / m.totalWeight : null,
    delayRate: m.delayTrackedCount > 0 ? m.delayedCount / m.delayTrackedCount : null,
  };
}

/**
 * Leaf 항목으로 프로젝트 지표를 만든다. 가중치·계획·실적 산식은 WBS 통계(lib/server/wbs.ts loadWbsStats의
 * toRollupInputs → rollupProgress)와 같고, 지연 판정·모수는 delayStatsOf와 같다 — 화면마다 수치가 달라지지 않게 한다.
 */
export function metricsOfLeaves(leaves: PortfolioLeafInput[], today: string): PortfolioMetrics {
  if (!leaves.length) return EMPTY;
  let totalWeight = 0, weightedPlanned = 0, weightedActual = 0, completedCount = 0, delayedCount = 0, delayTrackedCount = 0;
  for (const item of leaves) {
    const weight = item.weight || item.workingDays || 0;
    totalWeight += weight;
    weightedPlanned += weight * (item.plannedProgress ?? 0);
    weightedActual += weight * item.actualProgress;
    if (item.actualProgress >= 1) completedCount += 1;
    if (item.isDelayed) delayedCount += 1;
    if (item.dueDate !== null && item.dueDate < today) delayTrackedCount += 1;
  }
  return finalize({ totalCount: leaves.length, completedCount, delayedCount, delayTrackedCount, totalWeight, weightedPlanned, weightedActual });
}

/** 여러 프로젝트의 지표를 합친다 — 건수는 합, 공정율은 가중치 합으로 다시 나눈다(프로젝트 공정율의 단순 평균이 아님). */
export function sumMetrics(list: PortfolioMetrics[]): PortfolioMetrics {
  if (!list.length) return EMPTY;
  const sum = (key: "totalCount" | "completedCount" | "delayedCount" | "delayTrackedCount" | "totalWeight" | "weightedPlanned" | "weightedActual") => list.reduce((acc, m) => acc + m[key], 0);
  return finalize({ totalCount: sum("totalCount"), completedCount: sum("completedCount"), delayedCount: sum("delayedCount"), delayTrackedCount: sum("delayTrackedCount"), totalWeight: sum("totalWeight"), weightedPlanned: sum("weightedPlanned"), weightedActual: sum("weightedActual") });
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
