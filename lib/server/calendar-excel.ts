import "server-only";
import ExcelJS from "exceljs";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { assertManager } from "@/lib/server/permissions";
import { DomainError } from "@/lib/server/errors";
import { canManageCalendarEvent } from "@/lib/domain/calendar-permissions";
import { calendarInvitationPayload } from "@/lib/domain/calendar-invitations";
import type { CalendarEventType, Prisma, Priority } from "@/lib/generated/prisma/client";

type ParsedEventData = { title: string; description: string; eventType: CalendarEventType; startAt: string; endAt: string; allDay: boolean; location: string; priority: Priority; isMilestone: boolean; groupId: string | null };

const HEADERS = ["ID", "제목", "설명", "유형", "시작일시", "종료일시", "종일여부", "장소", "우선순위", "마일스톤여부", "업무그룹코드"] as const;
const EVENT_TYPE_LABEL: Record<string, string> = { meeting: "회의", milestone: "마일스톤", work: "업무", other: "기타" };
const EVENT_TYPE_VALUE: Record<string, string> = { 회의: "meeting", 마일스톤: "milestone", 업무: "work", 기타: "other" };
const PRIORITY_LABEL: Record<string, string> = { HIGH: "상", MEDIUM: "중", LOW: "하" };
const PRIORITY_VALUE: Record<string, string> = { 상: "HIGH", 중: "MEDIUM", 하: "LOW" };
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

function fmt(date: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())} ${p(date.getUTCHours())}:${p(date.getUTCMinutes())}`;
}
function parseDate(value: string) { return new Date(`${value.replace(" ", "T")}:00.000Z`); }

export async function exportMonthToExcel(projectId: string, month: string): Promise<Buffer> {
  const from = new Date(`${month}-01T00:00:00.000Z`);
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0, 23, 59, 59));
  const events = await getPrisma().calendarEvent.findMany({ where: { projectId, startAt: { gte: from, lte: to } }, orderBy: { startAt: "asc" } });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(month);
  sheet.addRow(HEADERS as unknown as string[]);
  sheet.getRow(1).font = { bold: true };
  for (const event of events) {
    sheet.addRow([event.id, event.title, event.description, EVENT_TYPE_LABEL[event.eventType] ?? event.eventType, fmt(event.startAt), fmt(event.endAt), event.allDay ? "Y" : "N", event.location, PRIORITY_LABEL[event.priority], event.isMilestone ? "Y" : "N", event.groupId ?? ""]);
  }
  sheet.columns.forEach((col) => { col.width = 18; });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export type ImportRowResult = { row: number; action: "create" | "update"; title: string; errors: string[] };
export type ImportReport = { rows: ImportRowResult[]; validCount: number; errorCount: number };

async function parseAndValidate(projectId: string, userId: string, buffer: Buffer): Promise<{ report: ImportReport; parsed: { row: number; id: string | null; data: ParsedEventData }[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  const prisma = getPrisma();
  const groups = await prisma.groups.findMany({ where: { projectId, groupType: "WORK_MODULE" } });
  const groupIds = new Set(groups.map((g) => g.id));
  const existingEvents = new Map((await prisma.calendarEvent.findMany({ where: { projectId }, select: { id: true, createdBy: true } })).map((event) => [event.id, event]));

  const rows: ImportRowResult[] = [];
  const parsed: { row: number; id: string | null; data: ParsedEventData }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cell = (index: number) => String(row.getCell(index).value ?? "").trim();
    const [idCell, title, description, eventTypeLabel, startAtRaw, endAtRaw, allDayRaw, location, priorityLabel, isMilestoneRaw, groupId] = HEADERS.map((_, i) => cell(i + 1));
    if (!title && !idCell) return; // skip fully blank rows
    const errors: string[] = [];
    if (!title) errors.push("제목은 필수입니다.");
    const eventType = EVENT_TYPE_VALUE[eventTypeLabel];
    if (!eventType) errors.push(`유형 값이 올바르지 않습니다(${eventTypeLabel || "빈 값"}). 회의/마일스톤/업무/기타 중 하나여야 합니다.`);
    if (!DATE_FORMAT.test(startAtRaw)) errors.push("시작일시 형식이 올바르지 않습니다 (예: 2026-08-10 09:00).");
    if (!DATE_FORMAT.test(endAtRaw)) errors.push("종료일시 형식이 올바르지 않습니다 (예: 2026-08-10 10:00).");
    if (DATE_FORMAT.test(startAtRaw) && DATE_FORMAT.test(endAtRaw) && endAtRaw < startAtRaw) errors.push("종료일시는 시작일시 이후여야 합니다.");
    const priority = PRIORITY_VALUE[priorityLabel];
    if (!priority) errors.push(`우선순위 값이 올바르지 않습니다(${priorityLabel || "빈 값"}). 상/중/하 중 하나여야 합니다.`);
    if (groupId && !groupIds.has(groupId)) errors.push(`업무그룹코드(${groupId})를 찾을 수 없습니다.`);
    if (idCell && !existingEvents.has(idCell)) errors.push(`ID(${idCell})에 해당하는 기존 일정이 없습니다. ID를 비우면 신규 등록됩니다.`);
    if (idCell && existingEvents.has(idCell) && !canManageCalendarEvent(existingEvents.get(idCell)!.createdBy, userId)) errors.push("본인이 등록한 일정만 수정할 수 있습니다.");

    rows.push({ row: rowNumber, action: idCell ? "update" : "create", title: title || "(제목 없음)", errors });
    if (!errors.length) parsed.push({
      row: rowNumber, id: idCell || null,
      data: { title, description, eventType: eventType as CalendarEventType, startAt: parseDate(startAtRaw).toISOString(), endAt: parseDate(endAtRaw).toISOString(), allDay: allDayRaw === "Y", location, priority: priority as Priority, isMilestone: isMilestoneRaw === "Y", groupId: groupId || null },
    });
  });
  const errorCount = rows.filter((r) => r.errors.length > 0).length;
  return { report: { rows, validCount: rows.length - errorCount, errorCount }, parsed };
}

export async function validateImport(projectId: string, userId: string, buffer: Buffer): Promise<ImportReport> {
  const { report } = await parseAndValidate(projectId, userId, buffer);
  return report;
}

export async function applyImport(projectId: string, userId: string, buffer: Buffer) {
  await assertManager(projectId, userId);
  const { report, parsed } = await parseAndValidate(projectId, userId, buffer);
  if (report.errorCount > 0) return { applied: 0, report };
  const prisma = getPrisma();
  let applied = 0;
  for (const item of parsed) {
    if (item.id) {
      const before = await prisma.calendarEvent.findFirst({ where: { id: item.id, projectId } });
      if (!before) throw new DomainError("NOT_FOUND", "수정할 일정을 찾을 수 없습니다.");
      if (!canManageCalendarEvent(before.createdBy, userId)) throw new DomainError("FORBIDDEN", "본인이 등록한 일정만 수정할 수 있습니다.");
      const updated = await prisma.calendarEvent.update({ where: { id: item.id }, data: { ...item.data, startAt: new Date(item.data.startAt), endAt: new Date(item.data.endAt), updatedBy: userId, version: { increment: 1 } } });
      await prisma.message.updateMany({ where: { calendarEventId: item.id, messageType: "CALENDAR_INVITATION" }, data: { systemPayload: calendarInvitationPayload(updated) as Prisma.InputJsonValue } });
      await writeAuditLog(projectId, userId, "CALENDAR_EVENTS_EXCEL_UPDATE", "calendar_events", item.id, before, updated);
    } else {
      const created = await prisma.calendarEvent.create({ data: { projectId, ...item.data, startAt: new Date(item.data.startAt), endAt: new Date(item.data.endAt), createdBy: userId } });
      await writeAuditLog(projectId, userId, "CALENDAR_EVENTS_EXCEL_INSERT", "calendar_events", created.id, null, created);
    }
    applied += 1;
  }
  return { applied, report };
}
