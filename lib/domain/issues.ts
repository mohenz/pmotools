export const issueStatuses = [
  { value: "OPEN", label: "발생" },
  { value: "IN_PROGRESS", label: "진행" },
  { value: "CLOSED", label: "종결" },
] as const;

export type IssueStatusValue = (typeof issueStatuses)[number]["value"];

export function issueStatusLabel(value: string) {
  return issueStatuses.find((status) => status.value === value)?.label ?? value;
}
