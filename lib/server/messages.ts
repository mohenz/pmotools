import "server-only";
import { z } from "zod";
import { getPrisma } from "@/lib/server/db-pg";
import { encryptWithPassword, decryptWithPassword } from "@/lib/domain/crypto";
import { DomainError } from "@/lib/server/errors";
import { calendarInvitationContent, parseCalendarInvitationPayload, type CalendarInvitationPayload } from "@/lib/domain/calendar-invitations";

export type MessageSummary = { id: string; counterpartName: string; counterpartUserId: string; isRead: boolean; createdAt: string; direction: "sent" | "received"; messageType: "DIRECT" | "CALENDAR_INVITATION"; calendarEventId: string | null; calendarInvitation: CalendarInvitationPayload | null; isLegacyPasswordProtected: boolean };

function messageEncryptionKey() {
  const secret = process.env.MESSAGE_ENCRYPTION_KEY ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new DomainError("INVALID_STATE", "쪽지 암호화 키가 설정되지 않았습니다.");
  return `pmotools-message-v1:${secret}`;
}

export async function listMessages(userId: string, box: "received" | "sent"): Promise<MessageSummary[]> {
  const prisma = getPrisma();
  const messages = await prisma.message.findMany({
    where: box === "received" ? { receiverId: userId } : { senderId: userId },
    include: { sender: { select: { name: true, userId: true } }, receiver: { select: { name: true, userId: true } } },
    orderBy: { createdAt: "desc" },
  });
  return messages.map((m) => ({
    id: m.id,
    counterpartName: box === "received" ? m.sender.name : m.receiver.name,
    counterpartUserId: box === "received" ? m.sender.userId : m.receiver.userId,
    isRead: m.isRead,
    createdAt: m.createdAt.toISOString(),
    direction: box === "received" ? "received" : "sent",
    messageType: m.messageType,
    calendarEventId: m.calendarEventId,
    calendarInvitation: m.messageType === "CALENDAR_INVITATION" ? parseCalendarInvitationPayload(m.systemPayload) : null,
    isLegacyPasswordProtected: m.messageType === "DIRECT" && Boolean(m.viewPasswordHash),
  }));
}

export async function unreadMessageCount(userId: string): Promise<number> {
  return getPrisma().message.count({ where: { receiverId: userId, isRead: false } });
}

const sendSchema = z.object({ receiverUserId: z.string().trim().min(1), content: z.string().trim().min(1).max(5000) });
export async function sendMessage(senderId: string, input: unknown) {
  const data = sendSchema.parse(input);
  const prisma = getPrisma();
  const receiver = await prisma.user.findUnique({ where: { userId: data.receiverUserId } });
  if (!receiver) throw new DomainError("NOT_FOUND", "받는 사람을 찾을 수 없습니다.");
  if (receiver.id === senderId) throw new DomainError("INVALID_CODE", "본인에게는 쪽지를 보낼 수 없습니다.");
  const { contentEncrypted, contentIv } = encryptWithPassword(data.content, messageEncryptionKey());
  const message = await prisma.message.create({ data: { senderId, receiverId: receiver.id, contentEncrypted, contentIv } });
  return { id: message.id };
}

export async function viewMessage(userId: string, messageId: string, _input: unknown) {
  const prisma = getPrisma();
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || (message.receiverId !== userId && message.senderId !== userId)) throw new DomainError("NOT_FOUND", "쪽지를 찾을 수 없습니다.");
  if (message.messageType === "CALENDAR_INVITATION") {
    const invitation = parseCalendarInvitationPayload(message.systemPayload);
    if (!invitation) throw new DomainError("INVALID_STATE", "일정 초청 정보를 확인할 수 없습니다.");
    if (message.receiverId === userId && !message.isRead) await prisma.message.update({ where: { id: messageId }, data: { isRead: true } });
    return { content: calendarInvitationContent(invitation), invitation };
  }
  if (message.viewPasswordHash) throw new DomainError("INVALID_STATE", "기존 비밀번호 보호 쪽지는 자동으로 열람할 수 없습니다.");
  if (!message.contentEncrypted || !message.contentIv) throw new DomainError("INVALID_STATE", "쪽지 내용을 확인할 수 없습니다.");
  const content = decryptWithPassword(message.contentEncrypted, message.contentIv, messageEncryptionKey());
  if (content === null) throw new DomainError("INVALID_STATE", "쪽지 내용을 복호화할 수 없습니다.");
  if (message.receiverId === userId && !message.isRead) await prisma.message.update({ where: { id: messageId }, data: { isRead: true } });
  return { content };
}
