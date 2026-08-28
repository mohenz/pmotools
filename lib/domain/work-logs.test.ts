import { describe, expect, it } from "vitest";
import { canDeleteWorkLog, canViewWorkLog } from "./work-logs";

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

describe("canDeleteWorkLog", () => {
  const base = { viewerUserId: "viewer", assigneeId: "writer", groupLeaderId: "leader", manager: false };

  it("allows the author, manager, and work-group leader to delete logically", () => {
    expect(canDeleteWorkLog({ ...base, viewerUserId: "writer" })).toBe(true);
    expect(canDeleteWorkLog({ ...base, manager: true })).toBe(true);
    expect(canDeleteWorkLog({ ...base, viewerUserId: "leader" })).toBe(true);
  });

  it("rejects an unrelated user", () => {
    expect(canDeleteWorkLog(base)).toBe(false);
  });
});
