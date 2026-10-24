import "server-only";
import { getPrisma } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";

// ---------------------------------------------------------------------------
// 단위테스트 데이터 읽기 전용 조회(F-18, 규칙 1) — 케이스 검색·진입 정보 해석. 쓰기 없음.
// 클라이언트가 보낸 표시값은 신뢰하지 않고 id만 받아 서버가 채운다.
// ---------------------------------------------------------------------------

const caseSelect = {
  id: true, displayId: true, name: true, screenId: true, screenName: true, screenUrl: true, wbsItemId: true, groupId: true, requirementId: true, workerUserId: true, qcUserId: true, plUserId: true,
  group: { select: { label: true } }, wbsItem: { select: { displayId: true, name: true, ownerUserId: true } },
  worker: { select: { name: true } }, qc: { select: { name: true } }, pl: { select: { name: true } },
} as const;

type CaseRow = NonNullable<Awaited<ReturnType<typeof findOne>>>;

function shape(c: CaseRow) {
  return {
    id: c.id, displayId: c.displayId, name: c.name, screenId: c.screenId, screenName: c.screenName, screenUrl: c.screenUrl,
    groupId: c.groupId, groupLabel: c.group.label, wbsItemId: c.wbsItemId, wbsDisplayId: c.wbsItem?.displayId ?? null, wbsName: c.wbsItem?.name ?? null, requirementId: c.requirementId,
    workerUserId: c.workerUserId ?? c.wbsItem?.ownerUserId ?? null, workerName: c.worker?.name ?? null, qcName: c.qc?.name ?? null, plName: c.pl?.name ?? null,
  };
}

const findOne = (projectId: string, id: string) => getPrisma().utCase.findFirst({ where: { id, projectId, isActive: true }, select: caseSelect });

export async function searchCases(projectId: string, q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await getPrisma().utCase.findMany({
    where: { projectId, isActive: true, OR: [{ displayId: { contains: term, mode: "insensitive" } }, { name: { contains: term, mode: "insensitive" } }, { screenName: { contains: term, mode: "insensitive" } }, { screenId: { contains: term, mode: "insensitive" } }] },
    select: caseSelect, orderBy: { displayId: "asc" }, take: 20,
  });
  return rows.map(shape);
}

export async function getCaseEntry(projectId: string, id: string) {
  const c = await findOne(projectId, id);
  if (!c) throw new DomainError("NOT_FOUND", "테스트 케이스를 찾을 수 없습니다.");
  return shape(c);
}

/** 조치자 선택 목록 — 이 프로젝트의 활성 구성원과 소속 업무그룹(동명이인 구분용). */
export async function listProjectMembers(projectId: string) {
  const prisma = getPrisma();
  const rows = await prisma.projectMember.findMany({ where: { projectId, isActive: true, user: { status: "ACTIVE" } }, select: { user: { select: { id: true, userId: true, name: true } } } });
  const maps = await prisma.userGroupMap.findMany({ where: { userId: { in: rows.map((r) => r.user.id) }, group: { projectId, groupType: "WORK_MODULE", isActive: true } }, select: { userId: true, group: { select: { label: true, sortOrder: true } } } });
  const groupsOf = new Map<string, { label: string; sortOrder: number }[]>();
  for (const m of maps) groupsOf.set(m.userId, [...(groupsOf.get(m.userId) ?? []), m.group]);
  return rows.map((r) => ({ ...r.user, groups: (groupsOf.get(r.user.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder).map((g) => g.label).join(", ") })).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
