import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { getPrisma } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { DEFECT_GROUP, DEFECT_CODE_DEFAULTS, DEFECT_SEQ_MIN, DefectRuleError, defectDisplayId, planDefectSeed, type DefectStatusClassType } from "@/lib/domain/defects";

// ---------------------------------------------------------------------------
// 결함관리 서버 공통(설계서 3.2·3.4). 단위테스트 서버 코드(lib/server/mp/ut)와 독립이다 — 규칙 1.
// ---------------------------------------------------------------------------

/** 한국 시간 기준 오늘(YYYY-MM-DD). 결함 번호의 날짜로 쓴다. */
export function koreaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// ---------------------------------------------------------------------------
// 공통코드 보장 — 새 프로젝트이거나 처음 쓸 때 기본 코드 값을 만든다. 이미 있는 그룹은 건드리지 않는다.
// ---------------------------------------------------------------------------

export async function ensureDefectCommonCodes(projectId: string) {
  const prisma = getPrisma();
  const existing = await prisma.commonCodeGroup.findMany({ where: { projectId, code: { in: DEFECT_CODE_DEFAULTS.map((g) => g.code) } }, select: { code: true } });
  for (const group of planDefectSeed(existing.map((g) => g.code))) {
    await prisma.$transaction(async (tx) => {
      const created = await tx.commonCodeGroup.create({ data: { projectId, code: group.code, label: group.label, description: group.description, sortOrder: group.sortOrder, isActive: true, isSystem: true } });
      await tx.commonCode.createMany({ data: group.codes.map((c, index) => ({ projectId, groupId: created.id, groupCode: group.code, code: c.code, label: c.label, sortOrder: index, isActive: true })) });
      if (group.code !== DEFECT_GROUP.status && group.code !== DEFECT_GROUP.severity) return;
      const rows = await tx.commonCode.findMany({ where: { groupId: created.id }, select: { id: true, code: true } });
      const idOf = new Map(rows.map((r) => [r.code, r.id]));
      if (group.code === DEFECT_GROUP.status) {
        await tx.defectStatusClass.createMany({ data: group.codes.map((c) => ({ projectId, statusCodeId: idOf.get(c.code)!, statusClass: c.statusClass! })) });
      } else {
        await tx.defectSeveritySetting.createMany({ data: group.codes.map((c) => ({ projectId, severityCodeId: idOf.get(c.code)!, isMajorImpact: !!c.isMajorImpact })) });
      }
    });
  }
}

export type DefectCodeOption = { id: string; code: string; label: string };
export type DefectStatusOption = DefectCodeOption & { statusClass: DefectStatusClassType };
export type DefectSeverityOption = DefectCodeOption & { isMajorImpact: boolean };

/** 화면·통계가 쓰는 코드 묶음 — 활성 코드만, 정렬 순서대로. 상태에는 분류, 심각도에는 중대 여부가 붙는다. */
export async function getDefectCodes(projectId: string) {
  await ensureDefectCommonCodes(projectId);
  const prisma = getPrisma();
  const [codes, classes, settings] = await Promise.all([
    prisma.commonCode.findMany({ where: { projectId, isActive: true, groupCode: { in: Object.values(DEFECT_GROUP) } }, orderBy: [{ groupCode: "asc" }, { sortOrder: "asc" }], select: { id: true, groupCode: true, code: true, label: true } }),
    prisma.defectStatusClass.findMany({ where: { projectId }, select: { statusCodeId: true, statusClass: true } }),
    prisma.defectSeveritySetting.findMany({ where: { projectId }, select: { severityCodeId: true, isMajorImpact: true } }),
  ]);
  const classOf = new Map(classes.map((c) => [c.statusCodeId, c.statusClass as DefectStatusClassType]));
  const majorOf = new Map(settings.map((s) => [s.severityCodeId, s.isMajorImpact]));
  const pick = (group: string): DefectCodeOption[] => codes.filter((c) => c.groupCode === group).map(({ id, code, label }) => ({ id, code, label }));
  return {
    stages: pick(DEFECT_GROUP.stage),
    statuses: pick(DEFECT_GROUP.status).map((s): DefectStatusOption => ({ ...s, statusClass: classOf.get(s.id) ?? "OPEN" })),
    severities: pick(DEFECT_GROUP.severity).map((s): DefectSeverityOption => ({ ...s, isMajorImpact: majorOf.get(s.id) ?? false })),
    priorities: pick(DEFECT_GROUP.priority),
    identifications: pick(DEFECT_GROUP.identification),
  };
}

/** 결함 코드 검증 — 같은 프로젝트의 활성 코드이고 기대한 그룹인지. */
export async function assertDefectCode(projectId: string, codeId: string | null | undefined, groupCode: string, label: string) {
  if (!codeId) return;
  const code = await getPrisma().commonCode.findUnique({ where: { id: codeId }, select: { projectId: true, groupCode: true, isActive: true } });
  if (!code || code.projectId !== projectId || code.groupCode !== groupCode || !code.isActive) throw new DomainError("INVALID_CODE", `선택한 ${label}을(를) 사용할 수 없습니다.`);
}

// ---------------------------------------------------------------------------
// 채번(설계서 3.4) — 날짜별 순번은 5001부터 1씩 증가하고 9999를 넘기면 오류다.
// ---------------------------------------------------------------------------

export async function nextDefectNumber(tx: Prisma.TransactionClient, projectId: string, date: string = koreaToday()) {
  const scope = `defect:${projectId}:${date.replaceAll("-", "").slice(2)}`;
  const row = await tx.defectSequence.upsert({ where: { scope }, create: { scope, value: DEFECT_SEQ_MIN }, update: { value: { increment: 1 } } });
  try {
    return { seq: row.value, displayId: defectDisplayId(date, row.value) };
  } catch (error) {
    if (error instanceof DefectRuleError) throw new DomainError("INVALID_STATE", error.message);
    throw error;
  }
}
