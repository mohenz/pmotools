import { describe, expect, it } from "vitest";
import { canViewAllWbs, hasPmPmoAccess } from "@/lib/domain/job-access";

describe("hasPmPmoAccess", () => {
  it.each(["PM", "PMO", " pm ", "pmo"])("%s 직무를 허용한다", (jobTitle) => {
    expect(hasPmPmoAccess(jobTitle)).toBe(true);
  });

  it.each([null, undefined, "", "PL", "개발"])("%s 직무를 허용하지 않는다", (jobTitle) => {
    expect(hasPmPmoAccess(jobTitle)).toBe(false);
  });

  it.each([null, undefined, "", "PL", "개발"])("직무가 %s여도 슈퍼관리자면 허용한다", (jobTitle) => {
    expect(hasPmPmoAccess(jobTitle, "SUPER_ADMIN")).toBe(true);
  });

  it("슈퍼관리자가 아니면 여전히 직무 기준을 따른다", () => {
    expect(hasPmPmoAccess("개발", "ADMIN")).toBe(false);
    expect(hasPmPmoAccess("PM", "MEMBER")).toBe(true);
  });
});

describe("canViewAllWbs", () => {
  it.each(["ADMIN", "OPERATOR", "SUPER_ADMIN"])("%s는 전체 WBS를 볼 수 있다", (role) => {
    expect(canViewAllWbs(role)).toBe(true);
  });

  it.each(["MEMBER", null, undefined, "", "PM"])("%s는 전체 WBS를 볼 수 없다(본인 담당만)", (role) => {
    expect(canViewAllWbs(role)).toBe(false);
  });
});
