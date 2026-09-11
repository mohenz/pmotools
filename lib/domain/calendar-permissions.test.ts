import { describe, expect, it } from "vitest";
import { canManageCalendarEvent } from "@/lib/domain/calendar-permissions";

describe("canManageCalendarEvent", () => {
  it("일정 등록자에게만 수정 권한을 부여한다", () => {
    expect(canManageCalendarEvent("owner-id", "owner-id")).toBe(true);
    expect(canManageCalendarEvent("owner-id", "another-user-id")).toBe(false);
  });

  it("로그인 사용자가 없으면 수정 권한을 부여하지 않는다", () => {
    expect(canManageCalendarEvent("owner-id", null)).toBe(false);
    expect(canManageCalendarEvent("owner-id", undefined)).toBe(false);
  });
});
