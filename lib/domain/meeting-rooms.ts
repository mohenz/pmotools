export const MEETING_DAY_START = 9 * 60;
export const MEETING_DAY_END = 19 * 60;
export const MEETING_SLOT_MINUTES = 30;
export const MEETING_MAX_MINUTES = 4 * 60;

export type RecurringPatternInput =
  | { patternType: "DAILY"; patternDetail: Record<string, never> }
  | { patternType: "WEEKLY"; patternDetail: { daysOfWeek: number[] } }
  | { patternType: "MONTHLY"; patternDetail: { dayOfMonth: number } };

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function enumerateRecurringDates(periodStart: string, periodEnd: string, pattern: RecurringPatternInput) {
  const start = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(`${periodEnd}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return [];
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    const isoDay = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
    const matches = pattern.patternType === "DAILY"
      || (pattern.patternType === "WEEKLY" && pattern.patternDetail.daysOfWeek.includes(isoDay))
      || (pattern.patternType === "MONTHLY" && cursor.getUTCDate() === pattern.patternDetail.dayOfMonth);
    if (matches) dates.push(dateKey(cursor));
  }
  return dates;
}

export function seoulDateTime(date: string, minutes: number) {
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return new Date(`${date}T${hour}:${minute}:00+09:00`);
}

export function minutesInSeoul(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(value.hour) * 60 + Number(value.minute);
}

export function validateMeetingTime(startAt: Date, endAt: Date, now = new Date()) {
  const duration = (endAt.getTime() - startAt.getTime()) / 60_000;
  const startMinutes = minutesInSeoul(startAt), endMinutes = minutesInSeoul(endAt);
  if (startAt < now) return "과거 시간에는 예약할 수 없습니다.";
  if (duration <= 0) return "종료 시간은 시작 시간보다 늦어야 합니다.";
  if (duration > MEETING_MAX_MINUTES) return "예약은 최대 4시간까지 가능합니다.";
  if (startMinutes < MEETING_DAY_START || endMinutes > MEETING_DAY_END) return "예약 가능 시간은 09:00~19:00입니다.";
  if (startMinutes % MEETING_SLOT_MINUTES || endMinutes % MEETING_SLOT_MINUTES) return "예약은 30분 단위로 선택해 주세요.";
  return null;
}
