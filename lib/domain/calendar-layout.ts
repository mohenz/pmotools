export const CALENDAR_START_MINUTES = 9 * 60;
export const CALENDAR_END_MINUTES = 18 * 60;
export const CALENDAR_SLOT_MINUTES = 30;
export const CALENDAR_ROW_HEIGHT = 36;

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
