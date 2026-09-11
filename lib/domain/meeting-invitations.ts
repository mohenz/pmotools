import { z } from "zod";

const meetingInvitationPayloadSchema = z.object({
  reservationId: z.string().uuid(),
  roomName: z.string(),
  purpose: z.string(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  organizerName: z.string(),
});

export type MeetingInvitationPayload = z.infer<typeof meetingInvitationPayloadSchema>;

export function meetingInvitationPayload(input: {
  id: string;
  roomName: string;
  purpose: string;
  startAt: Date;
  endAt: Date;
  organizerName: string;
}): MeetingInvitationPayload {
  return {
    reservationId: input.id,
    roomName: input.roomName,
    purpose: input.purpose,
    startAt: input.startAt.toISOString(),
    endAt: input.endAt.toISOString(),
    organizerName: input.organizerName,
  };
}

export function parseMeetingInvitationPayload(value: unknown): MeetingInvitationPayload | null {
  const parsed = meetingInvitationPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function meetingInvitationContent(payload: MeetingInvitationPayload) {
  const lines = [
    `[회의실 예약 초청] ${payload.roomName}`,
    `시작: ${payload.startAt}`,
    `종료: ${payload.endAt}`,
    `주최자: ${payload.organizerName}`,
  ];
  if (payload.purpose) lines.push(`목적: ${payload.purpose}`);
  return lines.join("\n");
}
