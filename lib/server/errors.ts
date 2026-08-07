export class DomainError extends Error {
  constructor(public code: "FORBIDDEN" | "NOT_FOUND" | "VERSION_CONFLICT" | "DUPLICATE_CODE" | "LAST_ACTIVE_CODE" | "INVALID_CODE", message: string) {
    super(message);
  }
}
