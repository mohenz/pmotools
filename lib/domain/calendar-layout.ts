export const CALENDAR_START_MINUTES = 9 * 60;
export const CALENDAR_END_MINUTES = 18 * 60;
export const CALENDAR_SLOT_MINUTES = 30;
export const CALENDAR_ROW_HEIGHT = 36;

export function calendarDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function calendarTodayKey(now: Date = new Date()) {
  return calendarDateKey(now);
}

export function calendarDayDifference(dateKey: string, baseDateKey: string) {
  const dayNumber = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / 86_400_000;
  };
  return dayNumber(dateKey) - dayNumber(baseDateKey);
}

function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function calendarTimePlacement(startTime: string, durationMinutes: number) {
  const rawStart = minutes(startTime);
  const visibleStart = Math.min(Math.max(rawStart, CALENDAR_START_MINUTES), CALENDAR_END_MINUTES - CALENDAR_SLOT_MINUTES);
  const slot = Math.floor(visibleStart / CALENDAR_SLOT_MINUTES) * CALENDAR_SLOT_MINUTES;
  const visibleEnd = Math.min(Math.max(rawStart + Math.max(durationMinutes, CALENDAR_SLOT_MINUTES), visibleStart + CALENDAR_SLOT_MINUTES), CALENDAR_END_MINUTES);
  const pixelsPerMinute = CALENDAR_ROW_HEIGHT / CALENDAR_SLOT_MINUTES;
  return {
    slot,
    offsetPx: (visibleStart - slot) * pixelsPerMinute,
    heightPx: Math.max(CALENDAR_ROW_HEIGHT, (visibleEnd - visibleStart) * pixelsPerMinute),
  };
}
