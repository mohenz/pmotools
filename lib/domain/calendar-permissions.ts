export function canManageCalendarEvent(createdBy: string, userId: string | null | undefined) {
  return Boolean(userId && createdBy === userId);
}
