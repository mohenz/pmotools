export class DomainError extends Error {
  constructor(public code: "FORBIDDEN" | "NOT_FOUND" | "VERSION_CONFLICT" | "DUPLICATE_CODE" | "LAST_ACTIVE_CODE" | "INVALID_CODE" | "MEETING_CONFLICT" | "INVALID_STATE" | "INVALID_PASSWORD" | "CYCLE_DETECTED", message: string) {
    super(message);
  }
}
