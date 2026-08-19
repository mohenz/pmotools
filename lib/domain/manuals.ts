export const MANUALS = [
  { slug: "weekly-report", title: "위클리리포트", description: "관리자 생성·확정·삭제와 사용자 작성·조회 절차", file: "/manuals/weekly-report.html" },
  { slug: "announcements", title: "공지사항", description: "공지사항 조회와 관리자 등록·수정·게시 절차", file: "/manuals/announcements.html" },
  { slug: "calendar", title: "캘린더", description: "일정 조회·등록·반복 일정·검색·엑셀 사용 절차", file: "/manuals/calendar.html" },
  { slug: "meeting-rooms", title: "회의실", description: "회의실 조회·예약·취소와 관리자 운영 절차", file: "/manuals/meeting-rooms.html" },
] as const;

export function getManual(slug: string) {
  return MANUALS.find((manual) => manual.slug === slug);
}
