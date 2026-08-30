export const DEFAULT_MENU_ITEMS = [
  { key: "portfolio", label: "통합 현황" },
  { key: "management-tasks", label: "관리업무" },
  { key: "wbs", label: "WBS" },
  { key: "pmo-daily", label: "PMO Daily" },
  { key: "work-logs", label: "업무일지" },
  { key: "calendar", label: "캘린더" },
  { key: "meetrooms", label: "회의실" },
  { key: "items", label: "이슈 관리" },
  { key: "requirements", label: "요구사항관리" },
  { key: "announcements", label: "공지사항" },
  { key: "weekly-reports", label: "위클리리포트" },
  { key: "weekly-progress", label: "주간실적" },
  { key: "staff-changes", label: "인력변동" },
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
