import { describe, expect, it } from "vitest";
import { effectiveProjectRole, hasAllProjectAccess } from "./project-access";

describe("프로젝트 접근 규칙", () => {
  it("슈퍼관리자·관리자는 배정 없이도 모든 프로젝트에 계정 역할로 접근", () => {
    expect(effectiveProjectRole("SUPER_ADMIN", false)).toBe("SUPER_ADMIN");
    expect(effectiveProjectRole("ADMIN", false)).toBe("ADMIN");
    expect(hasAllProjectAccess("ADMIN")).toBe(true);
    expect(hasAllProjectAccess("OPERATOR")).toBe(false);
  });

  it("운영자·사용자는 배정된 프로젝트에서만 계정 역할로 동작", () => {
    expect(effectiveProjectRole("OPERATOR", true)).toBe("OPERATOR");
    expect(effectiveProjectRole("OPERATOR", false)).toBeNull();
    expect(effectiveProjectRole("MEMBER", true)).toBe("MEMBER");
    expect(effectiveProjectRole("MEMBER", false)).toBeNull();
    expect(effectiveProjectRole(null, true)).toBeNull();
  });
});
