import "server-only";

import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma/client";
import { MEETING_ACTION_STATUS_VALUES, actionItemOverdueDays, type MeetingActionStatus, type MeetingActionSummary } from "@/lib/domain/meeting-action-items";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";

// 회의록 Action Item 모아보기 · 진행상태 관리(2026-09-30).
// 조회 범위는 보관되지 않은 회의록의 Action Item. 상태 변경은 프로젝트 멤버 누구나, 변경마다 이력 1건을 남긴다.

export type MeetingActionItemFilters = {
  status?: string; // 상태 값 또는 "open"(완료 제외)
  overdue?: boolean;
  mine?: boolean;
  assignee?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type MeetingActionItemListRow = {
  id: string; minuteId: string; minuteDisplayId: string; minuteTitle: string; meetingDate: string;
  title: string; content: string; assigneeName: string; assigneeId: string | null; dueDate: string | null;
  status: MeetingActionStatus; overdueDays: number; statusChangedAt: string | null; statusChangerName: string | null;
};

export type MeetingActionItemLogRow = { id: string; fromStatus: MeetingActionStatus | null; toStatus: MeetingActionStatus; memo: string; actorName: string; createdAt: string };

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const dateValue = (date: string) => new Date(`${date}T00:00:00.000Z`);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function baseWhere(projectId: string, userId: string, filters: MeetingActionItemFilters): Prisma.MeetingMinuteActionItemWhereInput {
  const q = filters.q?.trim(), assignee = filters.assignee?.trim();
  const and: Prisma.MeetingMinuteActionItemWhereInput[] = [];
  if (filters.mine) and.push({ assigneeId: userId });
  if (assignee) and.push({ assigneeName: { contains: assignee, mode: "insensitive" } });
  if (q) and.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }, { minute: { title: { contains: q, mode: "insensitive" } } }, { minute: { displayId: { contains: q, mode: "insensitive" } } }] });
  const meetingDate = {
    ...(filters.dateFrom && DATE.test(filters.dateFrom) ? { gte: dateValue(filters.dateFrom) } : {}),
    ...(filters.dateTo && DATE.test(filters.dateTo) ? { lte: dateValue(filters.dateTo) } : {}),
  };
  return { minute: { projectId, archivedAt: null, ...(Object.keys(meetingDate).length ? { meetingDate } : {}) }, ...(and.length ? { AND: and } : {}) };
}

const overdueWhere = (today: string): Prisma.MeetingMinuteActionItemWhereInput => ({ status: { not: "DONE" }, dueDate: { lt: dateValue(today) } });

function statusWhere(status: string | undefined): Prisma.MeetingMinuteActionItemWhereInput {
  if (status === "open") return { status: { not: "DONE" } };
  if (status && (MEETING_ACTION_STATUS_VALUES as string[]).includes(status)) return { status: status as MeetingActionStatus };
  return {};
}

/** 목록 + 요약. 요약 건수는 상태·기한 경과 조건을 뺀 나머지 조건 기준이라 상태별 비중을 함께 볼 수 있다. */
export async function listMeetingActionItems(projectId: string, userId: string, today: string, filters: MeetingActionItemFilters = {}) {
  const prisma = getPrisma();
  const base = baseWhere(projectId, userId, filters);
  const where: Prisma.MeetingMinuteActionItemWhereInput = { AND: [base, statusWhere(filters.status), ...(filters.overdue ? [overdueWhere(today)] : [])] };
  const [grouped, overdue, total] = await Promise.all([
    prisma.meetingMinuteActionItem.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    prisma.meetingMinuteActionItem.count({ where: { AND: [base, overdueWhere(today)] } }),
    prisma.meetingMinuteActionItem.count({ where }),
  ]);
  const summary: MeetingActionSummary = { total: 0, overdue, WAITING: 0, IN_PROGRESS: 0, ON_HOLD: 0, DONE: 0 };
  for (const group of grouped) { summary[group.status] = group._count._all; summary.total += group._count._all; }

  const pageSize = Math.min(200, Math.max(10, filters.pageSize ?? 50));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  // 급한 것부터: 완료예정일 빠른 순(없으면 뒤), 같은 날이면 최근 회의 먼저
  const rows = await prisma.meetingMinuteActionItem.findMany({
    where, skip: (page - 1) * pageSize, take: pageSize,
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { minute: { meetingDate: "desc" } }, { sortOrder: "asc" }],
    include: { minute: { select: { id: true, displayId: true, title: true, meetingDate: true } }, statusChanger: { select: { name: true } } },
  });
  return {
    rows: rows.map((row): MeetingActionItemListRow => {
      const dueDate = row.dueDate ? isoDate(row.dueDate) : null;
      return {
        id: row.id, minuteId: row.minute.id, minuteDisplayId: row.minute.displayId, minuteTitle: row.minute.title, meetingDate: isoDate(row.minute.meetingDate),
        title: row.title, content: row.content, assigneeName: row.assigneeName, assigneeId: row.assigneeId, dueDate,
        status: row.status, overdueDays: actionItemOverdueDays({ status: row.status, dueDate }, today),
        statusChangedAt: row.statusChangedAt?.toISOString() ?? null, statusChangerName: row.statusChanger?.name ?? null,
      };
    }),
    summary, total, page, pageSize, totalPages,
  };
}
export type MeetingActionItemListResult = Awaited<ReturnType<typeof listMeetingActionItems>>;

/** PMO Daily 대시보드 카드 — 기한 경과 항목(오래 밀린 순). */
export async function listOverdueMeetingActionItems(projectId: string, userId: string, today: string, take = 20) {
  const where: Prisma.MeetingMinuteActionItemWhereInput = { AND: [baseWhere(projectId, userId, {}), overdueWhere(today)] };
  const [total, rows] = await Promise.all([
    getPrisma().meetingMinuteActionItem.count({ where }),
    getPrisma().meetingMinuteActionItem.findMany({ where, take, orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }], include: { minute: { select: { id: true, displayId: true, title: true } } } }),
  ]);
  return {
    total,
    rows: rows.map((row) => {
      const dueDate = isoDate(row.dueDate!);
      return { id: row.id, minuteId: row.minute.id, minuteDisplayId: row.minute.displayId, minuteTitle: row.minute.title, title: row.title, assigneeName: row.assigneeName, dueDate, status: row.status, overdueDays: actionItemOverdueDays({ status: row.status, dueDate }, today) };
    }),
  };
}
export type OverdueMeetingActionItems = Awaited<ReturnType<typeof listOverdueMeetingActionItems>>;

async function loadInProject(projectId: string, id: string) {
  const item = await getPrisma().meetingMinuteActionItem.findUnique({ where: { id }, include: { minute: { select: { projectId: true, archivedAt: true, displayId: true } } } });
  if (!item || item.minute.projectId !== projectId || item.minute.archivedAt) throw new DomainError("NOT_FOUND", "Action Item을 찾을 수 없습니다.");
  return item;
}

export const changeMeetingActionStatusSchema = z.object({
  status: z.enum(MEETING_ACTION_STATUS_VALUES),
  // 화면이 보고 있던 상태 — 그 사이 다른 사람이 바꿨으면 충돌로 돌려보낸다.
  fromStatus: z.enum(MEETING_ACTION_STATUS_VALUES),
  memo: z.string().trim().max(500).default(""),
});

export async function changeMeetingActionStatus(projectId: string, userId: string, id: string, input: unknown) {
  const data = changeMeetingActionStatusSchema.parse(input);
  const item = await loadInProject(projectId, id);
  if (item.status !== data.fromStatus) throw new DomainError("VERSION_CONFLICT", "다른 사용자가 먼저 상태를 변경했습니다. 새로고침 후 다시 확인해 주세요.");
  if (data.status === item.status) throw new DomainError("INVALID_STATE", "현재 상태와 같습니다.");
  const now = new Date();
  const prisma = getPrisma();
  // 상태가 fromStatus일 때만 바꾸는 조건부 갱신 — 동시에 누른 두 요청 중 하나만 성공한다.
  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.meetingMinuteActionItem.updateMany({ where: { id, status: data.fromStatus }, data: { status: data.status, statusChangedAt: now, statusChangedBy: userId } });
    if (result.count !== 1) return false;
    await tx.meetingMinuteActionItemLog.create({ data: { actionItemId: id, fromStatus: data.fromStatus, toStatus: data.status, memo: data.memo, actorId: userId, createdAt: now } });
    return true;
  });
  if (!changed) throw new DomainError("VERSION_CONFLICT", "다른 사용자가 먼저 상태를 변경했습니다. 새로고침 후 다시 확인해 주세요.");
  await writeAuditLog(projectId, userId, "MEETING_ACTION_ITEM_STATUS", "meeting_minute_action_items", id, { status: data.fromStatus }, { status: data.status, memo: data.memo, minute: item.minute.displayId });
  return { id, status: data.status, statusChangedAt: now.toISOString() };
}

export async function listMeetingActionItemLogs(projectId: string, id: string): Promise<MeetingActionItemLogRow[]> {
  await loadInProject(projectId, id);
  const logs = await getPrisma().meetingMinuteActionItemLog.findMany({ where: { actionItemId: id }, orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } });
  return logs.map((log) => ({ id: log.id, fromStatus: log.fromStatus, toStatus: log.toStatus, memo: log.memo, actorName: log.actor.name, createdAt: log.createdAt.toISOString() }));
}
