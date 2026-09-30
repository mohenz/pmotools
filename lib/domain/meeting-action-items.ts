// 회의록 Action Item 진행상태(2026-09-30 결정) — 대기·진행·보류·완료 4단계, 프로젝트 멤버 누구나 변경.
// 기한 경과는 상태가 아니라 계산값: 완료예정일이 오늘보다 앞서고 완료가 아니면(보류 포함) 경과로 본다.
export const MEETING_ACTION_STATUSES = [
  { value: "WAITING", label: "대기", tone: "" },
  { value: "IN_PROGRESS", label: "진행", tone: "band-blue" },
  { value: "ON_HOLD", label: "보류", tone: "band-yellow" },
  { value: "DONE", label: "완료", tone: "band-green" },
] as const;

export type MeetingActionStatus = (typeof MEETING_ACTION_STATUSES)[number]["value"];
export const MEETING_ACTION_STATUS_VALUES = MEETING_ACTION_STATUSES.map((status) => status.value) as [MeetingActionStatus, ...MeetingActionStatus[]];

export function meetingActionStatusLabel(value: string) {
  return MEETING_ACTION_STATUSES.find((status) => status.value === value)?.label ?? value;
}

export function meetingActionStatusTone(value: string) {
  return MEETING_ACTION_STATUSES.find((status) => status.value === value)?.tone ?? "";
}

/** 기한 경과 — 완료예정일(YYYY-MM-DD)이 오늘보다 이전이고 완료가 아닌 항목. 완료예정일이 없으면 경과 아님. */
export function isActionItemOverdue(item: { status: string; dueDate: string | null | undefined }, today: string) {
  return Boolean(item.dueDate) && item.status !== "DONE" && (item.dueDate as string) < today;
}

/** 기한 경과 일수(달력일). 경과가 아니면 0. */
export function actionItemOverdueDays(item: { status: string; dueDate: string | null | undefined }, today: string) {
  if (!isActionItemOverdue(item, today)) return 0;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${item.dueDate}T00:00:00Z`)) / 86_400_000);
}

export type MeetingActionSummary = Record<MeetingActionStatus, number> & { total: number; overdue: number };

export function summarizeActionItems(items: { status: string; dueDate: string | null }[], today: string): MeetingActionSummary {
  const summary: MeetingActionSummary = { total: items.length, overdue: 0, WAITING: 0, IN_PROGRESS: 0, ON_HOLD: 0, DONE: 0 };
  for (const item of items) {
    if (item.status in summary) summary[item.status as MeetingActionStatus] += 1;
    if (isActionItemOverdue(item, today)) summary.overdue += 1;
  }
  return summary;
}

/** 오늘(한국 시간) YYYY-MM-DD — 기한 경과 판정 기준일. */
export function todayInKorea(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
