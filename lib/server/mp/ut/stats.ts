import "server-only";
import { getPrisma } from "@/lib/server/db-pg";
import { listWbsItems } from "@/lib/server/mp/wbs";
import { UT_NO_WBS, isUtTargetTask } from "@/lib/domain/ut";

// ---------------------------------------------------------------------------
// 단위테스트 작성현황·수행결과 통계(초안, 2026-10-23) — 활성 케이스의 최근 차수 기준으로 집계한다.
// 시나리오는 두지 않으므로(2026-10-21) "작성현황"은 테스트 케이스 기준이다.
// ---------------------------------------------------------------------------

export type UtStatFilters = { wbs?: string };

/** 수행 상태 — 최근 차수 판정. 수행 결과가 없으면 NONE(미수행). */
export type UtRunBucket = { total: number; none: number; pass: number; fail: number; blocked: number; na: number };

const emptyBucket = (): UtRunBucket => ({ total: 0, none: 0, pass: 0, fail: 0, blocked: 0, na: 0 });
function addRun(b: UtRunBucket, verdict: string | null) {
  b.total += 1;
  if (!verdict) b.none += 1;
  else if (verdict === "PASS") b.pass += 1;
  else if (verdict === "FAIL") b.fail += 1;
  else if (verdict === "BLOCKED") b.blocked += 1;
  else b.na += 1;
}

export type UtStatRow = { key: string; label: string } & UtRunBucket;

function bump(map: Map<string, UtStatRow>, key: string, label: string, verdict: string | null) {
  const row = map.get(key) ?? { key, label, ...emptyBucket() };
  addRun(row, verdict);
  map.set(key, row);
}
const sortedRows = (map: Map<string, UtStatRow>) => [...map.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "ko"));

export async function getUtStats(projectId: string, filters: UtStatFilters = {}) {
  const prisma = getPrisma();
  const allItems = await listWbsItems(projectId);
  const parentIds = new Set(allItems.filter((i) => i.parentId).map((i) => i.parentId!));
  const noWbsOnly = filters.wbs === UT_NO_WBS;
  const node = filters.wbs && !noWbsOnly ? allItems.find((i) => i.id === filters.wbs) : null;
  const targets = noWbsOnly ? [] : allItems.filter((i) => isUtTargetTask({ ...i, isLeaf: !parentIds.has(i.id) })
    && (!filters.wbs || (!!node && (i.path === node.path || i.path.startsWith(`${node.path}.`)))));
  const withNoWbs = !filters.wbs || noWbsOnly;

  const cases = await prisma.utCase.findMany({
    where: { projectId, isActive: true, OR: [{ wbsItemId: { in: targets.map((t) => t.id) } }, ...(withNoWbs ? [{ wbsItemId: null }] : [])] },
    include: {
      group: { select: { id: true, label: true } }, caseTypeCode: { select: { id: true, label: true } },
      executor: { select: { id: true, name: true } },
      executions: { orderBy: { roundNo: "desc" }, take: 1, select: { roundNo: true, verdict: true, executedOn: true, approvalStatus: true } },
      defects: { select: { status: true, severity: true } },
    },
    take: 20000,
  });

  const byGroup = new Map<string, UtStatRow>();
  const byType = new Map<string, UtStatRow>();
  const byExecutor = new Map<string, UtStatRow>();
  const total = emptyBucket();
  const confirm = { qcPending: 0, plPending: 0, confirmed: 0, rejected: 0, notRequested: 0 };
  const DEFECT_STATUSES = ["REGISTERED", "FIXED", "VERIFIED", "REFIX"] as const;
  const DEFECT_SEVERITIES = ["CRITICAL", "MAJOR", "MINOR", "TRIVIAL"] as const;
  // 결함 상태 × 심각도 건수표
  const defectMatrix = Object.fromEntries(DEFECT_STATUSES.map((st) => [st, Object.fromEntries(DEFECT_SEVERITIES.map((sv) => [sv, 0]))])) as Record<(typeof DEFECT_STATUSES)[number], Record<(typeof DEFECT_SEVERITIES)[number], number>>;
  const casesPerTask = new Set<string>();

  for (const c of cases) {
    const e = c.executions[0] ?? null;
    const verdict = e?.verdict ?? null;
    addRun(total, verdict);
    bump(byGroup, c.group.id, c.group.label, verdict);
    bump(byType, c.caseTypeCode?.id ?? "none", c.caseTypeCode?.label ?? "미지정", verdict);
    bump(byExecutor, c.executor?.id ?? "none", c.executor?.name ?? "미지정", verdict);
    if (c.wbsItemId) casesPerTask.add(c.wbsItemId);
    // QC·PL 확인 진행 — 최근 차수 기준
    if (!e) confirm.notRequested += 1;
    else if (e.approvalStatus === "QC_PENDING") confirm.qcPending += 1;
    else if (e.approvalStatus === "PL_PENDING") confirm.plPending += 1;
    else if (e.approvalStatus === "APPROVED") confirm.confirmed += 1;
    else if (e.approvalStatus === "REJECTED") confirm.rejected += 1;
    else confirm.notRequested += 1; // FAIL·BLOCKED는 확인 대상이 아님
    for (const d of c.defects) defectMatrix[d.status][d.severity] += 1;
  }
  const executed = total.total - total.none;
  return {
    summary: {
      targetTasks: targets.length,
      tasksWithCases: targets.filter((t) => casesPerTask.has(t.id)).length,
      caseTotal: total.total, executed, notExecuted: total.none,
      pass: total.pass, fail: total.fail, blocked: total.blocked, na: total.na,
      confirmed: confirm.confirmed,
      openDefects: DEFECT_SEVERITIES.reduce((n, sv) => n + defectMatrix.REGISTERED[sv] + defectMatrix.FIXED[sv] + defectMatrix.REFIX[sv], 0),
    },
    run: total,
    confirm,
    defects: defectMatrix,
    byGroup: sortedRows(byGroup), byType: sortedRows(byType), byExecutor: sortedRows(byExecutor),
  };
}

export type UtStats = Awaited<ReturnType<typeof getUtStats>>;
