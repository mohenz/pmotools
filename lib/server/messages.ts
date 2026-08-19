import "server-only";
import { getPrisma } from "@/lib/server/db-pg";
import { decryptWithPassword } from "@/lib/domain/crypto";
import { DomainError } from "@/lib/server/errors";
import { calendarInvitationContent, parseCalendarInvitationPayload, type CalendarInvitationPayload } from "@/lib/domain/calendar-invitations";
import { meetingInvitationContent, parseMeetingInvitationPayload, type MeetingInvitationPayload } from "@/lib/domain/meeting-invitations";

export type InvitationSummary = { id: string; senderName: string; senderUserId: string; isRead: boolean; createdAt: string; messageType: "CALENDAR_INVITATION" | "MEETING_INVITATION"; calendarEventId: string | null; calendarInvitation: CalendarInvitationPayload | null; meetingReservationId: string | null; meetingInvitation: MeetingInvitationPayload | null };

function messageEncryptionKey() {
  const secret = process.env.MESSAGE_ENCRYPTION_KEY ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new DomainError("INVALID_STATE", "쪽지 암호화 키가 설정되지 않았습니다.");
  return `pmotools-message-v1:${secret}`;
}

export async function listReceivedInvitations(userId: string): Promise<InvitationSummary[]> {
  const messages = await getPrisma().message.findMany({
    where: { receiverId: userId, messageType: { in: ["CALENDAR_INVITATION", "MEETING_INVITATION"] } },
    include: { sender: { select: { name: true, userId: true } } },
    orderBy: { createdAt: "desc" },
  });
  return messages.map((m) => ({
    id: m.id,
    senderName: m.sender.name,
    senderUserId: m.sender.userId,
    isRead: m.isRead,
    createdAt: m.createdAt.toISOString(),
    messageType: m.messageType as "CALENDAR_INVITATION" | "MEETING_INVITATION",
    calendarEventId: m.calendarEventId,
    calendarInvitation: m.messageType === "CALENDAR_INVITATION" ? parseCalendarInvitationPayload(m.systemPayload) : null,
    meetingReservationId: m.meetingReservationId,
    meetingInvitation: m.messageType === "MEETING_INVITATION" ? parseMeetingInvitationPayload(m.systemPayload) : null,
  }));
}

export async function unreadMessageCount(userId: string): Promise<number> {
  return getPrisma().message.count({ where: { receiverId: userId, isRead: false } });
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
  if (message.messageType === "MEETING_INVITATION") {
    const invitation = parseMeetingInvitationPayload(message.systemPayload);
    if (!invitation) throw new DomainError("INVALID_STATE", "회의실 예약 초청 정보를 확인할 수 없습니다.");
    if (message.receiverId === userId && !message.isRead) await prisma.message.update({ where: { id: messageId }, data: { isRead: true } });
    return { content: meetingInvitationContent(invitation), invitation };
  }
  if (message.viewPasswordHash) throw new DomainError("INVALID_STATE", "기존 비밀번호 보호 쪽지는 자동으로 열람할 수 없습니다.");
  if (!message.contentEncrypted || !message.contentIv) throw new DomainError("INVALID_STATE", "쪽지 내용을 확인할 수 없습니다.");
  const content = decryptWithPassword(message.contentEncrypted, message.contentIv, messageEncryptionKey());
  if (content === null) throw new DomainError("INVALID_STATE", "쪽지 내용을 복호화할 수 없습니다.");
  if (message.receiverId === userId && !message.isRead) await prisma.message.update({ where: { id: messageId }, data: { isRead: true } });
  return { content };
}
