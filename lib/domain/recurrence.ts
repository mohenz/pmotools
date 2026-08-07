import { RRule } from "rrule";

export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type RecurrenceInput = { freq: RecurrenceFreq; endType: "never" | "until" | "count"; until?: string; count?: number };

const FREQ_MAP: Record<RecurrenceFreq, number> = { DAILY: RRule.DAILY, WEEKLY: RRule.WEEKLY, MONTHLY: RRule.MONTHLY, YEARLY: RRule.YEARLY };

export function buildRecurrenceRule(input: RecurrenceInput): string {
  const options: ConstructorParameters<typeof RRule>[0] = { freq: FREQ_MAP[input.freq] };
  if (input.endType === "until" && input.until) options.until = new Date(`${input.until}T23:59:59.000Z`);
  if (input.endType === "count" && input.count) options.count = input.count;
  return new RRule(options).toString().replace(/^DTSTART[^\n]*\n/, "").replace(/^RRULE:/, "");
}

export function expandOccurrences(recurrenceRule: string, dtstart: Date, rangeFrom: Date, rangeTo: Date): Date[] {
  const options = RRule.parseString(recurrenceRule);
  const rule = new RRule({ ...options, dtstart });
  return rule.between(rangeFrom, rangeTo, true);
}

const FREQ_LABEL: Record<number, string> = { [RRule.DAILY]: "매일", [RRule.WEEKLY]: "매주", [RRule.MONTHLY]: "매월", [RRule.YEARLY]: "매년" };

export function describeRecurrence(recurrenceRule: string): string {
  try {
    const options = RRule.parseString(recurrenceRule);
    const freqLabel = FREQ_LABEL[options.freq ?? RRule.WEEKLY] ?? "반복";
    if (options.count) return `${freqLabel} · ${options.count}회`;
    if (options.until) return `${freqLabel} · ${options.until.toISOString().slice(0, 10)}까지`;
    return `${freqLabel} 반복`;
  } catch {
    return "반복 일정";
  }
}
