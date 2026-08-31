import type { SVGProps } from "react";

// PMOTOOLS 전용 아이콘 세트(D:\Work\PMOTOOLS_auto_light_dark_SVG_20_24\24px)를 인라인 컴포넌트로 옮긴 것.
// 원본은 라이트/다크 색상을 <style>의 prefers-color-scheme 미디어쿼리로 전환하지만, 이 앱은 OS 설정이 아니라
// [data-theme] 속성으로 테마를 직접 제어하므로(ThemeSelector) 미디어쿼리 대신 currentColor를 써서
// 앱의 기존 테마 색상(및 lucide-react 아이콘)과 동일하게 동작하도록 바꿨다. 포인트색(#FF8A00)은 원본처럼 고정.
type IconProps = SVGProps<SVGSVGElement>;
const wrap = { xmlns: "http://www.w3.org/2000/svg" as const, width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 2 };
const ACCENT = "#FF8A00";

export function DashboardIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" stroke={ACCENT} />
    <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" />
  </svg>;
}

export function GanttIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <path d="M4 4v16" stroke="currentColor" />
    <path d="M7 7h7v3H7zM10 12h8v3h-8z" stroke="currentColor" />
    <path d="M13 17h7v3h-7z" stroke={ACCENT} />
  </svg>;
}

export function TaskIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" />
    <path d="M9 4V2h6v2" stroke="currentColor" />
    <path d="M8 9l1.5 1.5L12 8M8 14l1.5 1.5L12 13" stroke={ACCENT} />
    <path d="M14 9h2.5M14 14h2.5" stroke="currentColor" />
  </svg>;
}

export function DocumentIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <path d="M6 3h8l4 4v14H6z" stroke="currentColor" />
    <path d="M14 3v5h5" stroke="currentColor" />
    <path d="M9 12h6M9 16h6" stroke={ACCENT} />
  </svg>;
}

export function CalendarIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" />
    <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" />
    <path d="M7 14h.01M12 14h.01M17 14h.01M7 18h.01M12 18h.01" stroke={ACCENT} />
  </svg>;
}

export function RequestIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <path d="M4 8h16v12H4zM7 8V5h10v3" stroke="currentColor" />
    <path d="M9 13h6" stroke={ACCENT} />
  </svg>;
}

export function NotificationIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 20h4" stroke="currentColor" />
    <circle cx="18" cy="5" r="1.5" stroke={ACCENT} />
  </svg>;
}

export function ReportIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <path d="M12 12V4a8 8 0 1 1-8 8h8z" stroke="currentColor" />
    <path d="M14 4.3a8 8 0 0 1 5.7 5.7H14z" stroke={ACCENT} />
  </svg>;
}

export function ProgressIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" />
    <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" stroke={ACCENT} />
  </svg>;
}

export function TeamIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <circle cx="9" cy="8" r="3" stroke="currentColor" />
    <circle cx="16" cy="9" r="2.5" stroke={ACCENT} />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0M13 20a4.5 4.5 0 0 1 7.5-3.3" stroke="currentColor" />
  </svg>;
}

export function MessageIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <path d="M4 6h16v12H4zM4 8l8 6 8-6" stroke="currentColor" />
    <circle cx="18" cy="5" r="1.5" stroke={ACCENT} />
  </svg>;
}

export function FileIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <path d="M5 4h6l2 2h6v14H5z" stroke="currentColor" />
    <path d="M13 6h5" stroke={ACCENT} />
  </svg>;
}

export function PerformanceIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <path d="M4 19V5M4 19h16" stroke="currentColor" />
    <path d="m7 15 4-4 3 2 4-5" stroke={ACCENT} />
  </svg>;
}

// D:\Work\pmotools_meeting_issue_icons(회의실예약/이슈관리 전용 세트)에서 가져온 아이콘.
export function MeetingRoomIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <path d="M5 4h10v16H5zM15 7h4v13" stroke="currentColor" />
    <circle cx="12" cy="12" r="1" stroke={ACCENT} />
  </svg>;
}

export function IssueAlertIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" />
    <path d="M12 7v6M12 17h.01" stroke={ACCENT} />
  </svg>;
}

export function SettingsIcon(props: IconProps) {
  return <svg {...wrap} {...props}>
    <circle cx="12" cy="12" r="3" stroke="currentColor" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" stroke="currentColor" />
    <circle cx="12" cy="12" r="1" stroke={ACCENT} />
  </svg>;
}
