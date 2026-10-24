import "server-only";
import { getPrisma } from "@/lib/server/db-pg";
import { hasFullDefectView } from "@/lib/domain/defect-access";
import type { DefectStatusClassType } from "@/lib/domain/defects";
import { buildDefectStats, mapUtSeverity, utStatusClass, type DefectStatRow } from "@/lib/domain/defect-stats";
import { ensureDefectCommonCodes, getDefectCodes, koreaToday } from "@/lib/server/mp/defects/common";
import { loadAccessFacts, visibilityWhere, type DefectActorCtx } from "@/lib/server/mp/defects/defects";

// ---------------------------------------------------------------------------
// 결함 통계(DM-05~07, 설계서 7장) — 조회 전용. WBS 진척·실적일·이정표는 바꾸지 않는다.
// 단위테스트 결함(ut_defects)은 읽기 전용으로 합산한다(출처 구분). ut_*에는 쓰지 않는다.
// ---------------------------------------------------------------------------

const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export type DefectStatsFilters = { stageId?: string; from?: string; to?: string; includeUt?: boolean };

export async function loadStatRows(actor: DefectActorCtx, filters: DefectStatsFilters = {}) {
  const prisma = getPrisma();
  await ensureDefectCommonCodes(actor.projectId);
  const [facts, codes, classRows] = await Promise.all([loadAccessFacts(actor), getDefectCodes(actor.projectId), prisma.defectStatusClass.findMany({ where: { projectId: actor.projectId } })]);
  const classOf = new Map(classRows.map((c) => [c.statusCodeId, c.statusClass as DefectStatusClassType]));
  const majorOf = new Map(codes.severities.map((s) => [s.id, s.isMajorImpact]));
  const created: { gte?: Date; lt?: Date } = {};
  if (filters.from) created.gte = new Date(`${filters.from}T00:00:00+09:00`);
  if (filters.to) created.lt = new Date(new Date(`${filters.to}T00:00:00+09:00`).getTime() + 86_400_000);
  const hasRange = !!(created.gte || created.lt);

  const defects = await prisma.defect.findMany({
    where: { projectId: actor.projectId, isActive: true, ...(filters.stageId ? { testStageCodeId: filters.stageId } : {}), ...(hasRange ? { createdAt: created } : {}), AND: [visibilityWhere(actor, facts)] },
    include: { testStage: { select: { label: true } }, severity: { select: { label: true } }, priority: { select: { label: true } }, group: { select: { label: true } }, assignee: { select: { id: true, name: true } } },
  });
  const wbsIds = new Set(defects.map((d) => d.wbsItemId).filter((v): v is string => !!v));

  // 단위테스트 결함(읽기 전용). 단계 필터가 걸리면 단위테스트 결함은 제외한다(단계 코드 없음).
  const full = hasFullDefectView({ userId: actor.userId, role: actor.role, jobTitle: actor.jobTitle });
  const utWhere = full ? {} : { OR: [{ createdBy: actor.userId }, { assigneeId: actor.userId }, ...(facts.qcPlCaseIds.size ? [{ caseId: { in: [...facts.qcPlCaseIds] } }] : [])] };
  const ut = filters.includeUt === false || filters.stageId ? [] : await prisma.utDefect.findMany({
    where: { projectId: actor.projectId, ...utWhere, ...(hasRange ? { createdAt: created } : {}) },
    include: { case: { select: { group: { select: { label: true } }, wbsItemId: true } }, assignee: { select: { id: true, name: true } } },
  });
  for (const u of ut) { const w = u.wbsItemId ?? u.case.wbsItemId; if (w) wbsIds.add(w); }
  const wbs = wbsIds.size ? await prisma.wbsItem.findMany({ where: { id: { in: [...wbsIds] }, projectId: actor.projectId }, select: { id: true, name: true } }) : [];
  const wbsName = new Map(wbs.map((w) => [w.id, w.name]));

  const rows: DefectStatRow[] = [
    ...defects.map((d): DefectStatRow => ({
      source: "DEFECT", stage: d.testStage.label, statusClass: classOf.get(d.statusCodeId) ?? "OPEN", severity: d.severity.label, isMajor: majorOf.get(d.severityCodeId) ?? false,
      priority: d.priority?.label ?? null, group: d.group?.label ?? null, wbsItemId: d.wbsItemId, wbsName: d.wbsItemId ? wbsName.get(d.wbsItemId) ?? null : null,
      caseId: d.caseId, assigneeId: d.assigneeUserId, assigneeName: d.assignee?.name ?? null, dueDate: dateOnly(d.actionDueDate),
    })),
    ...ut.map((u): DefectStatRow => {
      const sev = mapUtSeverity(u.severity, codes.severities);
      const w = u.wbsItemId ?? u.case.wbsItemId;
      return {
        source: "UT", stage: "단위테스트", statusClass: utStatusClass(u.status), severity: sev.label, isMajor: sev.isMajor, priority: null, group: u.case.group.label,
        wbsItemId: w, wbsName: w ? wbsName.get(w) ?? null : null, caseId: u.caseId, assigneeId: u.assigneeId, assigneeName: u.assignee?.name ?? null, dueDate: null,
      };
    }),
  ];
  return rows;
}

export async function getDefectStats(actor: DefectActorCtx, filters: DefectStatsFilters = {}) {
  const rows = await loadStatRows(actor, filters);
  // 수행 케이스 수 — 결함 밀도 분모. 읽기 전용 집계이며 실패해도 통계를 막지 않는다.
  let executed: number | null = null;
  try { executed = (await getPrisma().utExecution.groupBy({ by: ["caseId"], where: { projectId: actor.projectId } })).length; } catch { executed = null; }
  const [stages, severities] = await Promise.all([
    getPrisma().commonCode.findMany({ where: { projectId: actor.projectId, groupCode: "defect_test_stage", isActive: true }, orderBy: { sortOrder: "asc" }, select: { label: true } }),
    getPrisma().commonCode.findMany({ where: { projectId: actor.projectId, groupCode: "defect_severity", isActive: true }, orderBy: { sortOrder: "asc" }, select: { label: true } }),
  ]);
  const stageOrder = stages.map((c) => c.label);
  const severityOrder = severities.map((c) => c.label);
  return buildDefectStats(rows, koreaToday(), executed, stageOrder, severityOrder);
}

/** DM-07 조치 재확인 — 완료 분류 상태인데 결함식별·조치내용이 모두 빈 결함. */
export async function listActionRecheck(actor: DefectActorCtx) {
  const prisma = getPrisma();
  const facts = await loadAccessFacts(actor);
  const doneIds = (await prisma.defectStatusClass.findMany({ where: { projectId: actor.projectId, statusClass: { in: ["DONE", "CLOSED"] } }, select: { statusCodeId: true } })).map((c) => c.statusCodeId);
  if (!doneIds.length) return [];
  const rows = await prisma.defect.findMany({
    where: { projectId: actor.projectId, isActive: true, statusCodeId: { in: doneIds }, identificationCodeId: null, actionComment: "", AND: [visibilityWhere(actor, facts)] },
    include: { status: { select: { label: true } }, assignee: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 500,
  });
  return rows.map((d) => ({ id: d.id, displayId: d.displayId, title: d.title, status: d.status.label, assignee: d.assignee?.name ?? null, updatedAt: d.updatedAt.toISOString() }));
}
