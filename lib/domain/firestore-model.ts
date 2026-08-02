export const DEFAULT_FIRESTORE_DATABASE_ID = "projectmgmtdb";
export const DEFAULT_PROJECT_ID = "20000000-0000-4000-8000-000000000001";
export const DEFAULT_USER_ID = "10000000-0000-4000-8000-000000000001";

export const FIRESTORE_COLLECTIONS = [
  "projects", "profiles", "members", "commonCodeGroups", "commonCodes", "items", "itemEvents",
  "auditLogs", "weeks", "weeklyReports", "weeklyProgress", "staffChanges", "calendarEvents", "meta",
] as const;

export const COMMON_CODE_GROUP_IDS = {
  category: "70000000-0000-4000-8000-000000000001",
  track: "70000000-0000-4000-8000-000000000002",
  escalation: "70000000-0000-4000-8000-000000000003",
} as const;

export const FIRESTORE_SEED_CODES = [
  ["50000000-0000-4000-8000-000000000001", COMMON_CODE_GROUP_IDS.category, "category", "schedule", "일정", 1, null],
  ["50000000-0000-4000-8000-000000000002", COMMON_CODE_GROUP_IDS.category, "category", "cost", "비용", 2, null],
  ["50000000-0000-4000-8000-000000000003", COMMON_CODE_GROUP_IDS.category, "category", "quality", "품질", 3, null],
  ["50000000-0000-4000-8000-000000000004", COMMON_CODE_GROUP_IDS.category, "category", "organization", "조직/정치", 4, null],
  ["50000000-0000-4000-8000-000000000005", COMMON_CODE_GROUP_IDS.category, "category", "contract", "계약", 5, null],
  ["50000000-0000-4000-8000-000000000006", COMMON_CODE_GROUP_IDS.category, "category", "reputation", "대외 평판", 6, null],
  ["30000000-0000-4000-8000-000000000001", COMMON_CODE_GROUP_IDS.track, "track", "TRACK_A", "Track A", 1, null],
  ["30000000-0000-4000-8000-000000000002", COMMON_CODE_GROUP_IDS.track, "track", "TRACK_B", "Track B", 2, null],
  ["30000000-0000-4000-8000-000000000003", COMMON_CODE_GROUP_IDS.track, "track", "TRACK_C", "Track C", 3, null],
  ["30000000-0000-4000-8000-000000000004", COMMON_CODE_GROUP_IDS.track, "track", "TRACK_D", "Track D", 4, null],
  ["30000000-0000-4000-8000-000000000005", COMMON_CODE_GROUP_IDS.track, "track", "COMMON", "공통/PMO", 5, null],
  ["60000000-0000-4000-8000-000000000001", COMMON_CODE_GROUP_IDS.escalation, "escalation_level", "pm", "PM 레벨", 1, 1],
  ["60000000-0000-4000-8000-000000000002", COMMON_CODE_GROUP_IDS.escalation, "escalation_level", "department_head", "본부장 레벨", 2, 4],
  ["60000000-0000-4000-8000-000000000003", COMMON_CODE_GROUP_IDS.escalation, "escalation_level", "c_level", "C-Level 레벨", 3, 7],
] as const;
