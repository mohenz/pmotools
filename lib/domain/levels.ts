export const probabilities = [
  { value: "high", label: "상", weight: 3 },
  { value: "medium", label: "중", weight: 2 },
  { value: "low", label: "하", weight: 1 },
] as const;

export const impacts = probabilities;

export type Probability = "low" | "medium" | "high";
export type Impact = Probability;

export function probabilityLabel(value: string) {
  return probabilities.find((probability) => probability.value === value)?.label ?? value;
}
