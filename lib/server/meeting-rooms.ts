import "server-only";

import { z } from "zod";
import { Prisma } from "@/lib/generated/prisma/client";
import { enumerateRecurringDates, MEETING_DAY_END, MEETING_DAY_START, MEETING_SLOT_MINUTES, seoulDateTime, validateMeetingTime, type RecurringPatternInput } from "@/lib/domain/meeting-rooms";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { assertAdmin } from "@/lib/server/permissions";

const roomSchema = z.object({
  name: z.string().trim().min(1).max(50), roomType: z.enum(["LARGE", "SMALL"]),
  capacity: z.number().int().min(1).max(200), floor: z.string().trim().max(20).nullable().optional(),
  equipment: z.array(z.string().trim().min(1).max(50)).max(20).default([]), isActive: z.boolean().optional(),
});
const reservationSchema = z.object({ roomId: z.string().uuid(), startAt: z.coerce.date(), endAt: z.coerce.date(), purpose: z.string().trim().min(1).max(500), attendeeIds: z.array(z.string().uuid()).max(50).default([]) });
const recurringSchema = z.object({
  roomId: z.string().uuid(), patternType: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).max(7).optional(), dayOfMonth: z.number().int().min(1).max(31).optional(),
  startMinutes: z.number().int(), endMinutes: z.number().int(), periodStart: z.string().date(), periodEnd: z.string().date(), purpose: z.string().trim().min(1).max(500),
});

function roomView<T extends { createdAt: Date; updatedAt: Date; deletedAt: Date | null }>(room: T) {
  return { ...room, createdAt: room.createdAt.toISOString(), updatedAt: room.updatedAt.toISOString(), deletedAt: room.deletedAt?.toISOString() ?? null };
}

export async function listMeetingRooms(projectId: string, includeArchived = false) {
  const rooms = await getPrisma().meetingRoom.findMany({ where: { projectId, ...(includeArchived ? {} : { deletedAt: null }) }, orderBy: [{ roomType: "asc" }, { name: "asc" }] });
  return rooms.map(roomView);
}

export async function createMeetingRoom(projectId: string, actorId: string, input: unknown) {
  await assertAdmin(projectId, actorId); const data = roomSchema.parse(input); const prisma = getPrisma();
  const duplicate = await prisma.meetingRoom.findFirst({ where: { projectId, name: { equals: data.name, mode: "insensitive" } } });
  if (duplicate) throw new DomainError("DUPLICATE_CODE", "같은 이름의 회의실이 이미 있습니다.");
  const room = await prisma.meetingRoom.create({ data: { projectId, name: data.name, roomType: data.roomType, capacity: data.capacity, floor: data.floor || null, equipment: data.equipment, isActive: data.isActive ?? true } });
  await writeAuditLog(projectId, actorId, "MEETING_ROOM_CREATE", "meeting_rooms", room.id, null, room);
  return roomView(room);
}

export async function updateMeetingRoom(projectId: string, actorId: string, id: string, input: unknown) {
  await assertAdmin(projectId, actorId); const data = roomSchema.parse(input); const prisma = getPrisma();
  const current = await prisma.meetingRoom.findFirst({ where: { id, projectId } });
  if (!current) throw new DomainError("NOT_FOUND", "회의실을 찾을 수 없습니다.");
  const duplicate = await prisma.meetingRoom.findFirst({ where: { projectId, id: { not: id }, name: { equals: data.name, mode: "insensitive" } } });
  if (duplicate) throw new DomainError("DUPLICATE_CODE", "같은 이름의 회의실이 이미 있습니다.");
  const updated = await prisma.meetingRoom.update({ where: { id }, data: { name: data.name, roomType: data.roomType, capacity: data.capacity, floor: data.floor || null, equipment: data.equipment, isActive: data.isActive ?? current.isActive } });
  await writeAuditLog(projectId, actorId, "MEETING_ROOM_UPDATE", "meeting_rooms", id, current, updated); return roomView(updated);
}

export async function deleteMeetingRoom(projectId: string, actorId: string, id: string) {
  await assertAdmin(projectId, actorId); const prisma = getPrisma(); const now = new Date();
  const current = await prisma.meetingRoom.findFirst({ where: { id, projectId } });
  if (!current) throw new DomainError("NOT_FOUND", "회의실을 찾을 수 없습니다.");
  const blocking = await prisma.meetingReservation.count({ where: { roomId: id, status: "CONFIRMED", startAt: { gte: now } } });
  const pending = await prisma.recurringMeetingReservation.count({ where: { roomId: id, status: "PENDING" } });
  if (blocking || pending) throw new DomainError("INVALID_STATE", "향후 예약 또는 승인 대기 신청을 먼저 처리해 주세요.");
  const history = await prisma.meetingReservation.count({ where: { roomId: id } }) + await prisma.recurringMeetingReservation.count({ where: { roomId: id } });
  if (!history) { await prisma.meetingRoom.delete({ where: { id } }); await writeAuditLog(projectId, actorId, "MEETING_ROOM_DELETE", "meeting_rooms", id, current, null); return { mode: "deleted" as const }; }
  const archived = await prisma.meetingRoom.update({ where: { id }, data: { isActive: false, deletedAt: now } });
  await writeAuditLog(projectId, actorId, "MEETING_ROOM_ARCHIVE", "meeting_rooms", id, current, archived); return { mode: "archived" as const };
}

export async function restoreMeetingRoom(projectId: string, actorId: string, id: string) {
  await assertAdmin(projectId, actorId); const prisma = getPrisma(); const current = await prisma.meetingRoom.findFirst({ where: { id, projectId } });
  if (!current) throw new DomainError("NOT_FOUND", "회의실을 찾을 수 없습니다.");
  const restored = await prisma.meetingRoom.update({ where: { id }, data: { deletedAt: null, isActive: true } });
  await writeAuditLog(projectId, actorId, "MEETING_ROOM_RESTORE", "meeting_rooms", id, current, restored); return roomView(restored);
}

export async function listMeetingReservations(projectId: string, from: Date, to: Date, userId?: string) {
  const rows = await getPrisma().meetingReservation.findMany({ where: { projectId, status: "CONFIRMED", startAt: { lt: to }, endAt: { gt: from }, ...(userId ? { userId } : {}) }, include: { room: true, user: { select: { id: true, name: true, department: true } }, attendees: { include: { user: { select: { id: true, name: true, department: true } } }, orderBy: { user: { name: "asc" } } } }, orderBy: { startAt: "asc" } });
  return rows.map((row) => ({ id: row.id, roomId: row.roomId, roomName: row.room.name, userId: row.userId, userName: row.user.name, department: row.user.department, startAt: row.startAt.toISOString(), endAt: row.endAt.toISOString(), purpose: row.purpose, recurring: !!row.recurringId, attendees: row.attendees.map((item) => item.user) }));
}

async function assertRoomAvailable(projectId: string, roomId: string) {
  const room = await getPrisma().meetingRoom.findFirst({ where: { id: roomId, projectId, isActive: true, deletedAt: null } });
  if (!room) throw new DomainError("NOT_FOUND", "사용 가능한 회의실을 찾을 수 없습니다."); return room;
}
async function assertNoConflict(tx: Prisma.TransactionClient, roomId: string, startAt: Date, endAt: Date, excludeId?: string) {
  const conflict = await tx.meetingReservation.findFirst({ where: { roomId, status: "CONFIRMED", ...(excludeId ? { id: { not: excludeId } } : {}), startAt: { lt: endAt }, endAt: { gt: startAt } } });
  if (conflict) throw new DomainError("MEETING_CONFLICT", "선택한 시간에 이미 예약이 있습니다.");
}

export async function createMeetingReservation(projectId: string, userId: string, input: unknown) {
  const data = reservationSchema.parse(input); const validation = validateMeetingTime(data.startAt, data.endAt); if (validation) throw new DomainError("INVALID_CODE", validation); await assertRoomAvailable(projectId, data.roomId);
  const attendeeIds = [...new Set(data.attendeeIds)].filter((id) => id !== userId);
  try { return await getPrisma().$transaction(async (tx) => { const validCount = await tx.projectMember.count({ where: { projectId, userId: { in: attendeeIds }, isActive: true, user: { status: "ACTIVE" } } }); if (validCount !== attendeeIds.length) throw new DomainError("INVALID_CODE", "참석자 목록에 유효하지 않은 사용자가 있습니다."); await assertNoConflict(tx, data.roomId, data.startAt, data.endAt); const row = await tx.meetingReservation.create({ data: { projectId, roomId: data.roomId, userId, startAt: data.startAt, endAt: data.endAt, purpose: data.purpose, attendees: { createMany: { data: attendeeIds.map((attendeeId) => ({ userId: attendeeId })) } } } }); await tx.meetingReservationChangeLog.create({ data: { reservationId: row.id, actorId: userId, action: "CREATE", afterStart: row.startAt, afterEnd: row.endAt } }); return row; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
  catch (error) { if (error instanceof DomainError) throw error; throw new DomainError("MEETING_CONFLICT", "동시에 다른 예약이 생성되었습니다. 시간을 다시 선택해 주세요."); }
}

async function ownedReservation(projectId: string, actorId: string, id: string, isAdmin: boolean) {
  const row = await getPrisma().meetingReservation.findFirst({ where: { id, projectId } }); if (!row) throw new DomainError("NOT_FOUND", "예약을 찾을 수 없습니다.");
  if (!isAdmin && row.userId !== actorId) throw new DomainError("FORBIDDEN", "본인 예약만 변경할 수 있습니다."); return row;
}
export async function cancelMeetingReservation(projectId: string, actorId: string, id: string, isAdmin: boolean) {
  const current = await ownedReservation(projectId, actorId, id, isAdmin); if (current.status === "CANCELLED") return current;
  return getPrisma().$transaction(async (tx) => { const row = await tx.meetingReservation.update({ where: { id }, data: { status: "CANCELLED" } }); await tx.meetingReservationChangeLog.create({ data: { reservationId: id, actorId, action: "CANCEL", beforeStart: current.startAt, beforeEnd: current.endAt } }); return row; });
}
export async function changeMeetingReservationTime(projectId: string, actorId: string, id: string, isAdmin: boolean, input: unknown) {
  const times = reservationSchema.pick({ startAt: true, endAt: true }).parse(input); const validation = validateMeetingTime(times.startAt, times.endAt); if (validation) throw new DomainError("INVALID_CODE", validation); const current = await ownedReservation(projectId, actorId, id, isAdmin); if (current.status !== "CONFIRMED") throw new DomainError("INVALID_STATE", "취소된 예약은 변경할 수 없습니다.");
  try { return await getPrisma().$transaction(async (tx) => { await assertNoConflict(tx, current.roomId, times.startAt, times.endAt, id); const action = times.endAt.getTime() - times.startAt.getTime() > current.endAt.getTime() - current.startAt.getTime() ? "EXTEND" : "SHORTEN"; const row = await tx.meetingReservation.update({ where: { id }, data: times }); await tx.meetingReservationChangeLog.create({ data: { reservationId: id, actorId, action, beforeStart: current.startAt, beforeEnd: current.endAt, afterStart: row.startAt, afterEnd: row.endAt } }); return row; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
  catch (error) { if (error instanceof DomainError) throw error; throw new DomainError("MEETING_CONFLICT", "변경하려는 시간에 다른 예약이 있습니다."); }
}

function recurringPattern(data: z.infer<typeof recurringSchema>): RecurringPatternInput {
  if (data.patternType === "WEEKLY") { if (!data.daysOfWeek?.length) throw new DomainError("INVALID_CODE", "반복 요일을 선택해 주세요."); return { patternType: "WEEKLY", patternDetail: { daysOfWeek: [...new Set(data.daysOfWeek)].sort() } }; }
  if (data.patternType === "MONTHLY") { if (!data.dayOfMonth) throw new DomainError("INVALID_CODE", "반복 일자를 선택해 주세요."); return { patternType: "MONTHLY", patternDetail: { dayOfMonth: data.dayOfMonth } }; }
  return { patternType: "DAILY", patternDetail: {} };
}
export async function createRecurringMeeting(projectId: string, userId: string, input: unknown) {
  const data = recurringSchema.parse(input), pattern = recurringPattern(data); await assertRoomAvailable(projectId, data.roomId);
  if (data.startMinutes < MEETING_DAY_START || data.endMinutes > MEETING_DAY_END || data.startMinutes >= data.endMinutes || data.startMinutes % MEETING_SLOT_MINUTES || data.endMinutes % MEETING_SLOT_MINUTES) throw new DomainError("INVALID_CODE", "반복 시간은 09:00~19:00 사이 30분 단위여야 합니다.");
  const dates = enumerateRecurringDates(data.periodStart, data.periodEnd, pattern); if (!dates.length || dates.length > 366) throw new DomainError("INVALID_CODE", "적용 기간과 반복 규칙을 확인해 주세요.");
  if ((new Date(`${data.periodEnd}T00:00:00Z`).getTime() - new Date(`${data.periodStart}T00:00:00Z`).getTime()) / 86_400_000 > 366) throw new DomainError("INVALID_CODE", "정기예약 적용 기간은 최대 1년입니다.");
  return getPrisma().recurringMeetingReservation.create({ data: { projectId, roomId: data.roomId, applicantId: userId, patternType: data.patternType, patternDetail: pattern.patternDetail, startMinutes: data.startMinutes, endMinutes: data.endMinutes, periodStart: new Date(`${data.periodStart}T00:00:00Z`), periodEnd: new Date(`${data.periodEnd}T00:00:00Z`), purpose: data.purpose } });
}
export async function listRecurringMeetings(projectId: string, userId: string, isAdmin: boolean) {
  return getPrisma().recurringMeetingReservation.findMany({ where: { projectId, ...(isAdmin ? {} : { applicantId: userId }) }, include: { room: true, applicant: { select: { name: true, department: true } } }, orderBy: { createdAt: "desc" } });
}
export async function reviewRecurringMeeting(projectId: string, actorId: string, id: string, action: "approve" | "reject", reason?: string) {
  await assertAdmin(projectId, actorId); const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM recurring_meeting_reservations WHERE id=${id} AND "projectId"=${projectId} FOR UPDATE`;
    if (!rows.length) throw new DomainError("NOT_FOUND", "정기예약 신청을 찾을 수 없습니다.");
    const request = await tx.recurringMeetingReservation.findUniqueOrThrow({ where: { id } }); if (request.status !== "PENDING") throw new DomainError("INVALID_STATE", "이미 처리된 신청입니다.");
    if (action === "reject") { if (!reason?.trim()) throw new DomainError("INVALID_CODE", "반려 사유를 입력해 주세요."); return tx.recurringMeetingReservation.update({ where: { id }, data: { status: "REJECTED", reviewedBy: actorId, reviewedAt: new Date(), rejectReason: reason.trim() } }); }
    const detail = request.patternDetail as { daysOfWeek?: number[]; dayOfMonth?: number };
    let pattern: RecurringPatternInput;
    if (request.patternType === "WEEKLY") pattern = { patternType: "WEEKLY", patternDetail: { daysOfWeek: detail.daysOfWeek ?? [] } };
    else if (request.patternType === "MONTHLY") pattern = { patternType: "MONTHLY", patternDetail: { dayOfMonth: detail.dayOfMonth ?? 0 } };
    else pattern = { patternType: "DAILY", patternDetail: {} };
    const dates = enumerateRecurringDates(request.periodStart.toISOString().slice(0, 10), request.periodEnd.toISOString().slice(0, 10), pattern);
    const instances = dates.map((date) => ({ startAt: seoulDateTime(date, request.startMinutes), endAt: seoulDateTime(date, request.endMinutes) }));
    for (const item of instances) await assertNoConflict(tx, request.roomId, item.startAt, item.endAt);
    for (const item of instances) { const row = await tx.meetingReservation.create({ data: { projectId, roomId: request.roomId, userId: request.applicantId, recurringId: id, startAt: item.startAt, endAt: item.endAt, purpose: request.purpose } }); await tx.meetingReservationChangeLog.create({ data: { reservationId: row.id, actorId, action: "CREATE", afterStart: row.startAt, afterEnd: row.endAt } }); }
    return tx.recurringMeetingReservation.update({ where: { id }, data: { status: "APPROVED", reviewedBy: actorId, reviewedAt: new Date() } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
}
