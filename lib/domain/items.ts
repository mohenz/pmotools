export const categories = [
  { value: "schedule", label: "일정" },
  { value: "cost", label: "비용" },
  { value: "quality", label: "품질" },
  { value: "organization", label: "조직/정치" },
  { value: "contract", label: "계약" },
  { value: "reputation", label: "대외 평판" },
] as const;

export const probabilities = [
  { value: "high", label: "상", weight: 3 },
  { value: "medium", label: "중", weight: 2 },
  { value: "low", label: "하", weight: 1 },
] as const;

export const impacts = probabilities;

export const statusLabels = {
  registered: "등록",
  in_progress: "진행중",
  resolved: "해결",
  on_hold: "보류",
} as const;

export const escalationLabels = {
  pm: "PM 레벨",
  department_head: "본부장 레벨",
  c_level: "C-Level 레벨",
} as const;

export type ItemKind = "issue" | "risk";
export type Probability = "low" | "medium" | "high";
export type Impact = Probability;
export type EscalationLevel = keyof typeof escalationLabels;
export type ItemStatus = keyof typeof statusLabels;

export function riskScore(kind: ItemKind, probability: Probability, impact: Impact) {
  const probabilityScore = kind === "issue" ? 3 : probabilities.find((item) => item.value === probability)!.weight;
  const impactScore = impacts.find((item) => item.value === impact)!.weight;
  return probabilityScore * impactScore;
}

export function suggestEscalation(kind: ItemKind, probability: Probability, impact: Impact): EscalationLevel {
  const score = riskScore(kind, probability, impact);
  if (score >= 7) return "c_level";
  if (score >= 4) return "department_head";
  return "pm";
}

export function categoryLabel(value: string) {
  return categories.find((category) => category.value === value)?.label ?? value;
}

export function probabilityLabel(value: string) {
  return probabilities.find((probability) => probability.value === value)?.label ?? value;
}
