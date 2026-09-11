import { describe, expect, it } from "vitest";
import { issueWhere } from "./issues";

const PROJECT = "p1";
const conditions = (filters: Parameters<typeof issueWhere>[1]) => (issueWhere(PROJECT, filters).AND ?? []) as Record<string, unknown>[];

describe("issueWhere", () => {
  it("always scopes to the project and excludes archived issues", () => {
    const where = issueWhere(PROJECT, {});
    expect(where.projectId).toBe(PROJECT);
    expect(where.archivedAt).toBeNull();
    expect(where.AND).toBeUndefined();
  });

  it("ignores values that are not valid enum members", () => {
    expect(conditions({ status: "nope", importance: "nope", priority: "nope" })).toHaveLength(0);
  });

  it("passes through valid enum filters", () => {
    expect(conditions({ status: "CLOSED", importance: "high", priority: "low" })).toEqual([
      { status: "CLOSED" },
      { importance: "high" },
      { priority: "low" },
    ]);
  });

  it("filters by categoryCodeId and ownerUserId as-is", () => {
    expect(conditions({ categoryCodeId: "cat-1", ownerUserId: "user-1" })).toEqual([
      { categoryCodeId: "cat-1" },
      { ownerUserId: "user-1" },
    ]);
  });

  it("filters by escalated when explicitly set, including false", () => {
    expect(conditions({ escalated: true })).toEqual([{ escalated: true }]);
    expect(conditions({ escalated: false })).toEqual([{ escalated: false }]);
    expect(conditions({})).toHaveLength(0);
  });

  it("searches title, description and owner name case-insensitively", () => {
    expect(conditions({ q: "  결제  " })).toEqual([
      {
        OR: [
          { title: { contains: "결제", mode: "insensitive" } },
          { description: { contains: "결제", mode: "insensitive" } },
          { ownerName: { contains: "결제", mode: "insensitive" } },
        ],
      },
    ]);
  });

  it("combines multiple filters with AND", () => {
    expect(conditions({ status: "OPEN", escalated: true, q: "배포" })).toHaveLength(3);
  });
});
