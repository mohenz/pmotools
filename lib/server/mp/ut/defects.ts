import "server-only";
import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { applyDefectFix, applyDefectVerify, defectDisplayId } from "@/lib/domain/ut";
import { assertActiveMember, assertNotLocked, assertUtCode, dateOnly, isUtAdmin, isUtManager, koreaToday, nextSequence, rule, toDate, versionConflict, type UtActor } from "@/lib/server/mp/ut/common";

// ---------------------------------------------------------------------------
// 결함 등록·조치·검증(설계서 5.1, C9) — 수기 등록. 조치·검증은 ut_defect_actions에 이력을 추가로 남긴다.
// ---------------------------------------------------------------------------

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalId = z.string().uuid().nullable().optional().transform((v) => v ?? null);

const defectSchema = z.object({
  description: z.string().trim().min(1).max(4000),
  severity: z.enum(["CRITICAL", "MAJOR", "MINOR", "TRIVIAL"]).default("MAJOR"),
  defectTypeCodeId: optionalId,
  causeGroupId: optionalId,
  vendorGroupId: optionalId,
  assigneeId: optionalId,
});

async function assertDefectRefs(projectId: string, data: z.infer<typeof defectSchema>) {
  const prisma = getPrisma();
  await assertUtCode(projectId, data.defectTypeCodeId, "ut_defect_type", "결함 유형");
  await assertActiveMember(projectId, data.assigneeId, "조치 담당자");
  for (const [id, type, label] of [[data.causeGroupId, "WORK_MODULE", "원인 업무단위"], [data.vendorGroupId, "COMPANY", "협력사"]] as const) {
    if (!id) continue;
    const g = await prisma.groups.findUnique({ where: { id }, select: { projectId: true, groupType: true, isActive: true } });
    if (!g || g.projectId !== projectId || g.groupType !== type || !g.isActive) throw new DomainError("INVALID_CODE", `${label}을(를) 확인해 주세요.`);
  }
  // 협력사 귀속(2장) — 프로젝트에 협력사 그룹이 있으면 필수
  if (!data.vendorGroupId) {
    const hasVendor = await prisma.groups.count({ where: { projectId, groupType: "COMPANY", isActive: true } });
    if (hasVendor) throw new DomainError("INVALID_STATE", "결함의 담당 협력사를 선택해 주세요.");
  }
}

export async function registerUtDefect(actor: UtActor, executionId: string, input: unknown) {
  const data = defectSchema.parse(input);
  await assertNotLocked(actor.projectId);
  const prisma = getPrisma();
  const e = await prisma.utExecution.findUnique({ where: { id: executionId }, include: { case: true } });
  if (!e || e.projectId !== actor.projectId) throw new DomainError("NOT_FOUND", "수행 결과를 찾을 수 없습니다.");
  if (e.verdict !== "FAIL" && !isUtAdmin(actor)) throw new DomainError("INVALID_STATE", "Fail 판정 결과에만 결함을 등록할 수 있습니다.");
  const allowed = [e.executorId, e.case.qcUserId, e.case.plUserId].includes(actor.userId) || isUtManager(actor);
  if (!allowed) throw new DomainError("FORBIDDEN", "수행자·QC·PL 또는 PM/PMO만 결함을 등록할 수 있습니다.");
  await assertDefectRefs(actor.projectId, data);
  const foundAt = dateOnly(e.executedOn) ?? koreaToday();
  const created = await prisma.$transaction(async (tx) => {
    const seq = await nextSequence(tx, `defect:${e.projectId}:${foundAt.replaceAll("-", "")}`);
    return tx.utDefect.create({ data: { ...data, projectId: e.projectId, displayId: defectDisplayId(foundAt, seq), executionId, caseId: e.caseId, wbsItemId: e.wbsItemId, foundAt: toDate(foundAt)!, createdBy: actor.userId } });
  });
  await writeAuditLog(actor.projectId, actor.userId, "UT_DEFECT_INSERT", "ut_defects", created.id, null, { displayId: created.displayId, executionId });
  return { id: created.id, displayId: created.displayId };
}

export async function updateUtDefect(actor: UtActor, defectId: string, input: unknown) {
  const data = defectSchema.extend({ version: z.number().int().positive() }).parse(input);
  await assertNotLocked(actor.projectId);
  const d = await getPrisma().utDefect.findUnique({ where: { id: defectId }, include: { case: true } });
  if (!d || d.projectId !== actor.projectId) throw new DomainError("NOT_FOUND", "결함을 찾을 수 없습니다.");
  if (d.status === "VERIFIED") throw new DomainError("INVALID_STATE", "검증완료된 결함은 수정할 수 없습니다.");
  const allowed = [d.createdBy, d.case.plUserId].includes(actor.userId) || isUtManager(actor);
  if (!allowed) throw new DomainError("FORBIDDEN", "등록자·PL 또는 PM/PMO만 수정할 수 있습니다.");
  await assertDefectRefs(actor.projectId, data);
  const { version, ...rest } = data;
  const result = await getPrisma().utDefect.updateMany({ where: { id: defectId, version }, data: { ...rest, updatedBy: actor.userId, version: { increment: 1 } } });
  if (!result.count) versionConflict();
  await writeAuditLog(actor.projectId, actor.userId, "UT_DEFECT_UPDATE", "ut_defects", defectId, { description: d.description, assigneeId: d.assigneeId, severity: d.severity }, rest);
  return { ok: true };
}

/** 조치 등록 — 조치 담당자(없으면 케이스 수행 담당자) 또는 PM/PMO. 조치자 = 로그인 사용자. */
export async function fixUtDefect(actor: UtActor, defectId: string, input: unknown) {
  const data = z.object({ fixedAt: ymd, note: z.string().max(2000).default(""), version: z.number().int().positive() }).parse(input);
  await assertNotLocked(actor.projectId);
  const prisma = getPrisma();
  const d = await prisma.utDefect.findUnique({ where: { id: defectId }, include: { case: { select: { executorId: true } } } });
  if (!d || d.projectId !== actor.projectId) throw new DomainError("NOT_FOUND", "결함을 찾을 수 없습니다.");
  const owner = d.assigneeId ?? d.case.executorId;
  if (owner !== actor.userId && !isUtManager(actor)) throw new DomainError("FORBIDDEN", "조치 담당자만 조치를 등록할 수 있습니다.");
  const next = await rule(() => applyDefectFix(d.status, isUtAdmin(actor)));
  await prisma.$transaction(async (tx) => {
    const result = await tx.utDefect.updateMany({ where: { id: defectId, version: data.version }, data: { status: next, fixedAt: toDate(data.fixedAt), fixedBy: actor.userId, verificationResult: null, verifiedAt: null, verifiedBy: null, updatedBy: actor.userId, version: { increment: 1 } } });
    if (!result.count) versionConflict();
    await tx.utDefectAction.create({ data: { defectId, actionType: "FIX", actedBy: actor.userId, actedOn: toDate(data.fixedAt)!, note: data.note } });
  });
  await writeAuditLog(actor.projectId, actor.userId, "UT_DEFECT_FIX", "ut_defects", defectId, { status: d.status }, { status: next, fixedAt: data.fixedAt });
  return { ok: true, status: next };
}

/** 검증 등록 — 케이스 테스트 수행자 또는 QC(기본), PM/PMO. 조치자는 검증 불가. 부적합이면 재조치. */
export async function verifyUtDefect(actor: UtActor, defectId: string, input: unknown) {
  const data = z.object({ result: z.enum(["PASS", "FAIL"]), verifiedAt: ymd, note: z.string().max(2000).default(""), version: z.number().int().positive() }).parse(input);
  await assertNotLocked(actor.projectId);
  const prisma = getPrisma();
  const d = await prisma.utDefect.findUnique({ where: { id: defectId }, include: { case: { select: { executorId: true, qcUserId: true } } } });
  if (!d || d.projectId !== actor.projectId) throw new DomainError("NOT_FOUND", "결함을 찾을 수 없습니다.");
  const allowed = [d.case.executorId, d.case.qcUserId].includes(actor.userId) || isUtManager(actor);
  if (!allowed) throw new DomainError("FORBIDDEN", "테스트 수행자·QC 또는 PM/PMO만 검증할 수 있습니다.");
  if (data.result === "FAIL" && !data.note.trim()) throw new DomainError("INVALID_STATE", "부적합 검증은 사유를 입력해 주세요.");
  const next = await rule(() => applyDefectVerify({ status: d.status, result: data.result, fixedBy: d.fixedBy, verifierId: actor.userId, force: isUtAdmin(actor) }));
  await prisma.$transaction(async (tx) => {
    const result = await tx.utDefect.updateMany({ where: { id: defectId, version: data.version }, data: { status: next, verificationResult: data.result, verifiedAt: toDate(data.verifiedAt), verifiedBy: actor.userId, updatedBy: actor.userId, version: { increment: 1 } } });
    if (!result.count) versionConflict();
    await tx.utDefectAction.create({ data: { defectId, actionType: "VERIFY", actedBy: actor.userId, actedOn: toDate(data.verifiedAt)!, verificationResult: data.result, note: data.note } });
  });
  await writeAuditLog(actor.projectId, actor.userId, "UT_DEFECT_VERIFY", "ut_defects", defectId, { status: d.status }, { status: next, result: data.result });
  return { ok: true, status: next };
}

// ---------------------------------------------------------------------------
// 5.1 테스트 수행·결함 관리 양식 — 수행 1건 × 결함 n건(결함이 없으면 1행). 13개 열 + 식별·상태.
// ---------------------------------------------------------------------------

export type UtRunRow = {
  executionId: string; wbsItemId: string | null; defectId: string | null; defectDisplayId: string | null; defectStatus: string | null; severity: string | null; version: number | null;
  verdict: string; roundNo: number; canFix: boolean; canVerify: boolean;
  /** 13개 열 */ unit: string; caseDisplayId: string; caseName: string; steps: string; description: string; executorName: string; executedOn: string | null; screenId: string;
  fixedAt: string | null; fixerName: string | null; verificationResult: string | null; verifiedAt: string | null; verifierName: string | null;
};

export async function listUtRunRows(projectIds: string[], viewer: UtActor, filters: { q?: string; defectOnly?: boolean; openOnly?: boolean; caseId?: string } = {}) {
  const q = filters.q?.trim();
  const executions = await getPrisma().utExecution.findMany({
    where: {
      projectId: { in: projectIds },
      ...(filters.caseId ? { caseId: filters.caseId } : {}),
      ...(filters.defectOnly || filters.openOnly ? { defects: { some: filters.openOnly ? { status: { not: "VERIFIED" } } : {} } } : {}),
      ...(q ? { OR: [{ case: { displayId: { contains: q, mode: "insensitive" } } }, { case: { name: { contains: q, mode: "insensitive" } } }, { defects: { some: { description: { contains: q, mode: "insensitive" } } } }] } : {}),
    },
    include: {
      executor: { select: { name: true } },
      case: { select: { displayId: true, name: true, steps: true, executorId: true, qcUserId: true, group: { select: { label: true } }, screenId: true } },
      defects: { orderBy: { displayId: "asc" }, include: { fixer: { select: { name: true } }, verifier: { select: { name: true } } } },
    },
    orderBy: [{ case: { displayId: "asc" } }, { roundNo: "asc" }],
    take: 2000,
  });
  const manager = isUtManager(viewer);
  const rows: UtRunRow[] = [];
  for (const e of executions) {
    const base = {
      executionId: e.id, wbsItemId: e.wbsItemId, verdict: e.verdict, roundNo: e.roundNo,
      unit: e.case.group.label, caseDisplayId: e.case.displayId, caseName: e.case.name, steps: e.case.steps,
      executorName: e.executor.name, executedOn: dateOnly(e.executedOn), screenId: e.case.screenId,
    };
    const defects = filters.openOnly ? e.defects.filter((d) => d.status !== "VERIFIED") : e.defects;
    if (!defects.length) {
      rows.push({ ...base, defectId: null, defectDisplayId: null, defectStatus: null, severity: null, version: null, canFix: false, canVerify: false, description: "", fixedAt: null, fixerName: null, verificationResult: null, verifiedAt: null, verifierName: null });
      continue;
    }
    for (const d of defects) {
      const owner = d.assigneeId ?? e.case.executorId;
      rows.push({
        ...base, defectId: d.id, defectDisplayId: d.displayId, defectStatus: d.status, severity: d.severity, version: d.version,
        canFix: isUtAdmin(viewer) || ((d.status === "REGISTERED" || d.status === "REFIX") && (owner === viewer.userId || manager)),
        canVerify: isUtAdmin(viewer) || (d.status === "FIXED" && d.fixedBy !== viewer.userId && ([e.case.executorId, e.case.qcUserId].includes(viewer.userId) || manager)),
        description: d.description, fixedAt: dateOnly(d.fixedAt), fixerName: d.fixer?.name ?? null,
        verificationResult: d.verificationResult, verifiedAt: dateOnly(d.verifiedAt), verifierName: d.verifier?.name ?? null,
      });
    }
  }
  return rows;
}

export async function listUtDefectActions(projectIds: string[], defectId: string) {
  const d = await getPrisma().utDefect.findUnique({ where: { id: defectId }, select: { projectId: true, actions: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } } } });
  if (!d || !projectIds.includes(d.projectId)) throw new DomainError("NOT_FOUND", "결함을 찾을 수 없습니다.");
  return d.actions.map((a) => ({ actionType: a.actionType, actorName: a.actor.name, actedOn: dateOnly(a.actedOn), verificationResult: a.verificationResult, note: a.note, createdAt: a.createdAt.toISOString() }));
}
