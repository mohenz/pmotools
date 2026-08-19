export const DEFAULT_MENU_ITEMS = [
  { key: "portfolio", label: "통합 현황" },
  { key: "management-tasks", label: "프로젝트통합모니터링" },
  { key: "calendar", label: "캘린더" },
  { key: "meetrooms", label: "회의실" },
  { key: "items", label: "이슈 관리" },
  { key: "requirements", label: "요구사항관리" },
  { key: "announcements", label: "공지사항" },
  { key: "weekly-reports", label: "위클리리포트" },
  { key: "weekly-progress", label: "주간실적" },
  { key: "staff-changes", label: "인력변동" },
  { key: "messages", label: "쪽지" },
  { key: "manuals", label: "매뉴얼" },
] as const;

export type MenuPreferenceRow = { key: string; label: string; visibleAdmin: boolean; visibleOperator: boolean; visibleMember: boolean; sortOrder: number };

export function isMenuVisibleForRole(pref: MenuPreferenceRow, role: "ADMIN" | "OPERATOR" | "MEMBER") {
  if (role === "ADMIN") return pref.visibleAdmin;
  if (role === "OPERATOR") return pref.visibleOperator;
  return pref.visibleMember;
}
