import { describe, expect, it } from "vitest";
import { SESSION_IDLE_TIMEOUT_MS, SESSION_MAX_AGE_SECONDS } from "./session";

describe("session domain constants", () => {
  it("defines 1 hour session max age in seconds", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(3600);
    expect(SESSION_MAX_AGE_SECONDS).toBe(60 * 60);
  });

  it("defines 1 hour idle timeout in milliseconds matching max age", () => {
    expect(SESSION_IDLE_TIMEOUT_MS).toBe(3_600_000);
    expect(SESSION_IDLE_TIMEOUT_MS).toBe(SESSION_MAX_AGE_SECONDS * 1000);
  });
});
