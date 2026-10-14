export const DEFAULT_MENU_ITEMS = [
  { key: "portfolio", label: "통합 현황" },
  { key: "management-tasks", label: "관리업무" },
  { key: "wbs", label: "WBS" },
  { key: "pmo-daily", label: "PMO Daily" },
  { key: "work-logs", label: "WBS상세내용" },
  { key: "calendar", label: "캘린더" },
  { key: "meetrooms", label: "회의실" },
  { key: "meeting-minutes", label: "회의록" },
  { key: "issues", label: "이슈 관리" },
  { key: "requirements", label: "요구사항관리" },
  // 다중 프로젝트 메뉴 — 원본(WBS·WBS상세내용·요구사항관리)과 화면·API·서버 로직을 분리한 복사본(2026-09-29)
  { key: "wbs2", label: "WBS2" },
  { key: "work-logs2", label: "WBS상세내용2" },
  { key: "requirements2", label: "요구사항관리2" },
  { key: "announcements", label: "공지사항" },
  { key: "weekly-reports", label: "위클리리포트" },
  // 주간실적(weekly-progress)·인력변동(staff-changes)은 사이드바 상위 메뉴에서 제외(2026-09-29 사용자 요청).
  // 화면·데이터는 그대로 두며 주소 직접 접근과 캘린더의 실적 일정 링크로는 계속 열린다.
  { key: "messages", label: "초청" },
  { key: "manuals", label: "메뉴얼" },
] as const;

export type MenuPreferenceRow = { key: string; label: string; visibleAdmin: boolean; visibleOperator: boolean; visibleMember: boolean; sortOrder: number };

// 슈퍼관리자는 프로젝트 관리자가 설정한 메뉴 노출 설정(visibleAdmin 등)과 무관하게 항상 모든 메뉴에 접근할 수 있어야 한다.
export function isMenuVisibleForRole(pref: MenuPreferenceRow, role: "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "MEMBER") {
  if (role === "SUPER_ADMIN") return true;
  if (role === "ADMIN") return pref.visibleAdmin;
  if (role === "OPERATOR") return pref.visibleOperator;
  return pref.visibleMember;
}
