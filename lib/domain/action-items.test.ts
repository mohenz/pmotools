import { describe, expect, it } from "vitest";
import { actionItemStatusLabel, canManageActionItem } from "@/lib/domain/action-items";

describe("canManageActionItem", () => {
  const base = { viewerUserId: "u1", assigneeId: "u2", groupLeaderId: "u3", isPmPmo: false, isManager: false };

  it("관리자·운영자는 항상 관리할 수 있다", () => {
    expect(canManageActionItem({ ...base, isManager: true })).toBe(true);
  });

  it("PM/PMO는 관리할 수 있다", () => {
    expect(canManageActionItem({ ...base, isPmPmo: true })).toBe(true);
  });

  it("업무그룹 리더는 관리할 수 있다", () => {
    expect(canManageActionItem({ ...base, viewerUserId: "u3" })).toBe(true);
  });

  it("담당자 본인은 관리할 수 있다", () => {
    expect(canManageActionItem({ ...base, viewerUserId: "u2" })).toBe(true);
  });

  it("그 외 제3자는 관리할 수 없다", () => {
    expect(canManageActionItem(base)).toBe(false);
  });
});

describe("actionItemStatusLabel", () => {
  it("상태값을 한글 라벨로 변환한다", () => {
    expect(actionItemStatusLabel("IDENTIFIED")).toBe("식별");
    expect(actionItemStatusLabel("DELAYED")).toBe("지연");
    expect(actionItemStatusLabel("ISSUE")).toBe("이슈");
  });

  it("알 수 없는 값은 그대로 반환한다", () => {
    expect(actionItemStatusLabel("UNKNOWN")).toBe("UNKNOWN");
  });
});
