import { describe, expect, it } from "vitest";
import { calendarInvitationContent, calendarInvitationPayload, parseCalendarInvitationPayload } from "@/lib/domain/calendar-invitations";

describe("calendar invitations", () => {
  const event = {
    id: "2aec676a-6df6-4115-830f-67d260d0e070",
    title: "프로젝트 정기회의",
    description: "주간 진행상황 공유",
    startAt: new Date("2026-08-19T06:00:00.000Z"),
    endAt: new Date("2026-08-19T07:00:00.000Z"),
    allDay: false,
    location: "대회의실",
    recurrenceRule: null,
  };

  it("일정 스냅샷을 초청 payload로 변환한다", () => {
    expect(calendarInvitationPayload(event)).toEqual({
      eventId: event.id,
      title: event.title,
      description: event.description,
      startAt: "2026-08-19T06:00:00.000Z",
      endAt: "2026-08-19T07:00:00.000Z",
      allDay: false,
      location: event.location,
      isRecurring: false,
    });
  });

  it("유효한 payload만 읽고 쪽지 내용을 만든다", () => {
    const payload = calendarInvitationPayload(event);
    expect(parseCalendarInvitationPayload(payload)).toEqual(payload);
    expect(parseCalendarInvitationPayload({ title: "누락" })).toBeNull();
    expect(calendarInvitationContent(payload)).toContain("[일정 초청] 프로젝트 정기회의");
  });
});
