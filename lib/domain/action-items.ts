export const ACTION_ITEM_STATUSES = [
  { value: "IDENTIFIED", label: "식별" },
  { value: "IN_PROGRESS", label: "진행" },
  { value: "DELAYED", label: "지연" },
  { value: "ISSUE", label: "이슈" },
  { value: "CLOSED", label: "종료" },
] as const;

export type ActionItemStatus = (typeof ACTION_ITEM_STATUSES)[number]["value"];

export function actionItemStatusLabel(value: string) {
  return ACTION_ITEM_STATUSES.find((status) => status.value === value)?.label ?? value;
}

export function canManageActionItem(input: { viewerUserId: string; assigneeId: string; groupLeaderId: string | null; isPmPmo: boolean; isManager: boolean }) {
  return input.isManager || input.isPmPmo || input.viewerUserId === input.groupLeaderId || input.viewerUserId === input.assigneeId;
}
