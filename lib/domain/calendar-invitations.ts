import { z } from "zod";

const calendarInvitationPayloadSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean(),
  location: z.string(),
  isRecurring: z.boolean(),
});

export type CalendarInvitationPayload = z.infer<typeof calendarInvitationPayloadSchema>;

export function calendarInvitationPayload(input: {
  id: string;
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string;
  recurrenceRule: string | null;
}): CalendarInvitationPayload {
  return {
    eventId: input.id,
    title: input.title,
    description: input.description,
    startAt: input.startAt.toISOString(),
    endAt: input.endAt.toISOString(),
    allDay: input.allDay,
    location: input.location,
    isRecurring: Boolean(input.recurrenceRule),
  };
}

export function parseCalendarInvitationPayload(value: unknown): CalendarInvitationPayload | null {
  const parsed = calendarInvitationPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function calendarInvitationContent(payload: CalendarInvitationPayload) {
  const lines = [
    `[일정 초청] ${payload.title}`,
    `시작: ${payload.startAt}`,
    `종료: ${payload.endAt}`,
  ];
  if (payload.location) lines.push(`장소: ${payload.location}`);
  if (payload.description) lines.push(`내용: ${payload.description}`);
  return lines.join("\n");
}
