import "server-only";
import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { DEFECT_GROUP } from "@/lib/domain/defects";
import { hasFullDefectView } from "@/lib/domain/defect-access";
import { assertDefectCode, ensureDefectCommonCodes, getDefectCodes } from "@/lib/server/mp/defects/common";
import type { DefectActorCtx } from "@/lib/server/mp/defects/defects";

// ---------------------------------------------------------------------------
// 결함관리 설정(DM-08, DM-10) — 중대 심각도, 대상 도메인.
// 설정 변경은 운영자·PMO·관리자만. 새 테이블만 쓰며 wbs_items·단위테스트 테이블은 읽기만 한다(규칙 1).
// ---------------------------------------------------------------------------

function assertManager(actor: DefectActorCtx) {
  if (!hasFullDefectView({ userId: actor.userId, role: actor.role, jobTitle: actor.jobTitle })) throw new DomainError("FORBIDDEN", "설정은 운영자·PMO·관리자만 변경할 수 있습니다.");
}

export const canManageDefectSettings = (actor: DefectActorCtx) => hasFullDefectView({ userId: actor.userId, role: actor.role, jobTitle: actor.jobTitle });

// 초기 테스트 대상(설계서 6.2). 프로젝트에 대상 도메인이 하나도 없을 때만 넣는다.
const DEFAULT_SITES = [{ name: "cinetube", origin: "http://localhost:8080" }, { name: "secret album", origin: "http://localhost:8090" }];

export async function getDefectSettings(actor: DefectActorCtx) {
  await ensureDefectCommonCodes(actor.projectId);
  const prisma = getPrisma();
  if (!(await prisma.defectTargetSite.count({ where: { projectId: actor.projectId } }))) {
    await prisma.defectTargetSite.createMany({ data: DEFAULT_SITES.map((s) => ({ ...s, projectId: actor.projectId, createdBy: actor.userId })), skipDuplicates: true });
  }
  const [codes, sites] = await Promise.all([getDefectCodes(actor.projectId), prisma.defectTargetSite.findMany({ where: { projectId: actor.projectId }, orderBy: { createdAt: "asc" } })]);
  return { codes, sites: sites.map((s) => ({ id: s.id, name: s.name, origin: s.origin, isActive: s.isActive })), canManage: canManageDefectSettings(actor) };
}

export async function setSeverityMajor(actor: DefectActorCtx, input: unknown) {
  assertManager(actor);
  const data = z.object({ severityCodeId: z.string().uuid(), isMajorImpact: z.boolean() }).parse(input);
  await assertDefectCode(actor.projectId, data.severityCodeId, DEFECT_GROUP.severity, "심각도");
  await getPrisma().defectSeveritySetting.upsert({
    where: { projectId_severityCodeId: { projectId: actor.projectId, severityCodeId: data.severityCodeId } },
    create: { projectId: actor.projectId, severityCodeId: data.severityCodeId, isMajorImpact: data.isMajorImpact }, update: { isMajorImpact: data.isMajorImpact },
  });
  await writeAuditLog(actor.projectId, actor.userId, "DEFECT_SETTING", "defect_severity_settings", data.severityCodeId, null, data);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// DM-10 대상 도메인 — 위젯·확장 프로그램 허용 출처. 삭제 없이 비활성만.
// ---------------------------------------------------------------------------

/** 출처(origin) 정규화 — http/https 스킴+호스트(+포트)만 남긴다. 경로·쿼리는 허용하지 않는다. */
export function normalizeOrigin(value: string) {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new DomainError("INVALID_CODE", "주소 형식이 올바르지 않습니다. 예: http://localhost:8080"); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new DomainError("INVALID_CODE", "주소는 http 또는 https로 시작해야 합니다.");
  if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) throw new DomainError("INVALID_CODE", "도메인(주소와 포트)만 입력해 주세요. 경로는 넣을 수 없습니다.");
  return url.origin;
}

export async function saveTargetSite(actor: DefectActorCtx, input: unknown) {
  assertManager(actor);
  const data = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(100), origin: z.string().trim().min(1).max(300), isActive: z.boolean().default(true) }).parse(input);
  const origin = normalizeOrigin(data.origin);
  const prisma = getPrisma();
  const dup = await prisma.defectTargetSite.findFirst({ where: { projectId: actor.projectId, origin, ...(data.id ? { id: { not: data.id } } : {}) }, select: { id: true } });
  if (dup) throw new DomainError("INVALID_STATE", "이미 등록된 도메인입니다.");
  let id = data.id;
  if (id) {
    const result = await prisma.defectTargetSite.updateMany({ where: { id, projectId: actor.projectId }, data: { name: data.name, origin, isActive: data.isActive } });
    if (!result.count) throw new DomainError("NOT_FOUND", "대상 도메인을 찾을 수 없습니다.");
  } else {
    id = (await prisma.defectTargetSite.create({ data: { projectId: actor.projectId, name: data.name, origin, isActive: data.isActive, createdBy: actor.userId } })).id;
  }
  await writeAuditLog(actor.projectId, actor.userId, "DEFECT_SETTING", "defect_target_sites", id, null, { name: data.name, origin, isActive: data.isActive });
  return { id };
}

/** 위젯·확장 메시지의 출처가 활성 대상 도메인인지 확인한다. */
export async function isAllowedOrigin(projectId: string, origin: string) {
  let normalized: string;
  try { normalized = normalizeOrigin(origin); } catch { return false; }
  return !!(await getPrisma().defectTargetSite.findFirst({ where: { projectId, origin: normalized, isActive: true }, select: { id: true } }));
}

export async function listActiveOrigins(projectId: string) {
  return (await getPrisma().defectTargetSite.findMany({ where: { projectId, isActive: true }, select: { origin: true } })).map((s) => s.origin);
}
