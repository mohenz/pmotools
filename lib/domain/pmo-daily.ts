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
