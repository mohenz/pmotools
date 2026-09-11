import "server-only";

import { z } from "zod";
import { getPrisma } from "@/lib/server/db-pg";
import { parseMeetingInvitationPayload, type MeetingInvitationPayload } from "@/lib/domain/meeting-invitations";

export type MeetingInvitationNotice = {
  messageId: string;
  senderName: string;
  senderUserId: string;
  meetingReservationId: string | null;
  createdAt: string;
  invitation: MeetingInvitationPayload;
};

export async function listUnreadMeetingInvitations(userId: string): Promise<MeetingInvitationNotice[]> {
  const messages = await getPrisma().message.findMany({
    where: { receiverId: userId, messageType: "MEETING_INVITATION", isRead: false },
    include: { sender: { select: { name: true, userId: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return messages.flatMap((message) => {
    const invitation = parseMeetingInvitationPayload(message.systemPayload);
    return invitation ? [{
      messageId: message.id,
      senderName: message.sender.name,
      senderUserId: message.sender.userId,
      meetingReservationId: message.meetingReservationId,
      createdAt: message.createdAt.toISOString(),
      invitation,
    }] : [];
  });
}

const acknowledgeSchema = z.object({ messageIds: z.array(z.string().uuid()).min(1).max(50) });

export async function acknowledgeMeetingInvitations(userId: string, input: unknown) {
  const { messageIds } = acknowledgeSchema.parse(input);
  const result = await getPrisma().message.updateMany({
    where: { id: { in: messageIds }, receiverId: userId, messageType: "MEETING_INVITATION" },
    data: { isRead: true },
  });
  return { count: result.count };
}
