// 회의록 양식 고정값 — 원본 양식(EOCP_20260928_DES_상품전시 내부리뷰.pdf) 기준(2026-09-28 사용자 결정).
// 시스템 프로젝트명·코드와 다르므로 설정값이 아니라 양식 상수로 둔다.
export const MEETING_MINUTE_FILE_PREFIX = "EOCP";
export const MEETING_MINUTE_PROJECT_TITLE = "이마트 온오프 통합커머스 플랫폼 구축";

export type MeetingSession = { start: string; end: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidSession(session: MeetingSession) {
  return TIME.test(session.start) && TIME.test(session.end) && session.start < session.end;
}

/** "09:30~12:00, 13:30~15:00" — 양식의 회의 일자 표기. */
export function formatSessions(sessions: MeetingSession[]) {
  return sessions.map((session) => `${session.start}~${session.end}`).join(", ");
}

// Windows·브라우저 저장 대화상자에서 쓸 수 없는 문자만 걷어내고 공백은 원본 파일명처럼 유지한다.
const sanitize = (value: string) => value.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();

/** EOCP_20260928_DES_상품전시 내부리뷰 — {접두어}_{회의일}_{분류}_{안건}. 분류가 비면 해당 구간을 생략한다. */
export function meetingMinuteFileName(meetingDate: string, category: string, title: string) {
  return [MEETING_MINUTE_FILE_PREFIX, meetingDate.replaceAll("-", ""), sanitize(category), sanitize(title)].filter(Boolean).join("_");
}
