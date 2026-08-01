import { describe, expect, it } from "vitest";
import { suggestEscalation } from "./items";

describe("suggestEscalation", () => {
  it("treats an issue probability as high", () => {
    expect(suggestEscalation("issue", "low", "high")).toBe("c_level");
  });

  it("maps medium risk score to department head", () => {
    expect(suggestEscalation("risk", "medium", "medium")).toBe("department_head");
  });

  it("maps low risk score to PM", () => {
    expect(suggestEscalation("risk", "low", "medium")).toBe("pm");
  });
});

