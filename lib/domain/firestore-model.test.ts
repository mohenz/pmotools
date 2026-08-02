import { describe, expect, it } from "vitest";
import { COMMON_CODE_GROUP_IDS, DEFAULT_FIRESTORE_DATABASE_ID, FIRESTORE_COLLECTIONS, FIRESTORE_SEED_CODES } from "./firestore-model";

describe("Firestore application model", () => {
  it("uses the configured named database", () => {
    expect(DEFAULT_FIRESTORE_DATABASE_ID).toBe("projectmgmtdb");
  });

  it("keeps collection names unique", () => {
    expect(new Set(FIRESTORE_COLLECTIONS).size).toBe(FIRESTORE_COLLECTIONS.length);
  });

  it("keeps all common codes under a known group", () => {
    const groups = new Set(Object.values(COMMON_CODE_GROUP_IDS));
    expect(FIRESTORE_SEED_CODES.every(([, groupId]) => groups.has(groupId))).toBe(true);
  });

  it("keeps common-code identifiers unique", () => {
    const ids = FIRESTORE_SEED_CODES.map(([id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("provides every required issue category", () => {
    const categories = FIRESTORE_SEED_CODES.filter(([, , groupCode]) => groupCode === "category");
    expect(categories).toHaveLength(6);
  });

  it("provides all five project tracks", () => {
    const tracks = FIRESTORE_SEED_CODES.filter(([, , groupCode]) => groupCode === "track");
    expect(tracks.map(([, , , code]) => code)).toEqual(["TRACK_A", "TRACK_B", "TRACK_C", "TRACK_D", "COMMON"]);
  });

  it("orders escalation thresholds from PM to C-Level", () => {
    const scores = FIRESTORE_SEED_CODES.filter(([, , groupCode]) => groupCode === "escalation_level").map(([, , , , , , score]) => score);
    expect(scores).toEqual([1, 4, 7]);
  });
});
