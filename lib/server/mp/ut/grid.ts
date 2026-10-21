import "server-only";
import { getPrisma } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { listWbsItems } from "@/lib/server/mp/wbs";
import { UT_NO_WBS, isUtTargetTask, missingCaseFields, reviewChecklist } from "@/lib/domain/ut";
import { dateOnly, isUtManager, type UtActor } from "@/lib/server/mp/ut/common";

// ---------------------------------------------------------------------------
// 단위테스트 목록(WBS 트리 + 24개 열)과 케이스 정보확인/처리 조회 — 설계서 8장. 시나리오 없음(2026-10-21).
// ---------------------------------------------------------------------------

export type UtTreeNode = { id: string; parentId: string | null; displayId: string; code: string; name: string; level: number; isLeaf: boolean; caseCount: number };

/** 좌측 WBS 트리 — WBS 기준 단위테스트 대상 Task(개발 단계 Leaf + 대상 체크)와 그 상위만, 보관 제외(경로 순서) + Leaf별 활성 케이스 수(상위는 하위 합). */
export async function getUtWbsTree(projectId: string): Promise<UtTreeNode[]> {
  const [allItems, counts] = await Promise.all([
    listWbsItems(projectId),
    getPrisma().utCase.groupBy({ by: ["wbsItemId"], where: { projectId, isActive: true, wbsItemId: { not: null } }, _count: { _all: true } }),
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
  const own = new Map(counts.map((r) => [r.wbsItemId!, r._count._all]));
  const nodes = allItems.filter((i) => keep.has(i.id)).map((i) => ({ id: i.id, parentId: i.parentId, displayId: i.displayId, code: i.code, name: i.name, level: i.level, isLeaf: !parentIds.has(i.id), caseCount: own.get(i.id) ?? 0 }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // 하위 합계를 상위로 올린다(깊은 것부터).
  for (const n of [...nodes].sort((a, b) => b.level - a.level)) {
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    if (parent) parent.caseCount += n.caseCount;
  }
  return nodes;
}

/** UT-021 케이스 정보확인/처리 — 기존 케이스 또는 신규(WBS 지정). PL 검토 체크리스트는 같은 WBS Task의 활성 케이스 묶음 기준. */
export async function getUtCaseEditor(projectId: string, viewer: UtActor, params: { caseId?: string; wbs?: string }) {
  const prisma = getPrisma();
  const c = params.caseId ? await prisma.utCase.findUnique({ where: { id: params.caseId }, include: {
    wbsItem: { select: { displayId: true, name: true } }, pl: { select: { name: true } }, creator: { select: { name: true } },
    executions: { orderBy: { roundNo: "desc" }, include: { executor: { select: { name: true } }, evidences: { select: { id: true, fileName: true, views: { where: { viewerId: viewer.userId }, select: { id: true }, take: 1 } } }, approvals: { include: { approver: { select: { name: true } } }, orderBy: { actedAt: "asc" } } } },
    defects: { orderBy: { createdAt: "asc" }, include: { fixer: { select: { name: true } }, verifier: { select: { name: true } }, assignee: { select: { name: true } }, actions: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } } } },
  } }) : null;
  if (params.caseId && (!c || c.projectId !== projectId)) throw new DomainError("NOT_FOUND", "케이스를 찾을 수 없습니다.");
  // WBS 없이 등록한 케이스·신규는 UT_NO_WBS로 표시한다.
  const wbsId = c ? c.wbsItemId ?? UT_NO_WBS : params.wbs ?? null;
  const siblings = wbsId ? await prisma.utCase.findMany({ where: { projectId, isActive: true, wbsItemId: wbsId === UT_NO_WBS ? null : wbsId } }) : [];
  const editable = !c || ((c.status === "DRAFT" || c.status === "REJECTED") && (c.createdBy === viewer.userId || isUtManager(viewer)));
  const latest = c?.executions[0];
  return {
    wbsItemId: wbsId,
    checklist: siblings.length ? reviewChecklist(siblings.map((x) => ({ ...x, plannedDate: dateOnly(x.plannedDate) })), { highPriority: siblings.some((x) => x.priority === "H") }) : [],
    case: c ? {
      id: c.id, displayId: c.displayId, wbsDisplayId: c.wbsItem?.displayId ?? "", wbsName: c.wbsItem?.name ?? "",
      groupId: c.groupId, programId: c.programId, requirementId: c.requirementId, plUserId: c.plUserId, rejectReason: c.rejectReason, isActive: c.isActive,
      caseType: c.caseType, name: c.name, precondition: c.precondition, steps: c.steps, inputData: c.inputData, expectedResult: c.expectedResult,
      priority: c.priority, executorId: c.executorId, qcUserId: c.qcUserId, plannedDate: dateOnly(c.plannedDate), status: c.status, version: c.version,
      missing: missingCaseFields({ ...c, plannedDate: dateOnly(c.plannedDate) }),
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
    canRequestReview: !!c && editable && c.isActive,
    canDecideReview: !!c && c.status === "REVIEW_REQUESTED" && c.plUserId === viewer.userId && c.createdBy !== viewer.userId,
    canExecute: !!c && c.isActive && c.executorId === viewer.userId && (c.status === "APPROVED" || c.status === "IN_EXECUTION"),
    canQc: !!c && latest?.approvalStatus === "QC_PENDING" && c.qcUserId === viewer.userId,
    canPl: !!c && latest?.approvalStatus === "PL_PENDING" && c.plUserId === viewer.userId,
    canRegisterDefect: !!c && latest?.verdict === "FAIL" && ([c.executorId, c.qcUserId, c.plUserId].includes(viewer.userId) || isUtManager(viewer)),
    plName: c?.pl?.name ?? null, writerName: c?.creator.name ?? null,
  };
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
  caseId: string | null; wbsItemId: string | null; caseStatus: string | null; todo: string[];
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
    where: { projectId, isActive: true, OR: [{ wbsItemId: { in: targets.map((t) => t.id) } }, ...(withNoWbs ? [{ wbsItemId: null }] : [])] },
    include: {
      group: { select: { label: true } }, program: { select: { name: true, screenId: true } }, requirement: { select: { displayId: true } },
      wbsItem: { select: { displayId: true, name: true, owner: { select: { name: true } } } },
      executions: { orderBy: { roundNo: "desc" }, take: 1, include: { executor: { select: { name: true } } } },
      defects: { orderBy: { createdAt: "desc" }, include: { fixer: { select: { name: true } }, verifier: { select: { name: true } } } },
    },
    orderBy: [{ displayId: "asc" }],
    take: 5000,
  });
  const me = viewer.userId;
  const manager = isUtManager(viewer);
  const caseRows: UtSheetRow[] = cases.map((c) => {
    const e = c.executions[0] ?? null;
    const d = c.defects[0] ?? null;
    const openDefects = c.defects.filter((x) => x.status !== "VERIFIED");
    const todo: string[] = [];
    if (c.status === "REVIEW_REQUESTED" && c.plUserId === me) todo.push("review");
    if (c.executorId === me && (c.status === "APPROVED" || c.status === "IN_EXECUTION")) todo.push("execute");
    if (e?.approvalStatus === "QC_PENDING" && c.qcUserId === me) todo.push("qc");
    if (e?.approvalStatus === "PL_PENDING" && c.plUserId === me) todo.push("pl");
    if (openDefects.some((x) => ((x.status === "REGISTERED" || x.status === "REFIX") && ((x.assigneeId ?? c.executorId) === me || manager)) || (x.status === "FIXED" && x.fixedBy !== me && ([c.executorId, c.qcUserId].includes(me) || manager)))) todo.push("defect");
    if ((c.status === "DRAFT" || c.status === "REJECTED") && c.createdBy === me) todo.push("draft");
    return {
      caseId: c.id, wbsItemId: c.wbsItemId, caseStatus: c.status, todo,
      unit: c.group.label, wbsDisplayId: c.wbsItem?.displayId ?? "", wbsName: c.wbsItem?.name ?? "", caseDisplayId: c.displayId, caseName: c.name, precondition: c.precondition, inputData: c.inputData, steps: c.steps, expectedResult: c.expectedResult,
      actualResult: e?.actualResult || e?.naReason || "", verdict: e?.verdict ?? null, errorContent: d?.description ?? (e?.verdict === "FAIL" ? e.actualResult : ""),
      ownerName: c.wbsItem?.owner?.name ?? null, executedOn: dateOnly(e?.executedOn), executorName: e?.executor.name ?? null,
      screenId: c.program?.screenId ?? "", screenName: c.program?.name ?? "", requirementId: c.requirement?.displayId ?? "",
      defectId: d?.displayId ?? null, fixedAt: dateOnly(d?.fixedAt), fixerName: d?.fixer?.name ?? null,
      verificationResult: d?.verificationResult ?? null, verifiedAt: dateOnly(d?.verifiedAt), verifierName: d?.verifier?.name ?? null,
      done: !e ? "미수행" : c.status === "PL_CONFIRMED" && openDefects.length === 0 ? "완료" : "진행중",
    };
  });
  const byWbs = new Map<string, UtSheetRow[]>();
  for (const r of caseRows) if (r.wbsItemId) byWbs.set(r.wbsItemId, [...(byWbs.get(r.wbsItemId) ?? []), r]);
  const rows: UtSheetRow[] = targets.flatMap((t): UtSheetRow[] => byWbs.get(t.id) ?? [{
    caseId: null, wbsItemId: t.id, caseStatus: null, todo: [],
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
