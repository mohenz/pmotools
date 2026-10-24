import "server-only";
import { randomUUID } from "node:crypto";
import { getPrisma, actorNameOf, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { assertEvidenceFile, extensionOf, readEvidenceFile, saveEvidenceFile } from "@/lib/server/ut-evidence-storage";
import { defectPermissions } from "@/lib/domain/defect-access";
import { loadAccessFacts, type DefectActorCtx } from "@/lib/server/mp/defects/defects";

// ---------------------------------------------------------------------------
// 결함 증적(설계서 6.3) — 멀티파트 파일을 증적 저장소에 저장한다. 결함당 3개, 파일당 20MB, 단위테스트와 같은 형식.
// 저장소 모듈(ut-evidence-storage)은 수정하지 않고 가져다 쓴다. 증적 행은 INSERT 전용이다.
// ---------------------------------------------------------------------------

export const DEFECT_EVIDENCE_MAX_FILES = 3;

async function visibleDefect(actor: DefectActorCtx, defectId: string) {
  const prisma = getPrisma();
  const d = await prisma.defect.findFirst({ where: { id: defectId, projectId: actor.projectId, isActive: true }, select: { id: true, createdBy: true, assigneeUserId: true, groupId: true, caseId: true, projectId: true } });
  if (!d) throw new DomainError("NOT_FOUND", "결함을 찾을 수 없습니다.");
  const perms = defectPermissions(actor, d, await loadAccessFacts(actor));
  if (!perms.view) throw new DomainError("NOT_FOUND", "결함을 찾을 수 없습니다.");
  return { d, perms };
}

/** 등록 직후 또는 상세에서 증적을 추가한다. 등록자·담당자·지정 권한자만 추가할 수 있다(editBasic). */
export async function addDefectEvidence(actor: DefectActorCtx, defectId: string, files: File[]) {
  if (!files.length) return { added: 0 };
  const { perms } = await visibleDefect(actor, defectId);
  if (!perms.editBasic) throw new DomainError("FORBIDDEN", "증적을 추가할 권한이 없습니다.");
  const prisma = getPrisma();
  const existing = await prisma.defectEvidence.count({ where: { defectId } });
  if (existing + files.length > DEFECT_EVIDENCE_MAX_FILES) throw new DomainError("INVALID_CODE", `증적은 결함당 최대 ${DEFECT_EVIDENCE_MAX_FILES}개까지 올릴 수 있습니다(현재 ${existing}개).`);
  files.forEach((f) => assertEvidenceFile(f)); // 저장 전에 모두 검사
  const project = await prisma.project.findUniqueOrThrow({ where: { id: actor.projectId }, select: { code: true } });
  const saved: { id: string; fileName: string; storageKey: string; sizeBytes: number; sha256: string; mimeType: string }[] = [];
  for (const file of files) {
    const id = randomUUID();
    const s = await saveEvidenceFile(project.code, id, file);
    saved.push({ id, fileName: file.name.slice(0, 255) || `evidence.${extensionOf(file.name)}`, ...s });
  }
  const actorName = (await actorNameOf(actor.userId)) ?? "";
  await prisma.$transaction(async (tx) => {
    await tx.defectEvidence.createMany({ data: saved.map((f) => ({ id: f.id, projectId: actor.projectId, defectId, fileName: f.fileName, mimeType: f.mimeType, sizeBytes: f.sizeBytes, sha256: f.sha256, storageKey: f.storageKey, uploadedBy: actor.userId })) });
    await tx.defectHistory.create({ data: { defectId, action: "UPDATE", actorId: actor.userId, actorName, changedData: { evidence: { before: null, after: saved.map((f) => f.fileName).join(", ") } } } });
  });
  await writeAuditLog(actor.projectId, actor.userId, "DEFECT_EVIDENCE", "defect_evidences", defectId, null, { count: saved.length });
  return { added: saved.length };
}

/** 증적 열람 — 결함 조회 범위를 먼저 확인한다. */
export async function openDefectEvidence(actor: DefectActorCtx, evidenceId: string) {
  const prisma = getPrisma();
  const e = await prisma.defectEvidence.findFirst({ where: { id: evidenceId, projectId: actor.projectId } });
  if (!e) throw new DomainError("NOT_FOUND", "증적을 찾을 수 없습니다.");
  await visibleDefect(actor, e.defectId);
  return { bytes: await readEvidenceFile(e.storageKey), mimeType: e.mimeType, fileName: e.fileName };
}
