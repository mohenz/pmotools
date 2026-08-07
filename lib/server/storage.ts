import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { assertManager } from "@/lib/server/permissions";

const BUCKET = "event-attachments";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

let ensured = false;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function ensureBucket() {
  if (ensured) return;
  const admin = getSupabaseAdmin();
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((bucket) => bucket.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_FILE_SIZE });
  }
  ensured = true;
}

export type EventAttachmentRow = { id: string; fileName: string; fileSize: number; uploadedAt: string };

export async function listEventAttachments(eventId: string): Promise<EventAttachmentRow[]> {
  const rows = await getPrisma().eventAttachment.findMany({ where: { eventId }, orderBy: { uploadedAt: "desc" } });
  return rows.map((row) => ({ id: row.id, fileName: row.fileName, fileSize: row.fileSize, uploadedAt: row.uploadedAt.toISOString() }));
}

export async function uploadEventAttachment(projectId: string, eventId: string, userId: string, file: File) {
  await assertManager(projectId, userId);
  if (file.size > MAX_FILE_SIZE) throw new DomainError("INVALID_CODE", "파일 크기는 20MB를 초과할 수 없습니다.");
  const prisma = getPrisma();
  const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
  if (!event || event.projectId !== projectId) throw new DomainError("NOT_FOUND", "일정을 찾을 수 없습니다.");

  await ensureBucket();
  const admin = getSupabaseAdmin();
  const storagePath = `${projectId}/${eventId}/${randomUUID()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(BUCKET).upload(storagePath, buffer, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(`파일 업로드 실패: ${error.message}`);

  const attachment = await prisma.eventAttachment.create({ data: { eventId, fileName: file.name, storagePath, fileSize: file.size } });
  await writeAuditLog(projectId, userId, "EVENT_ATTACHMENT_INSERT", "event_attachments", attachment.id, null, attachment);
  return { id: attachment.id, fileName: attachment.fileName, fileSize: attachment.fileSize, uploadedAt: attachment.uploadedAt.toISOString() };
}

export async function getAttachmentDownloadUrl(projectId: string, attachmentId: string) {
  const prisma = getPrisma();
  const attachment = await prisma.eventAttachment.findUnique({ where: { id: attachmentId }, include: { event: true } });
  if (!attachment || attachment.event.projectId !== projectId) throw new DomainError("NOT_FOUND", "첨부파일을 찾을 수 없습니다.");
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(attachment.storagePath, 60, { download: attachment.fileName });
  if (error || !data) throw new Error(`다운로드 URL 생성 실패: ${error?.message}`);
  return data.signedUrl;
}

export async function deleteEventAttachment(projectId: string, attachmentId: string, userId: string) {
  await assertManager(projectId, userId);
  const prisma = getPrisma();
  const attachment = await prisma.eventAttachment.findUnique({ where: { id: attachmentId }, include: { event: true } });
  if (!attachment || attachment.event.projectId !== projectId) throw new DomainError("NOT_FOUND", "첨부파일을 찾을 수 없습니다.");
  const admin = getSupabaseAdmin();
  await admin.storage.from(BUCKET).remove([attachment.storagePath]);
  await prisma.eventAttachment.delete({ where: { id: attachmentId } });
  await writeAuditLog(projectId, userId, "EVENT_ATTACHMENT_DELETE", "event_attachments", attachmentId, attachment, null);
  return { id: attachmentId };
}
