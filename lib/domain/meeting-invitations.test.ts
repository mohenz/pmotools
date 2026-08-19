import { describe, expect, it } from "vitest";
import { meetingInvitationContent, meetingInvitationPayload, parseMeetingInvitationPayload } from "@/lib/domain/meeting-invitations";

describe("meeting invitations", () => {
  const reservation = {
    id: "2aec676a-6df6-4115-830f-67d260d0e071",
    roomName: "대회의실",
    purpose: "주간 정기회의",
    startAt: new Date("2026-08-19T06:00:00.000Z"),
    endAt: new Date("2026-08-19T07:00:00.000Z"),
    organizerName: "홍길동",
  };

  it("예약 스냅샷을 초청 payload로 변환한다", () => {
    expect(meetingInvitationPayload(reservation)).toEqual({
      reservationId: reservation.id,
      roomName: reservation.roomName,
      purpose: reservation.purpose,
      startAt: "2026-08-19T06:00:00.000Z",
      endAt: "2026-08-19T07:00:00.000Z",
      organizerName: reservation.organizerName,
    });
  });

  it("유효한 payload만 읽고 쪽지 내용을 만든다", () => {
    const payload = meetingInvitationPayload(reservation);
    expect(parseMeetingInvitationPayload(payload)).toEqual(payload);
    expect(parseMeetingInvitationPayload({ roomName: "누락" })).toBeNull();
    expect(meetingInvitationContent(payload)).toContain("[회의실 예약 초청] 대회의실");
  });
});
