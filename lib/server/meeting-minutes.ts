import "server-only";

import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { MeetingActionStatus } from "@/lib/domain/meeting-action-items";
import { isValidSession, type MeetingSession } from "@/lib/domain/meeting-minutes";
import { actorNameOf, getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { getCalendarEvent } from "@/lib/server/calendar";
import { DomainError } from "@/lib/server/errors";
import { getMemberRole, isManagerRole } from "@/lib/server/permissions";

const sessionSchema = z.object({ start: z.string(), end: z.string() }).refine(isValidSession, { message: "회의 시간은 HH:MM 형식이고 종료가 시작보다 늦어야 합니다." });
const attendeeSchema = z.object({ side: z.enum(["CUSTOMER", "VENDOR"]), userId: z.string().uuid().nullable().default(null), name: z.string().trim().min(1).max(100) });
const entrySchema = z.object({ content: z.string().trim().max(5000).default(""), remark: z.string().trim().max(2000).default(""), plannedSchedule: z.string().trim().max(200).default("") });
const actionItemSchema = z.object({ id: z.string().uuid().optional(), title: z.string().trim().max(500).default(""), content: z.string().trim().max(2000).default(""), assigneeId: z.string().uuid().nullable().default(null), assigneeName: z.string().trim().max(100).default(""), dueDate: z.union([z.string().date(), z.literal("")]).default("") });
const minuteFieldsSchema = z.object({
  category: z.string().trim().max(20).default(""), title: z.string().trim().min(1, "회의 안건을 입력해 주세요.").max(200),
  meetingDate: z.string().date(), sessions: z.array(sessionSchema).min(1, "회의 시간을 하나 이상 입력해 주세요.").max(10),
  location: z.string().trim().max(200).default(""), authorName: z.string().trim().min(1, "작성자를 입력해 주세요.").max(50),
  attendees: z.array(attendeeSchema).max(200).default([]),
  contents: z.array(entrySchema).max(100).default([]), decisions: z.array(entrySchema).max(100).default([]), notes: z.array(entrySchema).max(100).default([]),
  actionItems: z.array(actionItemSchema).max(100).default([]),
});
export const createMeetingMinuteSchema = minuteFieldsSchema;
export const updateMeetingMinuteSchema = minuteFieldsSchema.extend({ version: z.number().int().positive() });
export const archiveMeetingMinuteSchema = z.object({ version: z.number().int().positive() });
type MinuteInput = z.infer<typeof minuteFieldsSchema>;

export type MeetingMinuteAttendeeRow = { side: "CUSTOMER" | "VENDOR"; userId: string | null; name: string };
export type MeetingMinuteEntryRow = { content: string; remark: string; plannedSchedule: string };
// id·status는 저장된 항목만 가진다. 회의록 수정 시 id로 기존 항목을 유지해 진행상태·이력을 보존하고, 상태는 회의록 저장으로 바꾸지 않는다.
export type MeetingMinuteActionItemRow = { id?: string; title: string; content: string; assigneeId: string | null; assigneeName: string; dueDate: string; status?: MeetingActionStatus };
export type MeetingMinuteDetail = {
  id: string; displayId: string; category: string; title: string; meetingDate: string; sessions: MeetingSession[]; location: string; authorName: string;
  attendees: MeetingMinuteAttendeeRow[]; contents: MeetingMinuteEntryRow[]; decisions: MeetingMinuteEntryRow[]; notes: MeetingMinuteEntryRow[]; actionItems: MeetingMinuteActionItemRow[];
  createdBy: string; creatorName: string; createdAt: string; updatedAt: string; version: number; canEdit: boolean;
  // 양식 서명란 — 프로젝트정보 설정의 수행사 PM·발주사명
  signature: { pmName: string; customerName: string };
};
// 신규 작성 화면 초기값 — 캘린더 일정·회의실 예약에서 들어오면 해당 회의 정보로 채운다.
export type MeetingMinuteDraft = Omit<MeetingMinuteDetail, "id" | "displayId" | "createdBy" | "creatorName" | "createdAt" | "updatedAt" | "version" | "canEdit" | "signature">;

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const dateValue = (date: string) => new Date(`${date}T00:00:00.000Z`);
const kst = (date: Date) => { const shifted = new Date(date.getTime() + 9 * 3_600_000).toISOString(); return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) }; };
const hasText = (entry: MeetingMinuteEntryRow) => Boolean(entry.content || entry.remark || entry.plannedSchedule);

const detailInclude = {
  creator: { select: { name: true } },
  project: { select: { vendorPm: true, customerName: true } },
  attendees: { orderBy: { sortOrder: "asc" } },
  entries: { orderBy: [{ section: "asc" }, { sortOrder: "asc" }] },
  actionItems: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.MeetingMinuteInclude;

async function canEditMinute(projectId: string, userId: string, createdBy: string) {
  return createdBy === userId || isManagerRole(await getMemberRole(projectId, userId));
}

async function validatePeople(projectId: string, data: MinuteInput) {
  const ids = [...new Set([...data.attendees.map((a) => a.userId), ...data.actionItems.map((a) => a.assigneeId)].filter((id): id is string => Boolean(id)))];
  if (!ids.length) return;
  const valid = await getPrisma().projectMember.count({ where: { projectId, userId: { in: ids } } });
  if (valid !== ids.length) throw new DomainError("INVALID_CODE", "참석자·담당자 중 프로젝트 멤버가 아닌 사용자가 있습니다.");
}

// 자식 행은 저장할 때마다 통째로 다시 쓴다 — 화면이 항상 전체 목록을 보내고, 빈 행은 저장하지 않는다.
function childRows(data: MinuteInput) {
  const entry = (section: "CONTENT" | "DECISION" | "NOTE", rows: MeetingMinuteEntryRow[]) => rows.filter(hasText).map((row, index) => ({ section, sortOrder: index, content: row.content, remark: row.remark, plannedSchedule: row.plannedSchedule }));
  return {
    attendees: data.attendees.map((attendee, index) => ({ side: attendee.side, userId: attendee.userId, name: attendee.name, sortOrder: index })),
    entries: [...entry("CONTENT", data.contents), ...entry("DECISION", data.decisions), ...entry("NOTE", data.notes)],
    actionItems: data.actionItems.filter((item) => item.title || item.content || item.assigneeName || item.dueDate)
      .map((item, index) => ({ id: item.id, sortOrder: index, title: item.title, content: item.content, assigneeId: item.assigneeId, assigneeName: item.assigneeName, dueDate: item.dueDate ? dateValue(item.dueDate) : null })),
  };
}

function minuteColumns(data: MinuteInput) {
  return { category: data.category, title: data.title, meetingDate: dateValue(data.meetingDate), sessions: data.sessions, location: data.location, authorName: data.authorName };
}

export type MeetingMinuteListFilters = { q?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number };

export async function listMeetingMinutes(projectId: string, filters: MeetingMinuteListFilters = {}) {
  const q = filters.q?.trim();
  const where: Prisma.MeetingMinuteWhereInput = {
    projectId, archivedAt: null,
    ...(filters.dateFrom || filters.dateTo ? { meetingDate: { ...(filters.dateFrom ? { gte: dateValue(filters.dateFrom) } : {}), ...(filters.dateTo ? { lte: dateValue(filters.dateTo) } : {}) } } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }, { authorName: { contains: q, mode: "insensitive" } }, { location: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const prisma = getPrisma();
  const total = await prisma.meetingMinute.count({ where });
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 20));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const rows = await prisma.meetingMinute.findMany({
    where, orderBy: [{ meetingDate: "desc" }, { seq: "desc" }], skip: (page - 1) * pageSize, take: pageSize,
    select: { id: true, displayId: true, category: true, title: true, meetingDate: true, sessions: true, location: true, authorName: true, updatedAt: true, _count: { select: { actionItems: true } } },
  });
  return {
    rows: rows.map((row) => ({ id: row.id, displayId: row.displayId, category: row.category, title: row.title, meetingDate: isoDate(row.meetingDate), sessions: row.sessions as MeetingSession[], location: row.location, authorName: row.authorName, actionItemCount: row._count.actionItems, updatedAt: row.updatedAt.toISOString() })),
    total, page, pageSize, totalPages,
  };
}
export type MeetingMinuteListResult = Awaited<ReturnType<typeof listMeetingMinutes>>;

export async function getMeetingMinute(projectId: string, id: string, viewerUserId: string): Promise<MeetingMinuteDetail | null> {
  const row = await getPrisma().meetingMinute.findUnique({ where: { id }, include: detailInclude });
  if (!row || row.projectId !== projectId || row.archivedAt) return null;
  const entries = (section: "CONTENT" | "DECISION" | "NOTE") => row.entries.filter((entry) => entry.section === section).map((entry) => ({ content: entry.content, remark: entry.remark, plannedSchedule: entry.plannedSchedule }));
  return {
    id: row.id, displayId: row.displayId, category: row.category, title: row.title, meetingDate: isoDate(row.meetingDate), sessions: row.sessions as MeetingSession[], location: row.location, authorName: row.authorName,
    attendees: row.attendees.map((a) => ({ side: a.side, userId: a.userId, name: a.name })),
    contents: entries("CONTENT"), decisions: entries("DECISION"), notes: entries("NOTE"),
    actionItems: row.actionItems.map((item) => ({ id: item.id, status: item.status, title: item.title, content: item.content, assigneeId: item.assigneeId, assigneeName: item.assigneeName, dueDate: item.dueDate ? isoDate(item.dueDate) : "" })),
    createdBy: row.createdBy, creatorName: row.creator.name, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), version: row.version,
    canEdit: await canEditMinute(projectId, viewerUserId, row.createdBy),
    signature: { pmName: row.project.vendorPm, customerName: row.project.customerName },
  };
}

export async function createMeetingMinute(projectId: string, userId: string, input: unknown) {
  const data = createMeetingMinuteSchema.parse(input);
  await validatePeople(projectId, data);
  const children = childRows(data);
  const minute = await getPrisma().$transaction(async (tx) => {
    const sequence = await tx.meetingMinuteSequence.upsert({ where: { projectId }, create: { projectId, value: 1 }, update: { value: { increment: 1 } } });
    return tx.meetingMinute.create({ data: {
      ...minuteColumns(data), projectId, seq: sequence.value, displayId: `MM-${String(sequence.value).padStart(4, "0")}`, createdBy: userId, updatedBy: userId,
      attendees: { createMany: { data: children.attendees } }, entries: { createMany: { data: children.entries } }, actionItems: { createMany: { data: children.actionItems.map(({ id: _id, ...item }) => item) } },
    } });
  });
  await writeAuditLog(projectId, userId, "MEETING_MINUTE_INSERT", "meeting_minutes", minute.id, null, { displayId: minute.displayId, ...data });
  return { id: minute.id, displayId: minute.displayId };
}

async function loadEditable(projectId: string, userId: string, id: string, version: number) {
  const current = await getPrisma().meetingMinute.findUnique({ where: { id } });
  if (!current || current.projectId !== projectId || current.archivedAt) throw new DomainError("NOT_FOUND", "회의록을 찾을 수 없습니다.");
  if (!(await canEditMinute(projectId, userId, current.createdBy))) throw new DomainError("FORBIDDEN", "등록자 또는 운영자 이상만 수정할 수 있습니다.");
  if (current.version !== version) throw new DomainError("VERSION_CONFLICT", "다른 사용자가 먼저 수정했습니다. 다시 확인해 주세요.");
  return current;
}

export async function updateMeetingMinute(projectId: string, userId: string, id: string, input: unknown) {
  const data = updateMeetingMinuteSchema.parse(input);
  await loadEditable(projectId, userId, id, data.version);
  await validatePeople(projectId, data);
  const before = await getMeetingMinute(projectId, id, userId);
  const children = childRows(data);
  // Action Item은 id로 기존 행을 유지·갱신하고(진행상태·이력 보존), 화면에서 빠진 행만 삭제, id가 없거나 이 회의록 것이 아니면 새로 만든다.
  const existingIds = new Set((await getPrisma().meetingMinuteActionItem.findMany({ where: { minuteId: id }, select: { id: true } })).map((row) => row.id));
  const kept = children.actionItems.filter((item): item is typeof item & { id: string } => Boolean(item.id && existingIds.has(item.id)));
  const added = children.actionItems.filter((item) => !(item.id && existingIds.has(item.id))).map(({ id: _id, ...item }) => item);
  const updated = await getPrisma().meetingMinute.update({ where: { id }, data: {
    ...minuteColumns(data), updatedBy: userId, version: { increment: 1 },
    attendees: { deleteMany: {}, createMany: { data: children.attendees } },
    entries: { deleteMany: {}, createMany: { data: children.entries } },
    actionItems: {
      deleteMany: { id: { notIn: kept.map((item) => item.id) } },
      update: kept.map(({ id: itemId, ...item }) => ({ where: { id: itemId }, data: item })),
      createMany: { data: added },
    },
  } });
  await writeAuditLog(projectId, userId, "MEETING_MINUTE_UPDATE", "meeting_minutes", id, before, data);
  return { id, version: updated.version };
}

export async function archiveMeetingMinute(projectId: string, userId: string, id: string, input: unknown) {
  const data = archiveMeetingMinuteSchema.parse(input);
  const current = await loadEditable(projectId, userId, id, data.version);
  await getPrisma().meetingMinute.update({ where: { id }, data: { archivedAt: new Date(), updatedBy: userId, version: { increment: 1 } } });
  await writeAuditLog(projectId, userId, "MEETING_MINUTE_ARCHIVE", "meeting_minutes", id, null, { displayId: current.displayId, archived: true });
  return { id };
}

// 캘린더 일정(반복 회차 id "master::YYYY-MM-DD" 포함)이나 회의실 예약에서 작성을 시작하면 일시·장소·안건·참석자를 채운다.
// 참석자는 누가 발주사인지 알 수 없어 수행사로 넣고, 작성자가 화면에서 옮긴다.
export async function getMeetingMinuteDraft(projectId: string, userId: string, source: { calendarEventId?: string; reservationId?: string }): Promise<MeetingMinuteDraft> {
  const authorName = (await actorNameOf(userId)) ?? "";
  const today = kst(new Date()).date;
  const empty: MeetingMinuteDraft = { category: "", title: "", meetingDate: today, sessions: [{ start: "09:00", end: "10:00" }], location: "", authorName, attendees: [], contents: [], decisions: [], notes: [], actionItems: [] };
  if (source.calendarEventId) {
    const event = await getCalendarEvent(projectId, source.calendarEventId, userId);
    if (!event) return empty;
    const memberIds = new Set((await getPrisma().projectMember.findMany({ where: { projectId }, select: { userId: true } })).map((m) => m.userId));
    return {
      ...empty, title: event.title, meetingDate: event.date, location: event.location,
      sessions: event.allDay || !event.startTime || event.startTime >= event.endTime ? empty.sessions : [{ start: event.startTime, end: event.endTime }],
      attendees: event.assignees.map((person) => ({ side: "VENDOR" as const, userId: memberIds.has(person.id) ? person.id : null, name: person.name })),
    };
  }
  if (source.reservationId) {
    const reservation = await getPrisma().meetingReservation.findUnique({ where: { id: source.reservationId }, include: { room: true, user: { select: { id: true, name: true } }, attendees: { include: { user: { select: { id: true, name: true } } } } } });
    if (!reservation || reservation.projectId !== projectId) return empty;
    const start = kst(reservation.startAt), end = kst(reservation.endAt);
    const people = [{ id: reservation.user.id as string | null, name: reservation.user.name }, ...reservation.attendees.map((a) => (a.user ? { id: a.user.id as string | null, name: a.user.name } : { id: null, name: a.guestName ?? "" }))].filter((p) => p.name);
    const unique = [...new Map(people.map((p) => [p.id ?? `guest:${p.name}`, p])).values()];
    return {
      ...empty, title: reservation.purpose, meetingDate: start.date, location: reservation.room.name,
      sessions: start.time < end.time ? [{ start: start.time, end: end.time }] : empty.sessions,
      attendees: unique.map((p) => ({ side: "VENDOR" as const, userId: p.id, name: p.name })),
    };
  }
  return empty;
}
