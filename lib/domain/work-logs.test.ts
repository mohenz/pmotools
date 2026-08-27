import { describe, expect, it } from "vitest";
import { canViewWorkLog } from "./work-logs";

describe("canViewWorkLog", () => {
  const base = { viewerUserId: "viewer", assigneeId: "writer", groupLeaderId: "leader", manager: false };

  it("allows the author to view their own work log", () => {
    expect(canViewWorkLog({ ...base, viewerUserId: "writer" })).toBe(true);
  });

  it("allows a manager to view any work log", () => {
    expect(canViewWorkLog({ ...base, manager: true })).toBe(true);
  });

  it("allows the work-group leader to view the group's work log", () => {
    expect(canViewWorkLog({ ...base, viewerUserId: "leader" })).toBe(true);
  });

  it("rejects an unrelated user", () => {
    expect(canViewWorkLog(base)).toBe(false);
  });
});
