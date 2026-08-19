import { describe, expect, it } from "vitest";
import { hasPmPmoAccess } from "@/lib/domain/job-access";

describe("hasPmPmoAccess", () => {
  it.each(["PM", "PMO", " pm ", "pmo"])("%s 직무를 허용한다", (jobTitle) => {
    expect(hasPmPmoAccess(jobTitle)).toBe(true);
  });

  it.each([null, undefined, "", "PL", "개발"])("%s 직무를 허용하지 않는다", (jobTitle) => {
    expect(hasPmPmoAccess(jobTitle)).toBe(false);
  });
});
