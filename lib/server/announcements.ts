import "server-only";

import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { assertManager, getMemberRole, isManagerRole } from "@/lib/server/permissions";
import { parseKoreaDateTime, validateWorkNoticeTimes } from "@/lib/domain/work-notice";

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(30000),
  audience: z.enum(["ALL", "MANAGERS"]).default("ALL"),
  isImportant: z.boolean().default(false),
  showOnDashboard: z.boolean().default(false),
  dashboardVisibleTo: z.string().trim().nullable().optional(),
  publishedAt: z.string().trim().optional(),
  expiresAt: z.string().trim().nullable().optional(),
  // 작업 알림(2026-10-01) — 시각은 한국 시간 datetime-local("YYYY-MM-DDTHH:mm")
  isWorkNotice: z.boolean().default(false),
  noticeStartAt: z.string().trim().nullable().optional(),
  workStartAt: z.string().trim().nullable().optional(),
  workEndAt: z.string().trim().nullable().optional(),
  workImpact: z.enum(["OUTAGE", "PARTIAL", "NONE"]).nullable().optional(),
});

/** 작업 알림 컬럼 — 작업 알림이 아니면 모두 비운다. 시각 순서가 맞지 않으면 오류. */
function workNoticeColumns(data: z.infer<typeof announcementSchema>) {
  if (!data.isWorkNotice) return { isWorkNotice: false, noticeStartAt: null, workStartAt: null, workEndAt: null, workImpact: null };
  const noticeStartAt = parseKoreaDateTime(data.noticeStartAt), workStartAt = parseKoreaDateTime(data.workStartAt), workEndAt = parseKoreaDateTime(data.workEndAt);
  const problem = validateWorkNoticeTimes(noticeStartAt, workStartAt, workEndAt);
  if (problem) throw new DomainError("INVALID_CODE", problem);
  return { isWorkNotice: true, noticeStartAt, workStartAt, workEndAt, workImpact: data.workImpact ?? "OUTAGE" };
}

function optionalDate(value: string | null | undefined, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+09:00`);
  if (Number.isNaN(date.getTime())) throw new DomainError("INVALID_CODE", "날짜를 확인해 주세요.");
  return date;
}

function toRow(row: { id: string; title: string; audience: "ALL" | "MANAGERS"; isImportant: boolean; showOnDashboard: boolean; dashboardVisibleTo: Date | null; publishedAt: Date; expiresAt: Date | null; viewCount: number; createdAt: Date; updatedAt: Date; author: { name: string }; isWorkNotice: boolean; noticeStartAt: Date | null; workStartAt: Date | null; workEndAt: Date | null; workImpact: "OUTAGE" | "PARTIAL" | "NONE" | null }) {
  return { ...row, authorName: row.author.name, publishedAt: row.publishedAt.toISOString(), expiresAt: row.expiresAt?.toISOString() ?? null, dashboardVisibleTo: row.dashboardVisibleTo?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), author: undefined,
    noticeStartAt: row.noticeStartAt?.toISOString() ?? null, workStartAt: row.workStartAt?.toISOString() ?? null, workEndAt: row.workEndAt?.toISOString() ?? null };
}

export type AnnouncementRow = ReturnType<typeof toRow>;
export type AnnouncementDetail = AnnouncementRow & { content: string };

export async function listAnnouncements(projectId: string, userId: string, query = "", page = 1, pageSize = 20) {
  const role = await getMemberRole(projectId, userId);
  const now = new Date();
  const today = new Date(new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(now) + "T00:00:00+09:00");
  const where = {
    projectId,
    deletedAt: null,
    publishedAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gte: today } }],
    ...(isManagerRole(role) ? {} : { audience: "ALL" as const }),
    ...(query.trim() ? { AND: [{ OR: [{ title: { contains: query.trim(), mode: "insensitive" as const } }, { content: { contains: query.trim(), mode: "insensitive" as const } }] }] } : {}),
  };
  const prisma = getPrisma();
  const total = await prisma.announcement.count({ where });
  const safeSize = Math.min(100, Math.max(10, pageSize));
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const safePage = Math.min(totalPages, Math.max(1, page));
  const rows = await prisma.announcement.findMany({ where, include: { author: { select: { name: true } } }, orderBy: [{ isImportant: "desc" }, { publishedAt: "desc" }], skip: (safePage - 1) * safeSize, take: safeSize });
  return { announcements: rows.map(toRow), total, page: safePage, pageSize: safeSize, totalPages };
}

export async function getAnnouncement(projectId: string, userId: string, id: string, incrementView = false): Promise<AnnouncementDetail | null> {
  const role = await getMemberRole(projectId, userId);
  const prisma = getPrisma();
  const row = await prisma.announcement.findUnique({ where: { id }, include: { author: { select: { name: true } } } });
  if (!row || row.projectId !== projectId || row.deletedAt || (row.audience === "MANAGERS" && !isManagerRole(role))) return null;
  if (incrementView) await prisma.announcement.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  return { ...toRow({ ...row, viewCount: row.viewCount + (incrementView ? 1 : 0) }), content: row.content };
}

export async function createAnnouncement(projectId: string, actorId: string, input: unknown) {
  await assertManager(projectId, actorId);
  const data = announcementSchema.parse(input);
  const created = await getPrisma().announcement.create({ data: {
    projectId, authorId: actorId, updatedById: actorId, title: data.title, content: data.content, audience: data.audience,
    isImportant: data.isImportant, showOnDashboard: data.showOnDashboard,
    dashboardVisibleTo: data.showOnDashboard ? optionalDate(data.dashboardVisibleTo, true) : null,
    publishedAt: optionalDate(data.publishedAt) ?? new Date(), expiresAt: optionalDate(data.expiresAt, true),
    ...workNoticeColumns(data),
  } });
  await writeAuditLog(projectId, actorId, "ANNOUNCEMENT_INSERT", "announcements", created.id, null, { title: created.title });
  return { id: created.id };
}

export async function updateAnnouncement(projectId: string, actorId: string, id: string, input: unknown) {
  await assertManager(projectId, actorId);
  const data = announcementSchema.parse(input);
  const prisma = getPrisma();
  const before = await prisma.announcement.findUnique({ where: { id } });
  if (!before || before.projectId !== projectId || before.deletedAt) throw new DomainError("NOT_FOUND", "공지사항을 찾을 수 없습니다.");
  await prisma.announcement.update({ where: { id }, data: {
    updatedById: actorId, title: data.title, content: data.content, audience: data.audience, isImportant: data.isImportant,
    showOnDashboard: data.showOnDashboard, dashboardVisibleTo: data.showOnDashboard ? optionalDate(data.dashboardVisibleTo, true) : null,
    publishedAt: optionalDate(data.publishedAt) ?? before.publishedAt, expiresAt: optionalDate(data.expiresAt, true),
    ...workNoticeColumns(data),
  } });
  await writeAuditLog(projectId, actorId, "ANNOUNCEMENT_UPDATE", "announcements", id, { title: before.title }, { title: data.title });
  return { id };
}

export async function deleteAnnouncement(projectId: string, actorId: string, id: string) {
  await assertManager(projectId, actorId);
  const prisma = getPrisma();
  const before = await prisma.announcement.findUnique({ where: { id } });
  if (!before || before.projectId !== projectId || before.deletedAt) throw new DomainError("NOT_FOUND", "공지사항을 찾을 수 없습니다.");
  await prisma.announcement.update({ where: { id }, data: { deletedAt: new Date(), updatedById: actorId } });
  await writeAuditLog(projectId, actorId, "ANNOUNCEMENT_DELETE", "announcements", id, { title: before.title }, null);
  return { id };
}

export type ActiveWorkNotice = { id: string; title: string; content: string; noticeStartAt: string; workStartAt: string; workEndAt: string; workImpact: "OUTAGE" | "PARTIAL" | "NONE" | null };

/** 로그인 후 팝업용 — 안내 시작 ≤ 지금 < 작업 종료인 작업 알림(공지 대상 권한 반영), 작업 시작이 빠른 순. */
export async function listActiveWorkNotices(projectId: string, userId: string): Promise<ActiveWorkNotice[]> {
  const role = await getMemberRole(projectId, userId);
  const now = new Date();
  const rows = await getPrisma().announcement.findMany({
    where: { projectId, deletedAt: null, isWorkNotice: true, noticeStartAt: { lte: now }, workEndAt: { gt: now }, ...(isManagerRole(role) ? {} : { audience: "ALL" as const }) },
    orderBy: { workStartAt: "asc" }, take: 5,
    select: { id: true, title: true, content: true, noticeStartAt: true, workStartAt: true, workEndAt: true, workImpact: true },
  });
  return rows.map((row) => ({ id: row.id, title: row.title, content: row.content.slice(0, 2000), noticeStartAt: row.noticeStartAt!.toISOString(), workStartAt: row.workStartAt!.toISOString(), workEndAt: row.workEndAt!.toISOString(), workImpact: row.workImpact }));
}
