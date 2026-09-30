import { describe, expect, it } from "vitest";
import { actionItemOverdueDays, isActionItemOverdue, meetingActionStatusLabel, summarizeActionItems } from "./meeting-action-items";

const today = "2026-09-30";

describe("회의록 Action Item 진행상태", () => {
  it("상태 라벨은 대기·진행·보류·완료 4단계", () => {
    expect(["WAITING", "IN_PROGRESS", "ON_HOLD", "DONE"].map(meetingActionStatusLabel)).toEqual(["대기", "진행", "보류", "완료"]);
  });

  it("기한 경과: 완료예정일 < 오늘 이고 완료가 아니면(보류 포함) 경과, 당일·예정일 없음·완료는 제외", () => {
    expect(isActionItemOverdue({ status: "WAITING", dueDate: "2026-09-29" }, today)).toBe(true);
    expect(isActionItemOverdue({ status: "ON_HOLD", dueDate: "2026-09-01" }, today)).toBe(true);
    expect(isActionItemOverdue({ status: "IN_PROGRESS", dueDate: today }, today)).toBe(false);
    expect(isActionItemOverdue({ status: "DONE", dueDate: "2026-09-01" }, today)).toBe(false);
    expect(isActionItemOverdue({ status: "WAITING", dueDate: null }, today)).toBe(false);
    expect(actionItemOverdueDays({ status: "WAITING", dueDate: "2026-09-27" }, today)).toBe(3);
    expect(actionItemOverdueDays({ status: "DONE", dueDate: "2026-09-27" }, today)).toBe(0);
  });

  it("요약 건수", () => {
    const summary = summarizeActionItems([
      { status: "WAITING", dueDate: "2026-09-01" }, { status: "IN_PROGRESS", dueDate: "2026-10-05" },
      { status: "ON_HOLD", dueDate: "2026-09-20" }, { status: "DONE", dueDate: "2026-09-02" }, { status: "DONE", dueDate: null },
    ], today);
    expect(summary).toEqual({ total: 5, overdue: 2, WAITING: 1, IN_PROGRESS: 1, ON_HOLD: 1, DONE: 2 });
  });
});
