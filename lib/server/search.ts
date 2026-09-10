import "server-only";

import { getPrisma } from "@/lib/server/db-pg";

export type SearchResultItem = { id: string; title: string; snippet: string; meta: string; href: string };
export type SearchResultGroup = { type: string; label: string; items: SearchResultItem[] };

const dateStr = (value: Date) => value.toISOString().slice(0, 10);
const snippetOf = (value: string, max = 80) => (value.length > max ? `${value.slice(0, max)}…` : value);

// 상단 전체 검색 — 실무에서 가장 많이 찾는 데이터(사용자/WBS Task/이슈/요구사항/관리업무/업무일지/PMO Daily/공지사항)를
// 프로젝트 범위로 키워드(제목·본문 contains, 대소문자 무시) 검색한다. 소프트삭제(archivedAt/deletedAt)된 항목은 제외한다.
// "사용자" 결과는 그 사람 개인 정보가 아니라 담당 Task 조회 화면(/wbs/by-owner)으로 바로 연결해, 사람 이름으로
// 검색했을 때 "이 사람이 뭘 하고 있는지"를 바로 찾을 수 있게 한다 — WBS Task 검색도 담당자명을 함께 매칭해
// 같은 목적(사용자 Task 검색)을 보완한다(2026-09-10 사용자 요청).
// viewer.canViewAllWbs가 false(관리자·운영자가 아닌 일반 사용자)면 WBS Task는 본인이 담당한 것만, 사용자는 본인
// 한 명만 나온다 — /wbs/[id]·/wbs/by-owner 페이지 자체의 접근 제한과 검색 결과가 항상 같은 기준을 쓰도록 맞춘다.
export async function searchAll(projectId: string, query: string, limitPerGroup: number, viewer: { userId: string; canViewAllWbs: boolean }): Promise<SearchResultGroup[]> {
  const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });
  const prisma = getPrisma();

  const [members, wbsItems, issues, requirements, managementTasks, workLogs, announcements, delayedTasks] = await Promise.all([
    prisma.projectMember.findMany({
      where: {
        projectId, isActive: true,
        ...(viewer.canViewAllWbs ? {} : { userId: viewer.userId }),
        user: { status: "ACTIVE", OR: [{ name: contains(query) }, { userId: contains(query) }] },
      },
      include: { user: true }, orderBy: { user: { name: "asc" } }, take: limitPerGroup,
    }),
    prisma.wbsItem.findMany({
      where: {
        projectId, archivedAt: null,
        ...(viewer.canViewAllWbs ? {} : { ownerUserId: viewer.userId }),
        OR: [{ name: contains(query) }, { description: contains(query) }, { ownerNameRaw: contains(query) }, { owner: { name: contains(query) } }],
      },
      orderBy: { updatedAt: "desc" }, take: limitPerGroup,
    }),
    prisma.issue.findMany({
      where: { projectId, archivedAt: null, OR: [{ title: contains(query) }, { description: contains(query) }, { responseContent: contains(query) }] },
      orderBy: { updatedAt: "desc" }, take: limitPerGroup,
    }),
    prisma.requirement.findMany({
      where: { projectId, archivedAt: null, OR: [{ title: contains(query) }, { content: contains(query) }] },
      orderBy: { updatedAt: "desc" }, take: limitPerGroup,
    }),
    prisma.managementTask.findMany({
      where: { projectId, archivedAt: null, OR: [{ name: contains(query) }, { purpose: contains(query) }, { impactAnalysis: contains(query) }] },
      orderBy: { updatedAt: "desc" }, take: limitPerGroup,
    }),
    prisma.workLog.findMany({
      where: { projectId, OR: [{ workContent: contains(query) }, { referenceContent: contains(query) }, { notes: contains(query) }] },
      orderBy: { updatedAt: "desc" }, take: limitPerGroup,
    }),
    prisma.announcement.findMany({
      where: { projectId, deletedAt: null, OR: [{ title: contains(query) }, { content: contains(query) }] },
      orderBy: { updatedAt: "desc" }, take: limitPerGroup,
    }),
    prisma.pmoDelayedTask.findMany({
      where: { archivedAt: null, snapshot: { projectId }, OR: [{ description: contains(query) }, { delayReason: contains(query) }, { responsePlan: contains(query) }] },
      orderBy: { updatedAt: "desc" }, take: limitPerGroup, include: { snapshot: true },
    }),
  ]);

  const groups: SearchResultGroup[] = [
    { type: "user", label: "사용자", items: members.map((member) => ({ id: member.user.id, title: member.user.name, snippet: member.user.department || member.user.jobTitle || "", meta: member.user.userId, href: `/wbs/by-owner/${member.user.userId}` })) },
    { type: "wbs", label: "WBS Task", items: wbsItems.map((item) => ({ id: item.id, title: item.name, snippet: snippetOf(item.description), meta: item.displayId, href: `/wbs/${item.id}` })) },
    { type: "issue", label: "이슈", items: issues.map((item) => ({ id: item.id, title: item.title, snippet: snippetOf(item.description || item.responseContent), meta: item.displayId, href: `/issues/${item.id}` })) },
    { type: "requirement", label: "요구사항", items: requirements.map((item) => ({ id: item.id, title: item.title, snippet: snippetOf(item.content), meta: item.displayId, href: `/requirements/${item.id}` })) },
    { type: "management-task", label: "관리업무", items: managementTasks.map((item) => ({ id: item.id, title: item.name, snippet: snippetOf(item.purpose || item.impactAnalysis), meta: item.displayId, href: `/management-tasks/${item.id}` })) },
    { type: "work-log", label: "업무일지", items: workLogs.map((item) => ({ id: item.id, title: snippetOf(item.workContent, 40), snippet: snippetOf(item.referenceContent || item.notes), meta: `${dateStr(item.workDate)} · ${item.displayId}`, href: `/work-logs/${item.id}` })) },
    { type: "pmo-daily", label: "PMO Daily", items: delayedTasks.map((item) => ({ id: item.id, title: snippetOf(item.description, 40), snippet: snippetOf(item.delayReason || item.responsePlan), meta: `${dateStr(item.snapshot.reportDate)} · ${item.displayId}`, href: `/pmo-daily/${dateStr(item.snapshot.reportDate)}` })) },
    { type: "announcement", label: "공지사항", items: announcements.map((item) => ({ id: item.id, title: item.title, snippet: snippetOf(item.content), meta: dateStr(item.publishedAt), href: `/announcements/${item.id}` })) },
  ];
  return groups.filter((group) => group.items.length > 0);
}
