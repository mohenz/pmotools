export const acceptanceLabels = {
  pending: "검토중",
  accepted: "수용",
  partially_accepted: "부분수용",
  rejected: "미수용",
  deferred: "보류",
} as const;

export const changeStatusLabels = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
} as const;

export const requirementEventLabels = {
  created: "등록",
  edited: "정보 수정",
  archived: "보관",
  change_requested: "변경요청 제출",
  change_approved: "변경요청 승인",
  change_rejected: "변경요청 반려",
} as const;

export type RequirementAcceptance = keyof typeof acceptanceLabels;
export type RequirementChangeStatus = keyof typeof changeStatusLabels;

export function acceptanceLabel(value: string) {
  return acceptanceLabels[value as RequirementAcceptance] ?? value;
}
