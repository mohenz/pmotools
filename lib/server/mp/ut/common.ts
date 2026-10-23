import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { getPrisma } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { hasPmPmoAccess } from "@/lib/domain/job-access";
import { isManagerRole } from "@/lib/server/permissions";
import { UtRuleError } from "@/lib/domain/ut";

// ---------------------------------------------------------------------------
// 단위테스트(UT) 서버 공통 — 컨텍스트·권한, 공통코드 보장, 채번, 규칙 오류 변환.
// 다중 프로젝트(MP) 계열: 대상 프로젝트는 lib/server/mp/context의 선택 프로젝트, 쓰기는 하위 프로젝트에서만.
// ---------------------------------------------------------------------------

export type UtActor = { projectId: string; userId: string; role: string | null; jobTitle: string | null | undefined };

/** PM/PMO(직무) 또는 관리자 이상 — PL 대리 지정, 이정표 취소, 잠금 등 예외 처리 권한. */
export function isUtManager(actor: UtActor) {
  return hasPmPmoAccess(actor.jobTitle, actor.role) || isManagerRole(actor.role as never);
}

/** 관리자·슈퍼관리자 — 수행·QC·PL 확인을 지정자 대신 처리할 수 있다(2026-10-23 사용자 확정). 수행자 본인 확인 금지 등 직무 분리는 그대로. */
export function isUtAdmin(actor: Pick<UtActor, "role">) {
  return actor.role === "ADMIN" || actor.role === "SUPER_ADMIN";
}

export function assertUtManager(actor: UtActor) {
  if (!isUtManager(actor)) throw new DomainError("FORBIDDEN", "PM/PMO만 처리할 수 있습니다.");
}

/** 도메인 규칙 오류를 HTTP 응답용 DomainError로 바꾼다. */
export async function rule<T>(fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof UtRuleError) throw new DomainError(error.code === "FORBIDDEN" || error.code === "SEPARATION" ? "FORBIDDEN" : "INVALID_STATE", error.message);
    throw error;
  }
}

/** 대상 프로젝트의 활성 구성원인지 — 담당자·확인자 지정 검증. */
export async function assertActiveMember(projectId: string, userId: string | null | undefined, label: string) {
  if (!userId) return;
  const member = await getPrisma().projectMember.findFirst({ where: { projectId, userId, isActive: true, user: { status: "ACTIVE" } }, select: { id: true } });
  if (!member) throw new DomainError("INVALID_CODE", `${label}는 이 프로젝트의 활성 구성원이어야 합니다.`);
}

/** 마감 잠금(4.3 규칙 8) — 잠긴 프로젝트는 UT 쓰기 차단. */
export async function assertNotLocked(projectId: string) {
  const setting = await getPrisma().utProjectSetting.findUnique({ where: { projectId }, select: { lockedAt: true } });
  if (setting?.lockedAt) throw new DomainError("INVALID_STATE", "단위테스트가 마감 잠금된 프로젝트입니다. PMO에게 잠금 해제를 요청해 주세요.");
}

// ---------------------------------------------------------------------------
// 공통코드 보장 — 마이그레이션은 기존 프로젝트에만 시딩했으므로, 이후 생성된 프로젝트는 처음 사용할 때 만든다.
// ---------------------------------------------------------------------------

const UT_CODE_GROUPS: { code: string; label: string; description: string; sortOrder: number; codes: [string, string][] }[] = [
  { code: "ut_reject_reason", label: "단위테스트 반려 사유", description: "QC·PL 결과 확인 반려 사유", sortOrder: 900, codes: [["EVIDENCE", "증적 불충분"], ["MISMATCH", "예상결과 불일치"], ["INVALID_CASE", "케이스 부적정"], ["ETC", "기타"]] },
  { code: "ut_env", label: "단위테스트 수행 환경", description: "단위테스트 수행 환경(DEV·STG 등)", sortOrder: 901, codes: [["DEV", "DEV"], ["STG", "STG"]] },
  { code: "ut_defect_type", label: "단위테스트 결함 유형", description: "단위테스트 결함 분류", sortOrder: 902, codes: [["FUNCTION", "기능"], ["UI", "화면"], ["DATA", "데이터"], ["INTERFACE", "인터페이스"], ["PERFORMANCE", "성능"], ["SECURITY", "보안"]] },
  { code: "ut_case_type", label: "단위테스트 케이스유형", description: "단위테스트 케이스 분류(화면·기능·API)", sortOrder: 903, codes: [["SCREEN", "화면"], ["FUNCTION", "기능"], ["API", "API"]] },
];

export async function ensureUtCommonCodes(projectId: string) {
  const prisma = getPrisma();
  const existing = await prisma.commonCodeGroup.findMany({ where: { projectId, code: { in: UT_CODE_GROUPS.map((g) => g.code) } }, select: { code: true } });
  const have = new Set(existing.map((g) => g.code));
  for (const group of UT_CODE_GROUPS.filter((g) => !have.has(g.code))) {
    await prisma.$transaction(async (tx) => {
      const created = await tx.commonCodeGroup.create({ data: { projectId, code: group.code, label: group.label, description: group.description, sortOrder: group.sortOrder, isActive: true, isSystem: true } });
      await tx.commonCode.createMany({ data: group.codes.map(([code, label], index) => ({ projectId, groupId: created.id, groupCode: group.code, code, label, sortOrder: index, isActive: true })) });
    });
  }
}

export async function listUtCodes(projectId: string) {
  await ensureUtCommonCodes(projectId);
  const codes = await getPrisma().commonCode.findMany({ where: { projectId, isActive: true, groupCode: { in: UT_CODE_GROUPS.map((g) => g.code) } }, orderBy: [{ groupCode: "asc" }, { sortOrder: "asc" }], select: { id: true, groupCode: true, code: true, label: true } });
  return {
    rejectReasons: codes.filter((c) => c.groupCode === "ut_reject_reason"),
    envs: codes.filter((c) => c.groupCode === "ut_env"),
    defectTypes: codes.filter((c) => c.groupCode === "ut_defect_type"),
    caseTypes: codes.filter((c) => c.groupCode === "ut_case_type"),
  };
}

export async function assertUtCode(projectId: string, codeId: string | null | undefined, groupCode: string, label: string) {
  if (!codeId) return;
  const code = await getPrisma().commonCode.findUnique({ where: { id: codeId }, select: { projectId: true, groupCode: true, isActive: true } });
  if (!code || code.projectId !== projectId || code.groupCode !== groupCode || !code.isActive) throw new DomainError("INVALID_CODE", `선택한 ${label}을(를) 사용할 수 없습니다.`);
}

// ---------------------------------------------------------------------------
// 채번(4.7) — upsert 원자 증가(없으면 1로 생성)
// ---------------------------------------------------------------------------

export async function nextSequence(tx: Prisma.TransactionClient, scope: string) {
  const row = await tx.utSequence.upsert({ where: { scope }, create: { scope, value: 1 }, update: { value: { increment: 1 } } });
  return row.value;
}

export function versionConflict(): never {
  throw new DomainError("VERSION_CONFLICT", "다른 사용자가 먼저 수정했습니다. 최신 내용을 다시 확인해 주세요.");
}

export const dateOnly = (value: Date | null | undefined) => (value ? value.toISOString().slice(0, 10) : null);
export const toDate = (value: string | null | undefined) => (value ? new Date(`${value}T00:00:00.000Z`) : null);

export function koreaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
