// 공지사항 작업 알림(배포·점검 안내, 2026-10-01 결정) — 프로젝트별 공지사항을 확장해 로그인 후 팝업으로 보여 준다.
//   표시 기간: 안내 시작 시각 ~ 작업 종료 시각, 팝업은 "오늘 하루 보지 않기"(브라우저별, 한국 날짜 기준)로 그날만 숨김.
// 화면과 서버가 함께 쓰므로 순수 함수로만 둔다.

export const WORK_NOTICE_IMPACTS = [
  { value: "OUTAGE", label: "접속 중단", tone: "band-red" },
  { value: "PARTIAL", label: "일부 기능 제한", tone: "band-yellow" },
  { value: "NONE", label: "영향 없음", tone: "" },
] as const;
export type WorkNoticeImpact = (typeof WORK_NOTICE_IMPACTS)[number]["value"];

export const workImpactLabel = (value: string | null | undefined) => WORK_NOTICE_IMPACTS.find((impact) => impact.value === value)?.label ?? "";
export const workImpactTone = (value: string | null | undefined) => WORK_NOTICE_IMPACTS.find((impact) => impact.value === value)?.tone ?? "";

export type WorkNoticePhase = "BEFORE_NOTICE" | "SCHEDULED" | "IN_PROGRESS" | "ENDED";

/** 지금 시각 기준 단계 — 안내 전 / 예정(안내 시작~작업 시작) / 작업 중 / 종료. 시각은 ISO 문자열 또는 Date. */
export function workNoticePhase(now: Date, noticeStartAt: string | Date, workStartAt: string | Date, workEndAt: string | Date): WorkNoticePhase {
  const t = now.getTime();
  if (t < new Date(noticeStartAt).getTime()) return "BEFORE_NOTICE";
  if (t < new Date(workStartAt).getTime()) return "SCHEDULED";
  if (t < new Date(workEndAt).getTime()) return "IN_PROGRESS";
  return "ENDED";
}

export const WORK_PHASE_LABEL: Record<WorkNoticePhase, string> = { BEFORE_NOTICE: "안내 전", SCHEDULED: "예정", IN_PROGRESS: "작업 중", ENDED: "종료" };

/** 등록값 검증 — 세 시각 필수, 안내 시작 ≤ 작업 시작 < 작업 종료. 오류 문구 또는 null. */
export function validateWorkNoticeTimes(noticeStartAt: Date | null, workStartAt: Date | null, workEndAt: Date | null) {
  if (!noticeStartAt || !workStartAt || !workEndAt) return "작업 알림은 안내 시작·작업 시작·작업 종료 시각을 모두 입력해 주세요.";
  if (noticeStartAt.getTime() > workStartAt.getTime()) return "안내 시작 시각은 작업 시작 시각보다 늦을 수 없습니다.";
  if (workStartAt.getTime() >= workEndAt.getTime()) return "작업 종료 시각은 작업 시작 시각보다 늦어야 합니다.";
  return null;
}

/** 한국 날짜(YYYY-MM-DD) — "오늘 하루 보지 않기" 기준일. */
export function koreaDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export const workNoticeHideKey = (id: string) => `pmotools-work-notice-hide:${id}`;

/** 저장된 숨김 날짜가 오늘이면 숨김. 다른 날이거나 없으면 표시. */
export const isHiddenToday = (storedDate: string | null | undefined, today: string) => storedDate === today;

/** "2026-10-02 (금) 20:00 ~ 20:10" / 날짜가 다르면 "… ~ 10-03 (토) 02:00" — 한국 시간. */
export function formatWorkPeriod(startAt: string | Date, endAt: string | Date) {
  const parts = (value: string | Date) => {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(new Date(value));
    const get = (type: string) => f.find((part) => part.type === type)?.value ?? "";
    const weekday = { Sun: "일", Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토" }[get("weekday")] ?? "";
    return { date: `${get("year")}-${get("month")}-${get("day")}`, md: `${get("month")}-${get("day")}`, weekday, time: `${get("hour")}:${get("minute")}` };
  };
  const s = parts(startAt), e = parts(endAt);
  return s.date === e.date ? `${s.date} (${s.weekday}) ${s.time} ~ ${e.time}` : `${s.date} (${s.weekday}) ${s.time} ~ ${e.md} (${e.weekday}) ${e.time}`;
}

/** datetime-local 입력값(한국 시간 "YYYY-MM-DDTHH:mm") → Date. 빈 값·잘못된 값은 null. */
export function parseKoreaDateTime(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date/ISO → datetime-local 입력값(한국 시간). */
export function toKoreaDateTimeInput(value: string | Date | null | undefined) {
  if (!value) return "";
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: string) => f.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
