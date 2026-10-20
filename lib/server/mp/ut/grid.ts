import "server-only";
import { getPrisma } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { listWbsItems } from "@/lib/server/mp/wbs";
import { missingCaseFields, reviewChecklist } from "@/lib/domain/ut";
import { dateOnly, isUtManager, type UtActor } from "@/lib/server/mp/ut/common";

// ---------------------------------------------------------------------------
// UT-020 시나리오·케이스 목록(WBS 트리 + 그리드)과 UT-021 케이스 편집 조회 — 설계서 8장.
// ---------------------------------------------------------------------------

export type UtTreeNode = { id: string; parentId: string | null; displayId: string; code: string; name: string; level: number; isLeaf: boolean; scenarioCount: number; caseCount: number };

/** 좌측 WBS 트리 — 보관 제외 전체 WBS(경로 순서) + Leaf별 시나리오·케이스 수(상위는 하위 합). */
export async function getUtWbsTree(projectId: string): Promise<UtTreeNode[]> {
  const [items, scenarios] = await Promise.all([
    listWbsItems(projectId),
    getPrisma().utScenario.findMany({ where: { projectId, archivedAt: null }, select: { wbsItemId: true, _count: { select: { cases: { where: { isActive: true } } } } } }),
  ]);
  const parentIds = new Set(items.filter((i) => i.parentId).map((i) => i.parentId!));
  const own = new Map<string, { s: number; c: number }>();
  for (const s of scenarios) { const v = own.get(s.wbsItemId) ?? { s: 0, c: 0 }; v.s += 1; v.c += s._count.cases; own.set(s.wbsItemId, v); }
  const nodes = items.map((i) => ({ id: i.id, parentId: i.parentId, displayId: i.displayId, code: i.code, name: i.name, level: i.level, isLeaf: !parentIds.has(i.id), scenarioCount: own.get(i.id)?.s ?? 0, caseCount: own.get(i.id)?.c ?? 0 }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // 하위 합계를 상위로 올린다(깊은 것부터).
  for (const n of [...nodes].sort((a, b) => b.level - a.level)) {
    if (!n.parentId) continue;
    const parent = byId.get(n.parentId);
    if (parent) { parent.scenarioCount += n.scenarioCount; parent.caseCount += n.caseCount; }
  }
  return nodes;
}

/** 선택한 WBS 노드의 하위(자신 포함) id — 경로 접두로 판정. */
async function subtreeIds(projectId: string, wbsItemId: string) {
  const items = await listWbsItems(projectId);
  const node = items.find((i) => i.id === wbsItemId);
  if (!node) return [];
  return items.filter((i) => i.path === node.path || i.path.startsWith(`${node.path}.`)).map((i) => i.id);
}

export type UtGridFilters = { wbs?: string; q?: string; status?: string; caseType?: string; priority?: string };
export type UtGridRow = {
  scenarioId: string; scenarioDisplayId: string; scenarioName: string; scenarioStatus: string; wbsDisplayId: string; wbsName: string; unit: string; plName: string | null;
  caseId: string | null; caseDisplayId: string | null; caseName: string | null; caseType: string | null; priority: string; status: string | null;
  executorName: string | null; qcName: string | null; plannedDate: string | null; lastVerdict: string | null; lastRound: number | null;
};

/** 그리드 — 케이스 1행(시나리오 정보 포함). 케이스가 없는 시나리오도 1행으로 보여 준다. */
export async function listUtCaseGrid(projectId: string, filters: UtGridFilters = {}) {
  const prisma = getPrisma();
  const wbsIds = filters.wbs ? await subtreeIds(projectId, filters.wbs) : null;
  const q = filters.q?.trim();
  const scenarios = await prisma.utScenario.findMany({
    where: {
      projectId, archivedAt: null,
      ...(wbsIds ? { wbsItemId: { in: wbsIds } } : {}),
      ...(filters.priority ? { priority: filters.priority as never } : {}),
    },
    include: {
      wbsItem: { select: { displayId: true, name: true, path: true } }, group: { select: { label: true } }, pl: { select: { name: true } },
      cases: { where: { isActive: true }, orderBy: { seq: "asc" }, include: { executor: { select: { name: true } }, qc: { select: { name: true } }, executions: { orderBy: { roundNo: "desc" }, take: 1, select: { roundNo: true, verdict: true } } } },
    },
    orderBy: [{ wbsItem: { path: "asc" } }, { seq: "asc" }],
    take: 5000,
  });
  const rows = scenarios.flatMap((s): UtGridRow[] => {
    const base = { scenarioId: s.id, scenarioDisplayId: s.displayId, scenarioName: s.name, scenarioStatus: s.status, wbsDisplayId: s.wbsItem.displayId, wbsName: s.wbsItem.name, unit: s.group.label, plName: s.pl?.name ?? null };
    if (!s.cases.length) return [{ ...base, caseId: null, caseDisplayId: null, caseName: null, caseType: null, priority: s.priority, status: null, executorName: null, qcName: null, plannedDate: null, lastVerdict: null, lastRound: null }];
    return s.cases.map((c) => ({ ...base, caseId: c.id, caseDisplayId: c.displayId, caseName: c.name, caseType: c.caseType, priority: c.priority, status: c.status, executorName: c.executor?.name ?? null, qcName: c.qc?.name ?? null, plannedDate: dateOnly(c.plannedDate), lastVerdict: c.executions[0]?.verdict ?? null, lastRound: c.executions[0]?.roundNo ?? null }));
  });
  return rows.filter((r) =>
    (!filters.status || r.status === filters.status) &&
    (!filters.caseType || r.caseType === filters.caseType) &&
    (!q || [r.scenarioDisplayId, r.scenarioName, r.caseDisplayId ?? "", r.caseName ?? ""].some((v) => v.toLowerCase().includes(q.toLowerCase()))));
}

/** UT-021 케이스 편집 — 기존 케이스 또는 신규(WBS·시나리오 선택). 시나리오 체크리스트와 수행 이력 포함. */
export async function getUtCaseEditor(projectId: string, viewer: UtActor, params: { caseId?: string; scenarioId?: string; wbs?: string }) {
  const prisma = getPrisma();
  const c = params.caseId ? await prisma.utCase.findUnique({ where: { id: params.caseId }, include: { executions: { orderBy: { roundNo: "desc" }, include: { executor: { select: { name: true } }, evidences: { select: { id: true, fileName: true } }, approvals: { include: { approver: { select: { name: true } } }, orderBy: { actedAt: "asc" } } } } } }) : null;
  if (params.caseId && (!c || c.projectId !== projectId)) throw new DomainError("NOT_FOUND", "케이스를 찾을 수 없습니다.");
  const scenarioId = c?.scenarioId ?? params.scenarioId ?? null;
  const scenario = scenarioId ? await prisma.utScenario.findUnique({ where: { id: scenarioId }, include: { wbsItem: { select: { id: true, displayId: true, name: true } }, cases: { where: { isActive: true }, orderBy: { seq: "asc" } } } }) : null;
  if (scenarioId && (!scenario || scenario.projectId !== projectId || scenario.archivedAt)) throw new DomainError("NOT_FOUND", "시나리오를 찾을 수 없습니다.");
  const wbsId = scenario?.wbsItemId ?? params.wbs ?? null;
  const wbsScenarios = wbsId ? await prisma.utScenario.findMany({ where: { projectId, wbsItemId: wbsId, archivedAt: null }, orderBy: { seq: "asc" }, select: { id: true, displayId: true, name: true, status: true } }) : [];
  const editable = !scenario || ((scenario.status === "DRAFT" || scenario.status === "REJECTED") && (scenario.writerId === viewer.userId || isUtManager(viewer)));
  return {
    wbsItemId: wbsId, wbsScenarios,
    scenario: scenario ? {
      id: scenario.id, displayId: scenario.displayId, name: scenario.name, status: scenario.status, priority: scenario.priority, groupId: scenario.groupId, plUserId: scenario.plUserId, programId: scenario.programId, requirementId: scenario.requirementId,
      version: scenario.version, rejectReason: scenario.rejectReason, wbsDisplayId: scenario.wbsItem.displayId, wbsName: scenario.wbsItem.name,
      checklist: reviewChecklist(scenario.cases.map((x) => ({ ...x, plannedDate: dateOnly(x.plannedDate) })), { highPriority: scenario.priority === "H" }),
      missing: scenario.cases.map((x) => ({ displayId: x.displayId, fields: missingCaseFields({ ...x, plannedDate: dateOnly(x.plannedDate) }) })).filter((m) => m.fields.length),
      caseCount: scenario.cases.length,
    } : null,
    case: c ? {
      id: c.id, displayId: c.displayId, caseType: c.caseType, name: c.name, precondition: c.precondition, steps: c.steps, inputData: c.inputData, expectedResult: c.expectedResult,
      priority: c.priority, executorId: c.executorId, qcUserId: c.qcUserId, plannedDate: dateOnly(c.plannedDate), status: c.status, version: c.version,
      executions: c.executions.map((e) => ({ id: e.id, roundNo: e.roundNo, verdict: e.verdict, executedOn: dateOnly(e.executedOn), executorName: e.executor.name, actualResult: e.actualResult, naReason: e.naReason, approvalStatus: e.approvalStatus, evidences: e.evidences, approvals: e.approvals.map((a) => ({ step: a.step, decision: a.decision, approverName: a.approver.name, comment: a.comment })) })),
    } : null,
    editable,
    canRequestReview: !!scenario && editable && scenario.cases.length > 0,
  };
}

/** UT-032 PL 확인함 — WBS별 잔여(PL대기) 건수. */
export async function plPendingByWbs(projectIds: string[], userId: string) {
  const rows = await getPrisma().utExecution.groupBy({ by: ["wbsItemId"], where: { projectId: { in: projectIds }, approvalStatus: "PL_PENDING", case: { scenario: { plUserId: userId } } }, _count: { _all: true } });
  const wbs = await getPrisma().wbsItem.findMany({ where: { id: { in: rows.map((r) => r.wbsItemId) } }, select: { id: true, displayId: true, name: true } });
  return rows.map((r) => ({ wbsItemId: r.wbsItemId, displayId: wbs.find((w) => w.id === r.wbsItemId)?.displayId ?? "", name: wbs.find((w) => w.id === r.wbsItemId)?.name ?? "", count: r._count._all }));
}

/** 목록 화면 공통 — 선택 WBS 하위의 WBS displayId 집합(행에 wbsDisplayId가 있는 목록 필터용). */
export async function wbsSubtreeDisplayIds(projectId: string, wbs: string | undefined) {
  if (!wbs) return null;
  const items = await listWbsItems(projectId);
  const node = items.find((i) => i.id === wbs);
  if (!node) return null;
  return new Set(items.filter((i) => i.path === node.path || i.path.startsWith(`${node.path}.`)).map((i) => i.displayId));
}
