import "server-only";

import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { assertManager, getMemberRole, isManagerRole } from "@/lib/server/permissions";

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(30000),
  audience: z.enum(["ALL", "MANAGERS"]).default("ALL"),
  isImportant: z.boolean().default(false),
  showOnDashboard: z.boolean().default(false),
  dashboardVisibleTo: z.string().trim().nullable().optional(),
  publishedAt: z.string().trim().optional(),
  expiresAt: z.string().trim().nullable().optional(),
});

function optionalDate(value: string | null | undefined, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+09:00`);
  if (Number.isNaN(date.getTime())) throw new DomainError("INVALID_CODE", "날짜를 확인해 주세요.");
  return date;
}

function toRow(row: { id: string; title: string; audience: "ALL" | "MANAGERS"; isImportant: boolean; showOnDashboard: boolean; dashboardVisibleTo: Date | null; publishedAt: Date; expiresAt: Date | null; viewCount: number; createdAt: Date; updatedAt: Date; author: { name: string } }) {
  return { ...row, authorName: row.author.name, publishedAt: row.publishedAt.toISOString(), expiresAt: row.expiresAt?.toISOString() ?? null, dashboardVisibleTo: row.dashboardVisibleTo?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), author: undefined };
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

export async function listDashboardAnnouncements(projectId: string, userId: string) {
  const role = await getMemberRole(projectId, userId);
  const now = new Date();
  const today = new Date(new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(now) + "T00:00:00+09:00");
  const rows = await getPrisma().announcement.findMany({
    where: { projectId, deletedAt: null, showOnDashboard: true, publishedAt: { lte: now }, OR: [{ dashboardVisibleTo: null }, { dashboardVisibleTo: { gte: today } }], ...(isManagerRole(role) ? {} : { audience: "ALL" }) },
    select: { id: true, title: true, isImportant: true }, orderBy: [{ isImportant: "desc" }, { publishedAt: "desc" }], take: 5,
  });
  return rows;
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
