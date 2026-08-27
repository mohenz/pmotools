export const WORK_LOG_STATUSES = [
  { value: "IN_PROGRESS", label: "진행중" },
  { value: "COMPLETED", label: "완료" },
] as const;

export type WorkLogStatusValue = (typeof WORK_LOG_STATUSES)[number]["value"];

export function canViewWorkLog(input: { viewerUserId: string; assigneeId: string; groupLeaderId: string | null; manager: boolean }) {
  return input.viewerUserId === input.assigneeId || input.manager || input.viewerUserId === input.groupLeaderId;
}

export function workLogStatusLabel(value: string) {
  return WORK_LOG_STATUSES.find((status) => status.value === value)?.label ?? value;
}
