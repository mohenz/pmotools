import "server-only";
import { getPrisma } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { listWbsItems } from "@/lib/server/mp/wbs";
import { UT_NO_WBS, isUtTargetTask, missingCaseFields, reviewChecklist } from "@/lib/domain/ut";
import { dateOnly, isUtManager, type UtActor } from "@/lib/server/mp/ut/common";

// ---------------------------------------------------------------------------
// UT-020 시나리오·케이스 목록(WBS 트리 + 그리드)과 UT-021 케이스 편집 조회 — 설계서 8장.
// ---------------------------------------------------------------------------

export type UtTreeNode = { id: string; parentId: string | null; displayId: string; code: string; name: string; level: number; isLeaf: boolean; scenarioCount: number; caseCount: number };

/** 좌측 WBS 트리 — WBS 기준 단위테스트 대상 Task(개발 단계 Leaf + 대상 체크)와 그 상위만, 보관 제외(경로 순서) + Leaf별 시나리오·케이스 수(상위는 하위 합). */
export async function getUtWbsTree(projectId: string): Promise<UtTreeNode[]> {
  const [allItems, scenarios] = await Promise.all([
    listWbsItems(projectId),
    getPrisma().utScenario.findMany({ where: { projectId, archivedAt: null }, select: { wbsItemId: true, _count: { select: { cases: { where: { isActive: true } } } } } }),
  ]);
  const parentIds = new Set(allItems.filter((i) => i.parentId).map((i) => i.parentId!));
  const byPath = new Map(allItems.map((i) => [i.path, i.id]));
  const keep = new Set<string>();
  for (const i of allItems) {
    if (!isUtTargetTask({ ...i, isLeaf: !parentIds.has(i.id) })) continue;
    // 대상 Task와 그 상위 경로를 모두 남겨 트리 구조를 유지한다.
    const segs = i.path.split(".");
    for (let n = 1; n <= segs.length; n += 1) { const id = byPath.get(segs.slice(0, n).join(".")); if (id) keep.add(id); }
  }
  const items = allItems.filter((i) => keep.has(i.id));
  const own = new Map<string, { s: number; c: number }>();
  for (const s of scenarios) { if (!s.wbsItemId) continue; const v = own.get(s.wbsItemId) ?? { s: 0, c: 0 }; v.s += 1; v.c += s._count.cases; own.set(s.wbsItemId, v); }
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
    const base = { scenarioId: s.id, scenarioDisplayId: s.displayId, scenarioName: s.name, scenarioStatus: s.status, wbsDisplayId: s.wbsItem?.displayId ?? "", wbsName: s.wbsItem?.name ?? "", unit: s.group.label, plName: s.pl?.name ?? null };
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
  const c = params.caseId ? await prisma.utCase.findUnique({ where: { id: params.caseId }, include: {
    executions: { orderBy: { roundNo: "desc" }, include: { executor: { select: { name: true } }, evidences: { select: { id: true, fileName: true, views: { where: { viewerId: viewer.userId }, select: { id: true }, take: 1 } } }, approvals: { include: { approver: { select: { name: true } } }, orderBy: { actedAt: "asc" } } } },
    defects: { orderBy: { createdAt: "asc" }, include: { fixer: { select: { name: true } }, verifier: { select: { name: true } }, assignee: { select: { name: true } }, actions: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } } } },
  } }) : null;
  if (params.caseId && (!c || c.projectId !== projectId)) throw new DomainError("NOT_FOUND", "케이스를 찾을 수 없습니다.");
  const scenarioId = c?.scenarioId ?? params.scenarioId ?? null;
  const scenario = scenarioId ? await prisma.utScenario.findUnique({ where: { id: scenarioId }, include: { wbsItem: { select: { id: true, displayId: true, name: true } }, cases: { where: { isActive: true }, orderBy: { seq: "asc" } }, pl: { select: { name: true } }, writer: { select: { name: true } } } }) : null;
  if (scenarioId && (!scenario || scenario.projectId !== projectId || scenario.archivedAt)) throw new DomainError("NOT_FOUND", "시나리오를 찾을 수 없습니다.");
  // WBS 없이 등록한 시나리오·신규는 UT_NO_WBS로 표시한다.
  const wbsId = scenario ? scenario.wbsItemId ?? UT_NO_WBS : params.wbs ?? null;
  const wbsScenarios = wbsId ? await prisma.utScenario.findMany({ where: { projectId, wbsItemId: wbsId === UT_NO_WBS ? null : wbsId, archivedAt: null }, orderBy: { seq: "asc" }, select: { id: true, displayId: true, name: true, status: true } }) : [];
  const editable = !scenario || ((scenario.status === "DRAFT" || scenario.status === "REJECTED") && (scenario.writerId === viewer.userId || isUtManager(viewer)));
  return {
    wbsItemId: wbsId, wbsScenarios,
    scenario: scenario ? {
      id: scenario.id, displayId: scenario.displayId, name: scenario.name, status: scenario.status, priority: scenario.priority, groupId: scenario.groupId, plUserId: scenario.plUserId, programId: scenario.programId, requirementId: scenario.requirementId,
      version: scenario.version, rejectReason: scenario.rejectReason, wbsDisplayId: scenario.wbsItem?.displayId ?? "", wbsName: scenario.wbsItem?.name ?? "",
      checklist: reviewChecklist(scenario.cases.map((x) => ({ ...x, plannedDate: dateOnly(x.plannedDate) })), { highPriority: scenario.priority === "H" }),
      missing: scenario.cases.map((x) => ({ displayId: x.displayId, fields: missingCaseFields({ ...x, plannedDate: dateOnly(x.plannedDate) }) })).filter((m) => m.fields.length),
      caseCount: scenario.cases.length,
    } : null,
    case: c ? {
      id: c.id, displayId: c.displayId, caseType: c.caseType, name: c.name, precondition: c.precondition, steps: c.steps, inputData: c.inputData, expectedResult: c.expectedResult,
      priority: c.priority, executorId: c.executorId, qcUserId: c.qcUserId, plannedDate: dateOnly(c.plannedDate), status: c.status, version: c.version,
      executions: c.executions.map((e) => ({ id: e.id, roundNo: e.roundNo, verdict: e.verdict, executedOn: dateOnly(e.executedOn), executorName: e.executor.name, actualResult: e.actualResult, naReason: e.naReason, approvalStatus: e.approvalStatus, evidences: e.evidences.map((v) => ({ id: v.id, fileName: v.fileName, viewed: v.views.length > 0 })), approvals: e.approvals.map((a) => ({ step: a.step, decision: a.decision, approverName: a.approver.name, comment: a.comment })) })),
      defects: c.defects.map((d) => ({
        id: d.id, displayId: d.displayId, version: d.version, status: d.status, severity: d.severity, description: d.description, assigneeName: d.assignee?.name ?? null,
        fixedAt: dateOnly(d.fixedAt), fixerName: d.fixer?.name ?? null, verificationResult: d.verificationResult, verifiedAt: dateOnly(d.verifiedAt), verifierName: d.verifier?.name ?? null,
        canFix: (d.status === "REGISTERED" || d.status === "REFIX") && ((d.assigneeId ?? c.executorId) === viewer.userId || isUtManager(viewer)),
        canVerify: d.status === "FIXED" && d.fixedBy !== viewer.userId && ([c.executorId, c.qcUserId].includes(viewer.userId) || isUtManager(viewer)),
        actions: d.actions.map((a) => ({ actionType: a.actionType, actorName: a.actor.name, actedOn: dateOnly(a.actedOn), verificationResult: a.verificationResult, note: a.note })),
      })),
    } : null,
    editable,
    canRequestReview: !!scenario && editable && scenario.cases.length > 0,
    canDecideReview: !!scenario && scenario.status === "REVIEW_REQUESTED" && scenario.plUserId === viewer.userId && scenario.writerId !== viewer.userId,
    canExecute: !!c && !!scenario && scenario.status === "APPROVED" && c.isActive && c.executorId === viewer.userId && (c.status === "APPROVED" || c.status === "IN_EXECUTION"),
    canQc: !!c && c.executions[0]?.approvalStatus === "QC_PENDING" && c.qcUserId === viewer.userId,
    canPl: !!c && !!scenario && c.executions[0]?.approvalStatus === "PL_PENDING" && scenario.plUserId === viewer.userId,
    canRegisterDefect: !!c && !!scenario && c.executions[0]?.verdict === "FAIL" && ([c.executorId, c.qcUserId, scenario.plUserId].includes(viewer.userId) || isUtManager(viewer)),
    plName: scenario?.pl?.name ?? null, writerName: scenario?.writer.name ?? null,
  };
}

/** UT-032 PL 확인함 — WBS별 잔여(PL대기) 건수. */
export async function plPendingByWbs(projectIds: string[], userId: string) {
  const rows = await getPrisma().utExecution.groupBy({ by: ["wbsItemId"], where: { projectId: { in: projectIds }, approvalStatus: "PL_PENDING", case: { scenario: { plUserId: userId } } }, _count: { _all: true } });
  const wbs = await getPrisma().wbsItem.findMany({ where: { id: { in: rows.flatMap((r) => (r.wbsItemId ? [r.wbsItemId] : [])) } }, select: { id: true, displayId: true, name: true } });
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

// ---------------------------------------------------------------------------
// 단위테스트 목록(사용자 양식 24개 열, 2026-10-20) — 케이스 1행 = 최근 수행 + 최근 결함. 처리 대기 필터 포함.
// ---------------------------------------------------------------------------

export type UtSheetRow = {
  caseId: string | null; wbsItemId: string | null; scenarioId: string | null; caseStatus: string | null; scenarioStatus: string | null; todo: string[];
  unit: string; wbsDisplayId: string; wbsName: string; caseDisplayId: string; caseName: string; precondition: string; inputData: string; steps: string; expectedResult: string;
  actualResult: string; verdict: string | null; errorContent: string; ownerName: string | null; executedOn: string | null; executorName: string | null;
  screenId: string; screenName: string; requirementId: string; defectId: string | null; fixedAt: string | null; fixerName: string | null;
  verificationResult: string | null; verifiedAt: string | null; verifierName: string | null; done: "완료" | "진행중" | "미수행" | "미등록";
};

export type UtSheetFilters = { wbs?: string; q?: string; verdict?: string; todo?: string };

/** 단위테스트 목록 — WBS 기준(2026-10-21 사용자 확정): 단위테스트 대상 Task(개발 단계 Leaf + 대상 체크)마다 케이스 행을,
 *  케이스가 없는 대상 Task는 "미등록" 1행을 WBS 경로 순서로 보여 준다. 대상이 아닌 Task의 케이스는 목록에서 제외한다.
 *  WBS 없이 등록한 테스트(2026-10-21)는 맨 뒤에 붙이며, wbs=none이면 그것만 보여 준다. */
export async function listUtCaseSheet(projectId: string, viewer: UtActor, filters: UtSheetFilters = {}) {
  const prisma = getPrisma();
  const allItems = await listWbsItems(projectId);
  const parentIds = new Set(allItems.filter((i) => i.parentId).map((i) => i.parentId!));
  const noWbsOnly = filters.wbs === UT_NO_WBS;
  const node = filters.wbs && !noWbsOnly ? allItems.find((i) => i.id === filters.wbs) : null;
  const targets = noWbsOnly ? [] : allItems.filter((i) => isUtTargetTask({ ...i, isLeaf: !parentIds.has(i.id) })
    && (!filters.wbs || (!!node && (i.path === node.path || i.path.startsWith(`${node.path}.`)))));
  const withNoWbs = !filters.wbs || noWbsOnly;
  const cases = await prisma.utCase.findMany({
    where: { projectId, isActive: true, scenario: { archivedAt: null }, OR: [{ wbsItemId: { in: targets.map((t) => t.id) } }, ...(withNoWbs ? [{ wbsItemId: null }] : [])] },
    include: {
      scenario: { select: { id: true, status: true, plUserId: true, group: { select: { label: true } }, program: { select: { name: true, screenId: true } }, requirement: { select: { displayId: true } }, wbsItem: { select: { displayId: true, path: true, owner: { select: { name: true } } } } } },
      executions: { orderBy: { roundNo: "desc" }, take: 1, include: { executor: { select: { name: true } } } },
      defects: { orderBy: { createdAt: "desc" }, include: { fixer: { select: { name: true } }, verifier: { select: { name: true } } } },
    },
    orderBy: [{ displayId: "asc" }],
    take: 5000,
  });
  const me = viewer.userId;
  const manager = isUtManager(viewer);
  const targetById = new Map(targets.map((t) => [t.id, t]));
  const caseRows: UtSheetRow[] = cases.map((c) => {
    const e = c.executions[0] ?? null;
    const d = c.defects[0] ?? null;
    const openDefects = c.defects.filter((x) => x.status !== "VERIFIED");
    const todo: string[] = [];
    if (c.scenario.status === "REVIEW_REQUESTED" && c.scenario.plUserId === me) todo.push("review");
    if (c.executorId === me && (c.status === "APPROVED" || c.status === "IN_EXECUTION") && c.scenario.status === "APPROVED") todo.push("execute");
    if (e?.approvalStatus === "QC_PENDING" && c.qcUserId === me) todo.push("qc");
    if (e?.approvalStatus === "PL_PENDING" && c.scenario.plUserId === me) todo.push("pl");
    if (openDefects.some((x) => ((x.status === "REGISTERED" || x.status === "REFIX") && ((x.assigneeId ?? c.executorId) === me || manager)) || (x.status === "FIXED" && x.fixedBy !== me && ([c.executorId, c.qcUserId].includes(me) || manager)))) todo.push("defect");
    if ((c.status === "DRAFT") && c.createdBy === me) todo.push("draft");
    return {
      caseId: c.id, wbsItemId: c.wbsItemId, scenarioId: c.scenario.id, caseStatus: c.status, scenarioStatus: c.scenario.status, todo,
      unit: c.scenario.group.label, wbsDisplayId: c.scenario.wbsItem?.displayId ?? "", wbsName: c.wbsItemId ? targetById.get(c.wbsItemId)?.name ?? "" : "", caseDisplayId: c.displayId, caseName: c.name, precondition: c.precondition, inputData: c.inputData, steps: c.steps, expectedResult: c.expectedResult,
      actualResult: e?.actualResult || e?.naReason || "", verdict: e?.verdict ?? null, errorContent: d?.description ?? (e?.verdict === "FAIL" ? e.actualResult : ""),
      ownerName: c.scenario.wbsItem?.owner?.name ?? null, executedOn: dateOnly(e?.executedOn), executorName: e?.executor.name ?? null,
      screenId: c.scenario.program?.screenId ?? "", screenName: c.scenario.program?.name ?? "", requirementId: c.scenario.requirement?.displayId ?? "",
      defectId: d?.displayId ?? null, fixedAt: dateOnly(d?.fixedAt), fixerName: d?.fixer?.name ?? null,
      verificationResult: d?.verificationResult ?? null, verifiedAt: dateOnly(d?.verifiedAt), verifierName: d?.verifier?.name ?? null,
      done: !e ? "미수행" : c.status === "PL_CONFIRMED" && openDefects.length === 0 ? "완료" : "진행중",
    };
  });
  const byWbs = new Map<string, UtSheetRow[]>();
  for (const r of caseRows) if (r.wbsItemId) byWbs.set(r.wbsItemId, [...(byWbs.get(r.wbsItemId) ?? []), r]);
  const rows: UtSheetRow[] = targets.flatMap((t): UtSheetRow[] => byWbs.get(t.id) ?? [{
    caseId: null, wbsItemId: t.id, scenarioId: null, caseStatus: null, scenarioStatus: null, todo: [],
    unit: "", wbsDisplayId: t.displayId, wbsName: t.name, caseDisplayId: "", caseName: "", precondition: "", inputData: "", steps: "", expectedResult: "",
    actualResult: "", verdict: null, errorContent: "", ownerName: t.ownerName, executedOn: null, executorName: null,
    screenId: "", screenName: "", requirementId: "", defectId: null, fixedAt: null, fixerName: null,
    verificationResult: null, verifiedAt: null, verifierName: null, done: "미등록",
  }]).concat(caseRows.filter((r) => !r.wbsItemId));
  const q = filters.q?.trim().toLowerCase();
  return rows.filter((r) =>
    (!filters.verdict || (filters.verdict === "NONE" ? r.verdict === null : r.verdict === filters.verdict)) &&
    (!filters.todo || (filters.todo === "any" ? r.todo.length > 0 : r.todo.includes(filters.todo))) &&
    (!q || [r.caseDisplayId, r.caseName, r.unit, r.wbsDisplayId, r.wbsName, r.requirementId, r.screenId].some((v) => v.toLowerCase().includes(q))));
}
