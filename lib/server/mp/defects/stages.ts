import "server-only";
import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { DEFECT_GROUP } from "@/lib/domain/defects";
import { ensureDefectCommonCodes } from "@/lib/server/mp/defects/common";

// ---------------------------------------------------------------------------
// 결함 테스트 단계 관리(설정 > 프로젝트 관리, 슈퍼관리자 전용).
// 단계는 공통코드(defect_test_stage)이고, "잠금"은 공통코드의 사용 안 함(isActive=false)으로 저장한다.
// 잠금된 단계는 결함관리 화면의 선택지·필터에서 보이지 않고 새 결함에 쓸 수 없다. 이미 등록된 결함은 그대로 남는다.
// 단위테스트 화면·데이터는 건드리지 않는다(규칙 1).
// ---------------------------------------------------------------------------

async function assertSuperAdmin(userId: string) {
  const user = await getPrisma().user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== "SUPER_ADMIN") throw new DomainError("FORBIDDEN", "테스트 단계는 슈퍼관리자만 관리할 수 있습니다.");
}

async function stageGroup(projectId: string) {
  await ensureDefectCommonCodes(projectId);
  return getPrisma().commonCodeGroup.findFirstOrThrow({ where: { projectId, code: DEFECT_GROUP.stage }, select: { id: true } });
}

export async function listTestStages(userId: string, projectId: string) {
  await assertSuperAdmin(userId);
  await stageGroup(projectId);
  const codes = await getPrisma().commonCode.findMany({ where: { projectId, groupCode: DEFECT_GROUP.stage }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, label: true, isActive: true } });
  return codes.map((c) => ({ id: c.id, label: c.label, locked: !c.isActive }));
}

export async function createTestStage(userId: string, projectId: string, input: unknown) {
  await assertSuperAdmin(userId);
  const { label } = z.object({ label: z.string().trim().min(1, "단계 이름을 입력해 주세요.").max(50, "단계 이름은 50자 이내로 입력해 주세요.") }).parse(input);
  const group = await stageGroup(projectId);
  const prisma = getPrisma();
  const existing = await prisma.commonCode.findMany({ where: { projectId, groupId: group.id }, select: { label: true, sortOrder: true } });
  if (existing.some((c) => c.label.trim().toLowerCase() === label.toLowerCase())) throw new DomainError("INVALID_STATE", "같은 이름의 테스트 단계가 이미 있습니다.");
  const created = await prisma.commonCode.create({ data: {
    projectId, groupId: group.id, groupCode: DEFECT_GROUP.stage, code: `STAGE_${Date.now().toString(36).toUpperCase()}`, label,
    sortOrder: Math.max(0, ...existing.map((c) => c.sortOrder)) + 10, isActive: true,
  } });
  await writeAuditLog(projectId, userId, "DEFECT_STAGE_CREATE", "common_codes", created.id, null, { label });
  return { id: created.id };
}

/** 여러 단계의 잠금 상태와 순서를 한 번에 저장한다. 사용 중인 단계가 하나도 남지 않으면 거부한다. order는 단계 id의 전체 목록(화면 순서)이다. */
export async function saveTestStageLocks(userId: string, projectId: string, input: unknown) {
  await assertSuperAdmin(userId);
  const { locks, order } = z.object({ locks: z.record(z.string().uuid(), z.boolean()), order: z.array(z.string().uuid()).optional() }).parse(input);
  const group = await stageGroup(projectId);
  const prisma = getPrisma();
  const stages = await prisma.commonCode.findMany({ where: { projectId, groupId: group.id }, select: { id: true, isActive: true, sortOrder: true } });
  const next = new Map(stages.map((s) => [s.id, s.isActive]));
  for (const [id, locked] of Object.entries(locks)) {
    if (!next.has(id)) throw new DomainError("INVALID_CODE", "이 프로젝트의 테스트 단계가 아닙니다.");
    next.set(id, !locked);
  }
  if (![...next.values()].some(Boolean)) throw new DomainError("LAST_ACTIVE_CODE", "모든 테스트 단계를 잠글 수 없습니다. 최소 한 개는 사용 중이어야 합니다.");
  if (order && (order.length !== stages.length || new Set(order).size !== order.length || order.some((id) => !next.has(id)))) throw new DomainError("INVALID_CODE", "테스트 단계 순서가 올바르지 않습니다. 화면을 새로 고친 뒤 다시 시도해 주세요.");
  const newSort = new Map(order ? order.map((id, i) => [id, (i + 1) * 10]) : stages.map((x) => [x.id, x.sortOrder]));
  const changed = stages.filter((x) => next.get(x.id) !== x.isActive || newSort.get(x.id) !== x.sortOrder);
  if (!changed.length) return { changed: 0 };
  await prisma.$transaction(changed.map((x) => prisma.commonCode.update({ where: { id: x.id }, data: { isActive: next.get(x.id)!, sortOrder: newSort.get(x.id)! } })));
  await writeAuditLog(projectId, userId, "DEFECT_STAGE_SETTING", "common_codes", projectId, null, { locks, order: order ?? null });
  return { changed: changed.length };
}
