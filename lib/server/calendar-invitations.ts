import "server-only";

import { z } from "zod";
import { getPrisma } from "@/lib/server/db-pg";
import { parseCalendarInvitationPayload, type CalendarInvitationPayload } from "@/lib/domain/calendar-invitations";

export type CalendarInvitationNotice = {
  messageId: string;
  senderName: string;
  senderUserId: string;
  calendarEventId: string | null;
  createdAt: string;
  invitation: CalendarInvitationPayload;
};

export async function listUnreadCalendarInvitations(userId: string): Promise<CalendarInvitationNotice[]> {
  const messages = await getPrisma().message.findMany({
    where: { receiverId: userId, messageType: "CALENDAR_INVITATION", isRead: false },
    include: { sender: { select: { name: true, userId: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return messages.flatMap((message) => {
    const invitation = parseCalendarInvitationPayload(message.systemPayload);
    return invitation ? [{
      messageId: message.id,
      senderName: message.sender.name,
      senderUserId: message.sender.userId,
      calendarEventId: message.calendarEventId,
      createdAt: message.createdAt.toISOString(),
      invitation,
    }] : [];
  });
}

const acknowledgeSchema = z.object({ messageIds: z.array(z.string().uuid()).min(1).max(50) });

export async function acknowledgeCalendarInvitations(userId: string, input: unknown) {
  const { messageIds } = acknowledgeSchema.parse(input);
  const result = await getPrisma().message.updateMany({
    where: { id: { in: messageIds }, receiverId: userId, messageType: "CALENDAR_INVITATION" },
    data: { isRead: true },
  });
  return { count: result.count };
}
