import "server-only";
import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { assertDevConfirm, utCompletionConditions } from "@/lib/domain/ut";
import { listUtWbsLeaves } from "@/lib/server/mp/ut/cases";
import { listWbsItems } from "@/lib/server/mp/wbs";
import { assertNotLocked, assertUtManager, dateOnly, isUtManager, rule, toDate, versionConflict, type UtActor } from "@/lib/server/mp/ut/common";

// ---------------------------------------------------------------------------
// WBS 이정표(2.1, C8) — 개발완료·UT완료 수기 기록. WBS 진척(실적일·역할 트랙)은 바꾸지 않는다.
// ---------------------------------------------------------------------------

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** 이정표 목록 + UT완료 조건 현황 + WBS 진척 대조(담당자 입력값). 케이스가 있는 대상 Leaf WBS만. */
export async function listUtMilestones(projectId: string, viewer: UtActor) {
  const prisma = getPrisma();
  // WBS 없이 등록한 테스트는 WBS 마일스톤 집계 대상이 아니다.
  const allCases = await prisma.utCase.findMany({
    where: { projectId, wbsItemId: { not: null } },
    select: { wbsItemId: true, plUserId: true, isActive: true, status: true, executorId: true, executions: { orderBy: { roundNo: "desc" }, take: 1, select: { verdict: true, approvalStatus: true, _count: { select: { evidences: true } } } }, defects: { select: { status: true, severity: true } } },
  });
  const byWbs = new Map<string, typeof allCases>();
  for (const c of allCases) byWbs.set(c.wbsItemId!, [...(byWbs.get(c.wbsItemId!) ?? []), c]);
  const [leaves, items, milestones] = await Promise.all([
    listUtWbsLeaves(projectId),
    listWbsItems(projectId),
    prisma.utWbsMilestone.findMany({ where: { projectId }, include: { declarer: { select: { name: true } }, confirmer: { select: { name: true } }, recorder: { select: { name: true } } } }),
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const msById = new Map(milestones.map((m) => [m.wbsItemId, m]));
  const manager = isUtManager(viewer);
  return leaves.filter((w) => byWbs.has(w.id)).map((w) => {
    const cases = byWbs.get(w.id)!;
    const cond = utCompletionConditions(
      cases.map((c) => ({ isActive: c.isActive, status: c.status, latest: c.executions[0] ? { verdict: c.executions[0].verdict, approvalStatus: c.executions[0].approvalStatus, evidenceCount: c.executions[0]._count.evidences } : null })),
      cases.flatMap((c) => c.defects),
    );
    const ms = msById.get(w.id);
    const plIds = new Set(cases.filter((c) => c.isActive).map((c) => c.plUserId).filter((id): id is string => !!id));
    const executors = new Set(cases.map((c) => c.executorId).filter((id): id is string => !!id));
    const item = itemById.get(w.id);
    return {
      wbsItemId: w.id, displayId: w.displayId, code: w.code, name: w.name, stage: w.stage, ownerName: w.ownerName, dueDate: w.dueDate,
      wbsProgress: item?.actualProgress ?? 0, wbsActualDueDate: item?.actualDueDate ?? null,
      devCompletedOn: dateOnly(ms?.devCompletedOn), devDeclaredBy: ms?.declarer?.name ?? null, devConfirmedBy: ms?.confirmer?.name ?? null, devConfirmedAt: ms?.devConfirmedAt?.toISOString() ?? null,
      utCompletedOn: dateOnly(ms?.utCompletedOn), utRecordedBy: ms?.recorder?.name ?? null, version: ms?.version ?? null,
      conditions: cond,
      /** 대조 경고: WBS 진척 100%인데 UT완료 미기록(11장 리스크) */
      mismatch: (item?.actualProgress ?? 0) >= 1 && !ms?.utCompletedOn,
      can: {
        declare: !ms?.devCompletedOn && (w.ownerUserId === viewer.userId || executors.has(viewer.userId) || manager),
        confirm: !!ms?.devCompletedOn && !ms?.devConfirmedBy && ms?.devDeclaredBy !== viewer.userId && (plIds.has(viewer.userId) || manager),
        recordUt: !ms?.utCompletedOn && (plIds.has(viewer.userId) || manager),
        cancel: manager && !!(ms?.devCompletedOn || ms?.utCompletedOn),
      },
    };
  });
}

async function loadWbsContext(actor: UtActor, wbsItemId: string) {
  await assertNotLocked(actor.projectId);
  const prisma = getPrisma();
  const cases = (await prisma.utCase.findMany({ where: { projectId: actor.projectId, wbsItemId }, select: { plUserId: true, status: true, executorId: true, isActive: true } })).filter((c) => c.isActive);
  if (!cases.length) throw new DomainError("NOT_FOUND", "단위테스트 케이스가 있는 WBS만 이정표를 기록할 수 있습니다.");
  const wbs = await prisma.wbsItem.findUnique({ where: { id: wbsItemId }, select: { projectId: true, ownerUserId: true } });
  if (!wbs || wbs.projectId !== actor.projectId) throw new DomainError("NOT_FOUND", "WBS를 찾을 수 없습니다.");
  const ms = await prisma.utWbsMilestone.findUnique({ where: { wbsItemId } });
  return { cases, wbs, ms };
}

/** 개발완료 선언(개발자) — 전제: 등록된 케이스 1건 이상(케이스 사후 작성 방지). */
export async function declareUtDevComplete(actor: UtActor, wbsItemId: string, input: unknown) {
  const { devCompletedOn } = z.object({ devCompletedOn: ymd }).parse(input);
  const { cases, wbs, ms } = await loadWbsContext(actor, wbsItemId);
  const isOwner = wbs.ownerUserId === actor.userId || cases.some((c) => c.executorId === actor.userId);
  if (!isOwner && !isUtManager(actor)) throw new DomainError("FORBIDDEN", "WBS 담당자 또는 케이스 수행 담당자만 개발완료를 선언할 수 있습니다.");
  if (!cases.length) throw new DomainError("INVALID_STATE", "등록된 케이스가 1건 이상 있어야 개발완료를 선언할 수 있습니다.");
  if (ms?.devCompletedOn) throw new DomainError("INVALID_STATE", "이미 개발완료가 선언되었습니다.");
  await getPrisma().utWbsMilestone.upsert({
    where: { wbsItemId },
    create: { wbsItemId, projectId: actor.projectId, devCompletedOn: toDate(devCompletedOn), devDeclaredBy: actor.userId },
    update: { devCompletedOn: toDate(devCompletedOn), devDeclaredBy: actor.userId, devConfirmedBy: null, devConfirmedAt: null, version: { increment: 1 } },
  });
  await writeAuditLog(actor.projectId, actor.userId, "UT_MILESTONE_DEV_DECLARE", "ut_wbs_milestones", wbsItemId, null, { devCompletedOn });
  return { ok: true };
}

/** 개발완료 확인(PL) — 승인 또는 반려(사유 필수, 선언 취소). 선언자 ≠ 확인자. */
export async function confirmUtDevComplete(actor: UtActor, wbsItemId: string, input: unknown) {
  const data = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), reason: z.string().max(1000).default(""), version: z.number().int().positive() }).parse(input);
  const { cases, ms } = await loadWbsContext(actor, wbsItemId);
  const isPl = cases.some((c) => c.plUserId === actor.userId);
  if (!isPl && !isUtManager(actor)) throw new DomainError("FORBIDDEN", "이 WBS 케이스의 PL 또는 PM/PMO만 확인할 수 있습니다.");
  if (!ms?.devCompletedOn || ms.devConfirmedBy) throw new DomainError("INVALID_STATE", "확인 대기 중인 개발완료 선언이 없습니다.");
  await rule(() => assertDevConfirm({ declaredBy: ms.devDeclaredBy, confirmerId: actor.userId }));
  if (data.decision === "REJECTED" && !data.reason.trim()) throw new DomainError("INVALID_STATE", "반려 사유를 입력해 주세요.");
  const update = data.decision === "APPROVED"
    ? { devConfirmedBy: actor.userId, devConfirmedAt: new Date(), version: { increment: 1 } }
    : { devCompletedOn: null, devDeclaredBy: null, note: `개발완료 반려: ${data.reason}`, version: { increment: 1 } };
  const result = await getPrisma().utWbsMilestone.updateMany({ where: { wbsItemId, version: data.version }, data: update });
  if (!result.count) versionConflict();
  await writeAuditLog(actor.projectId, actor.userId, data.decision === "APPROVED" ? "UT_MILESTONE_DEV_CONFIRM" : "UT_MILESTONE_DEV_REJECT", "ut_wbs_milestones", wbsItemId, { devCompletedOn: dateOnly(ms.devCompletedOn) }, { reason: data.reason || undefined });
  return { ok: true };
}

/** UT완료 기록(PL) — 4개 조건 현황은 화면에서 확인. 1단계는 조건 미충족이어도 차단하지 않는다(AU-04 보류). */
export async function recordUtComplete(actor: UtActor, wbsItemId: string, input: unknown) {
  const { utCompletedOn, note } = z.object({ utCompletedOn: ymd, note: z.string().max(1000).default("") }).parse(input);
  const { cases, ms } = await loadWbsContext(actor, wbsItemId);
  const isPl = cases.some((c) => c.plUserId === actor.userId);
  if (!isPl && !isUtManager(actor)) throw new DomainError("FORBIDDEN", "이 WBS 케이스의 PL 또는 PM/PMO만 UT완료를 기록할 수 있습니다.");
  if (ms?.utCompletedOn) throw new DomainError("INVALID_STATE", "이미 UT완료가 기록되었습니다.");
  await getPrisma().utWbsMilestone.upsert({
    where: { wbsItemId },
    create: { wbsItemId, projectId: actor.projectId, utCompletedOn: toDate(utCompletedOn), utRecordedBy: actor.userId, utRecordedAt: new Date(), note },
    update: { utCompletedOn: toDate(utCompletedOn), utRecordedBy: actor.userId, utRecordedAt: new Date(), ...(note ? { note } : {}), version: { increment: 1 } },
  });
  await writeAuditLog(actor.projectId, actor.userId, "UT_MILESTONE_UT_RECORD", "ut_wbs_milestones", wbsItemId, null, { utCompletedOn });
  return { ok: true };
}

/** 이정표 기록 취소(PM/PMO, 사유 필수). */
export async function cancelUtMilestone(actor: UtActor, wbsItemId: string, input: unknown) {
  const { target, reason } = z.object({ target: z.enum(["DEV", "UT"]), reason: z.string().trim().min(1).max(1000) }).parse(input);
  assertUtManager(actor);
  const { ms } = await loadWbsContext(actor, wbsItemId);
  if (!ms) throw new DomainError("NOT_FOUND", "기록된 이정표가 없습니다.");
  const data = target === "DEV" ? { devCompletedOn: null, devDeclaredBy: null, devConfirmedBy: null, devConfirmedAt: null } : { utCompletedOn: null, utRecordedBy: null, utRecordedAt: null };
  await getPrisma().utWbsMilestone.update({ where: { wbsItemId }, data: { ...data, note: `${target === "DEV" ? "개발완료" : "UT완료"} 취소: ${reason}`, version: { increment: 1 } } });
  await writeAuditLog(actor.projectId, actor.userId, `UT_MILESTONE_${target}_CANCEL`, "ut_wbs_milestones", wbsItemId, { devCompletedOn: dateOnly(ms.devCompletedOn), utCompletedOn: dateOnly(ms.utCompletedOn) }, { reason });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 설정(UT-010) — UT 기간·샘플링 비율·마감 잠금(PMO)
// ---------------------------------------------------------------------------

export async function getUtSettings(projectId: string) {
  const s = await getPrisma().utProjectSetting.findUnique({ where: { projectId }, include: { locker: { select: { name: true } } } });
  return { utStartDate: dateOnly(s?.utStartDate), utEndDate: dateOnly(s?.utEndDate), samplingRate: s?.samplingRate ?? 10, lockedAt: s?.lockedAt?.toISOString() ?? null, lockedBy: s?.locker?.name ?? null, lockReason: s?.lockReason ?? "", version: s?.version ?? null };
}

export async function saveUtSettings(actor: UtActor, input: unknown) {
  const data = z.object({ utStartDate: ymd.nullable(), utEndDate: ymd.nullable(), samplingRate: z.number().int().min(0).max(100) }).parse(input);
  assertUtManager(actor);
  if (data.utStartDate && data.utEndDate && data.utStartDate > data.utEndDate) throw new DomainError("INVALID_STATE", "UT 시작일이 종료일보다 늦습니다.");
  const values = { utStartDate: toDate(data.utStartDate), utEndDate: toDate(data.utEndDate), samplingRate: data.samplingRate, updatedBy: actor.userId };
  await getPrisma().utProjectSetting.upsert({ where: { projectId: actor.projectId }, create: { projectId: actor.projectId, ...values }, update: { ...values, version: { increment: 1 } } });
  await writeAuditLog(actor.projectId, actor.userId, "UT_SETTINGS_UPDATE", "ut_project_settings", actor.projectId, null, data);
  return { ok: true };
}

export async function setUtLock(actor: UtActor, input: unknown) {
  const { locked, reason } = z.object({ locked: z.boolean(), reason: z.string().trim().min(1).max(1000) }).parse(input);
  assertUtManager(actor);
  const values = locked ? { lockedAt: new Date(), lockedBy: actor.userId, lockReason: reason } : { lockedAt: null, lockedBy: null, lockReason: `해제: ${reason}` };
  await getPrisma().utProjectSetting.upsert({ where: { projectId: actor.projectId }, create: { projectId: actor.projectId, ...values, updatedBy: actor.userId }, update: { ...values, updatedBy: actor.userId, version: { increment: 1 } } });
  await writeAuditLog(actor.projectId, actor.userId, locked ? "UT_LOCK" : "UT_UNLOCK", "ut_project_settings", actor.projectId, null, { reason });
  return { ok: true };
}
