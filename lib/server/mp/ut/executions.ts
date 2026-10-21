import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { afterExecution, applyApproval, assertApprover, canExecuteCase, nextRoundNo, validateExecution } from "@/lib/domain/ut";
import { readEvidenceFile, saveEvidenceFile, assertEvidenceFile } from "@/lib/server/ut-evidence-storage";
import { assertNotLocked, assertUtCode, dateOnly, koreaToday, rule, toDate, type UtActor } from "@/lib/server/mp/ut/common";

// ---------------------------------------------------------------------------
// 수행(6장 4단계) · 결과 확인 QC → PL(5~6단계) · 증적 열람. 수행·승인·증적은 INSERT 전용(DB 트리거).
// ---------------------------------------------------------------------------

const executionSchema = z.object({
  verdict: z.enum(["PASS", "FAIL", "BLOCKED", "NA"]),
  executedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  actualResult: z.string().max(4000).default(""),
  naReason: z.string().max(1000).default(""),
  envCodeId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
});

/** 내 수행 목록 — 내가 수행 담당자이고 수행 가능(승인·수행중)한 케이스. 반려 건 우선. */
export async function listMyUtExecutionTargets(projectIds: string[], userId: string) {
  const rows = await getPrisma().utCase.findMany({
    where: { projectId: { in: projectIds }, executorId: userId, isActive: true, status: { in: ["APPROVED", "IN_EXECUTION"] } },
    include: { wbsItem: { select: { displayId: true, name: true } }, executions: { orderBy: { roundNo: "desc" }, take: 1, select: { roundNo: true, verdict: true, approvalStatus: true } } },
    orderBy: [{ plannedDate: "asc" }, { displayId: "asc" }],
  });
  return rows.map((c) => ({
    id: c.id, displayId: c.displayId, name: c.name, plannedDate: dateOnly(c.plannedDate), status: c.status,
    wbsDisplayId: c.wbsItem?.displayId ?? "", wbsName: c.wbsItem?.name ?? "",
    precondition: c.precondition, steps: c.steps, inputData: c.inputData, expectedResult: c.expectedResult,
    lastRound: c.executions[0]?.roundNo ?? null, lastVerdict: c.executions[0]?.verdict ?? null, lastRejected: c.executions[0]?.approvalStatus === "REJECTED",
  })).sort((a, b) => Number(b.lastRejected) - Number(a.lastRejected));
}

export async function registerUtExecution(actor: UtActor, caseId: string, input: unknown, files: File[]) {
  const data = executionSchema.parse(input);
  await assertNotLocked(actor.projectId);
  const prisma = getPrisma();
  const c = await prisma.utCase.findUnique({ where: { id: caseId }, include: { executions: { select: { roundNo: true } } } });
  if (!c || c.projectId !== actor.projectId || !c.isActive) throw new DomainError("NOT_FOUND", "케이스를 찾을 수 없습니다.");
  if (c.executorId !== actor.userId) throw new DomainError("FORBIDDEN", "배정된 수행 담당자만 결과를 등록할 수 있습니다.");
  if (!canExecuteCase(c.status)) throw new DomainError("INVALID_STATE", "승인되었거나 재수행 대기인 케이스만 수행 결과를 등록할 수 있습니다.");
  for (const file of files) assertEvidenceFile(file);
  await rule(() => validateExecution({ verdict: data.verdict, actualResult: data.actualResult, naReason: data.naReason, evidenceCount: files.length }));
  await assertUtCode(actor.projectId, data.envCodeId, "ut_env", "수행 환경");

  const project = await prisma.project.findUnique({ where: { id: actor.projectId }, select: { code: true } });
  // 파일을 먼저 저장(실패하면 DB에 아무것도 남기지 않음). DB 기록이 실패해 남은 파일은 수기 무결성 점검에서 "DB 미등록 파일"로 보고된다.
  const saved: { id: string; fileName: string; storageKey: string; sizeBytes: number; sha256: string; mimeType: string }[] = [];
  for (const file of files) {
    const id = randomUUID();
    saved.push({ id, fileName: file.name.slice(0, 255), ...(await saveEvidenceFile(project?.code ?? "PROJECT", id, file)) });
  }
  const next = afterExecution(data.verdict);
  const roundNo = nextRoundNo(c.executions.map((e) => e.roundNo));
  const execution = await prisma.$transaction(async (tx) => {
    const created = await tx.utExecution.create({ data: {
      projectId: c.projectId, caseId, wbsItemId: c.wbsItemId, roundNo, envCodeId: data.envCodeId, executorId: actor.userId,
      executedOn: toDate(data.executedOn ?? koreaToday())!, actualResult: data.actualResult, verdict: data.verdict, naReason: data.naReason, approvalStatus: next.approvalStatus,
    } });
    if (saved.length) await tx.utEvidence.createMany({ data: saved.map((f) => ({ id: f.id, projectId: c.projectId, executionId: created.id, fileName: f.fileName, storageKey: f.storageKey, sizeBytes: f.sizeBytes, mimeType: f.mimeType, sha256: f.sha256, uploadedBy: actor.userId })) });
    await tx.utCase.update({ where: { id: caseId }, data: { status: next.caseStatus } });
    return created;
  });
  await writeAuditLog(actor.projectId, actor.userId, "UT_EXECUTION_INSERT", "ut_executions", execution.id, null, { caseId, roundNo, verdict: data.verdict, evidences: saved.map((f) => ({ id: f.id, sha256: f.sha256 })) });
  return { id: execution.id, roundNo, verdict: data.verdict };
}

// ---------------------------------------------------------------------------
// 확인함 QC / PL
// ---------------------------------------------------------------------------

export async function listUtApprovalInbox(projectIds: string[], userId: string, step: "QC" | "PL") {
  const rows = await getPrisma().utExecution.findMany({
    where: step === "QC"
      ? { projectId: { in: projectIds }, approvalStatus: "QC_PENDING", case: { qcUserId: userId } }
      : { projectId: { in: projectIds }, approvalStatus: "PL_PENDING", case: { plUserId: userId } },
    include: {
      case: { select: { id: true, displayId: true, name: true, expectedResult: true, wbsItem: { select: { displayId: true } } } },
      executor: { select: { name: true } },
      evidences: { select: { id: true, fileName: true, sizeBytes: true, views: { where: { viewerId: userId }, select: { id: true }, take: 1 } } },
      approvals: { include: { approver: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((e) => ({
    id: e.id, roundNo: e.roundNo, verdict: e.verdict, executedOn: dateOnly(e.executedOn), actualResult: e.actualResult, naReason: e.naReason, executorName: e.executor.name,
    waitingDays: Math.floor((Date.now() - e.createdAt.getTime()) / 86_400_000),
    caseId: e.case.id, caseDisplayId: e.case.displayId, caseName: e.case.name, expectedResult: e.case.expectedResult,
    wbsDisplayId: e.case.wbsItem?.displayId ?? "",
    evidences: e.evidences.map((v) => ({ id: v.id, fileName: v.fileName, sizeBytes: v.sizeBytes, viewed: v.views.length > 0 })),
    qcComment: e.approvals.find((a) => a.step === "QC")?.comment ?? "", qcApprover: e.approvals.find((a) => a.step === "QC")?.approver.name ?? null,
  }));
}

/** 증적 열람 — 프로젝트 범위 확인, 열람 기록(8장: 열람 기록이 있어야 확인 가능). */
export async function openUtEvidence(projectIds: string[], viewerId: string, evidenceId: string) {
  const evidence = await getPrisma().utEvidence.findUnique({ where: { id: evidenceId } });
  if (!evidence || !projectIds.includes(evidence.projectId)) throw new DomainError("NOT_FOUND", "증적을 찾을 수 없습니다.");
  const bytes = await readEvidenceFile(evidence.storageKey);
  await getPrisma().utEvidenceView.create({ data: { evidenceId, viewerId } });
  return { bytes, fileName: evidence.fileName, mimeType: evidence.mimeType };
}

export async function decideUtApproval(actor: UtActor, executionId: string, input: unknown) {
  const data = z.object({
    step: z.enum(["QC", "PL"]), decision: z.enum(["APPROVED", "REJECTED"]),
    rejectReasonCodeId: z.string().uuid().nullable().optional().transform((v) => v ?? null), comment: z.string().max(2000).default(""),
  }).parse(input);
  await assertNotLocked(actor.projectId);
  const prisma = getPrisma();
  const e = await prisma.utExecution.findUnique({ where: { id: executionId }, include: { case: true, evidences: { select: { id: true, views: { where: { viewerId: actor.userId }, select: { id: true }, take: 1 } } } } });
  if (!e || e.projectId !== actor.projectId) throw new DomainError("NOT_FOUND", "수행 결과를 찾을 수 없습니다.");
  const hasViewedEvidence = e.evidences.length > 0 && e.evidences.every((v) => v.views.length > 0);
  await rule(() => assertApprover({ step: data.step, actorId: actor.userId, executorId: e.executorId, qcUserId: e.case.qcUserId, plUserId: e.case.plUserId, hasViewedEvidence, verdict: e.verdict }));
  if (data.step === "PL" && e.case.qcUserId === actor.userId) throw new DomainError("FORBIDDEN", "QC 확인자는 PL 확인을 할 수 없습니다.");
  await assertUtCode(actor.projectId, data.rejectReasonCodeId, "ut_reject_reason", "반려 사유");
  const next = await rule(() => applyApproval({ approvalStatus: e.approvalStatus, verdict: e.verdict, step: data.step, decision: data.decision, rejectReasonCodeId: data.rejectReasonCodeId, comment: data.comment }));
  await prisma.$transaction([
    prisma.utApproval.create({ data: { projectId: e.projectId, executionId, wbsItemId: e.wbsItemId, step: data.step, approverId: actor.userId, decision: data.decision, rejectReasonCodeId: data.rejectReasonCodeId, comment: data.comment } }),
    prisma.utExecution.update({ where: { id: executionId }, data: { approvalStatus: next.approvalStatus, approvalUpdatedAt: new Date() } }),
    prisma.utCase.update({ where: { id: e.caseId }, data: { status: next.caseStatus } }),
  ]);
  await writeAuditLog(actor.projectId, actor.userId, `UT_APPROVAL_${data.step}_${data.decision}`, "ut_executions", executionId, { approvalStatus: e.approvalStatus }, { approvalStatus: next.approvalStatus, comment: data.comment || undefined });
  return { ok: true, approvalStatus: next.approvalStatus };
}


