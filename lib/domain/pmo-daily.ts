import { isWbsItemDelayed } from "./wbs";

export const PMO_DELAYED_TASK_STATUSES = [
  { value: "IDENTIFIED", label: "식별" },
  { value: "ACTION_IN_PROGRESS", label: "조치중" },
  { value: "NORMALIZED", label: "정상화" },
  { value: "CLOSED", label: "종료" },
] as const;

export function scheduleProgress(planned: number, actual: number) {
  return planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0;
}

export function delayedTaskCount(planned: number, actual: number) {
  return Math.max(0, planned - actual);
}

export function taskDelayRate(planned: number, actual: number) {
  return Math.max(0, planned - actual);
}

export function delayedTaskRate(delayed: number, total: number) {
  return total > 0 ? Math.round((delayed / total) * 100) : 0;
}

export function overallProgress(completed: number, total: number, actual: number) {
  return total > 0 ? Math.round((completed / total) * 100) : actual;
}

export function delayDays(plannedEndDate: string | null, reportDate: string, closed: boolean) {
  if (!plannedEndDate || closed) return 0;
  const day = 86_400_000;
  return Math.max(0, Math.floor((Date.parse(`${reportDate}T00:00:00Z`) - Date.parse(`${plannedEndDate}T00:00:00Z`)) / day));
}

// PMO Daily 대시보드 — "오늘의 TASK" 상태 분류. 지연 판정은 WBS 목록과 같은 규칙(isWbsItemDelayed)을 쓰되,
// 서버 UTC 날짜가 아니라 호출부가 넘긴 KST 기준일(today)로 판정한다.
export type DailyTaskState = "done" | "delayed" | "in_progress" | "waiting";
export type DailyTaskInput = { startDate: string | null; dueDate: string | null; actualStartDate: string | null; actualDueDate: string | null };

export function dailyTaskState(today: string, item: DailyTaskInput): DailyTaskState {
  if (item.actualDueDate) return "done";
  if (isWbsItemDelayed(today, { plannedStart: item.startDate, actualStart: item.actualStartDate, plannedDue: item.dueDate, actualDue: item.actualDueDate })) return "delayed";
  if (item.actualStartDate || (item.startDate !== null && item.startDate <= today)) return "in_progress";
  return "waiting";
}

// 어제/내일을 달력일이 아닌 영업일(주말·휴일 제외)로 이동한다 — 월요일의 "어제"는 금요일이다.
export function shiftBusinessDay(date: string, direction: 1 | -1, holidays: Set<string> = new Set()) {
  let cursor = Date.parse(`${date}T00:00:00Z`);
  for (let guard = 0; guard < 30; guard += 1) {
    cursor += direction * 86_400_000;
    const day = new Date(cursor), key = day.toISOString().slice(0, 10);
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6 && !holidays.has(key)) return key;
  }
  return new Date(cursor).toISOString().slice(0, 10);
}
