"use client";

import type { ElementType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { CalendarIcon, DashboardIcon, DocumentIcon, FileIcon, GanttIcon, IssueAlertIcon, MeetingRoomIcon, MessageIcon, NotificationIcon, PerformanceIcon, ProgressIcon, ReportIcon, RequestIcon, TaskIcon, TeamIcon } from "@/components/icons/PmoIcons";
import { isMenuVisibleForRole, type MenuPreferenceRow } from "@/lib/domain/menu-preferences";
import { hasPmPmoAccess } from "@/lib/domain/job-access";

const TOOL_ICONS: Record<string, ElementType> = { portfolio: DashboardIcon, "management-tasks": PerformanceIcon, wbs: GanttIcon, "pmo-daily": TaskIcon, "work-logs": DocumentIcon, calendar: CalendarIcon, meetrooms: MeetingRoomIcon, issues: IssueAlertIcon, requirements: RequestIcon, announcements: NotificationIcon, "weekly-reports": ReportIcon, "weekly-progress": ProgressIcon, "staff-changes": TeamIcon, messages: MessageIcon, manuals: FileIcon };
const TOOL_HREF: Record<string, string> = { portfolio: "/portfolio", "management-tasks": "/management-tasks", wbs: "/wbs", "pmo-daily": "/pmo-daily", "work-logs": "/work-logs", calendar: "/calendar", meetrooms: "/meetrooms", issues: "/issues", requirements: "/requirements", announcements: "/announcements", "weekly-reports": "/weekly-reports", "weekly-progress": "/weekly-progress", "staff-changes": "/staff-changes", messages: "/messages", manuals: "/manuals" };
const TOOL_LABEL: Record<string, string> = { portfolio: "통합 현황", "management-tasks": "관리업무", wbs: "WBS", "pmo-daily": "PMO Daily", "work-logs": "업무일지", calendar: "캘린더", meetrooms: "회의실", issues: "이슈 관리", requirements: "요구사항관리", announcements: "공지사항", "weekly-reports": "위클리리포트", "weekly-progress": "주간실적", "staff-changes": "인력변동", messages: "초청", manuals: "메뉴얼" };

export function AppNavigation({ area, menuPrefs = [], canManageWorkLogs = false }: { area: "sidebar" | "workspace"; menuPrefs?: MenuPreferenceRow[]; canManageWorkLogs?: boolean }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "MEMBER";
  const hasRestrictedToolAccess = hasPmPmoAccess(session?.user?.jobTitle, role);
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin = isSuperAdmin || role === "ADMIN";
  const isManager = isAdmin || role === "OPERATOR";
  const settingsActive = pathname.startsWith("/settings") || pathname.startsWith("/project-settings") || pathname.startsWith("/weeks") || pathname.startsWith("/activity-logs");
  const toolActive = (key: string, href: string) => {
    if (key === "issues") return pathname.startsWith("/issues");
    if (key === "management-tasks") return pathname.startsWith("/management-tasks") || pathname.startsWith("/action-items");
    return pathname.startsWith(href);
  };
  const menuLabels = new Map(menuPrefs.map((item) => [item.key, item.label]));
  const tools = Object.keys(TOOL_HREF).map((key) => ({ key, href: TOOL_HREF[key], icon: TOOL_ICONS[key], label: menuLabels.get(key) ?? TOOL_LABEL[key], active: toolActive(key, TOOL_HREF[key]) }));

  if (area === "sidebar") {
    const sidebarTools = menuPrefs.filter((m) => m.key !== "messages" && isMenuVisibleForRole(m, role as "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "MEMBER") && (!["issues", "pmo-daily"].includes(m.key) || hasRestrictedToolAccess)).map((m) => ({ key: m.key, href: TOOL_HREF[m.key], icon: TOOL_ICONS[m.key], label: m.label, active: toolActive(m.key, TOOL_HREF[m.key]) }));
    return <>
      <div className="sidebar-tools top-tools">
        <span className="sidebar-label">TOOLS</span>
        <nav className="tool-nav top-tool-nav" aria-label="프로젝트 관리 도구">
          {sidebarTools.map((tool) => <Link className={tool.active ? "active" : ""} aria-current={tool.active ? "page" : undefined} href={tool.href} key={tool.key}>
            <span className="tool-mark"><tool.icon aria-hidden="true" /></span><span><strong>{tool.label}</strong></span>
          </Link>)}
        </nav>
      </div>
    </>;
  }

  if (settingsActive) {
    const settingsTabs = [
      { href: "/settings/profile", label: "내 정보", active: pathname.startsWith("/settings/profile") },
      ...(isManager ? [
        { href: "/project-settings", label: "프로젝트정보 설정", active: pathname.startsWith("/project-settings") },
        { href: "/weeks", label: "프로젝트 주차", active: pathname.startsWith("/weeks") },
        { href: "/settings/weekly-reports", label: "위클리리포트 관리", active: pathname.startsWith("/settings/weekly-reports") },
        { href: "/settings/common-codes", label: "공통코드 설정", active: pathname.startsWith("/settings/common-codes") },
        { href: "/settings/meeting-rooms", label: "회의실 관리", active: pathname.startsWith("/settings/meeting-rooms") },
        { href: "/settings/recurring-meetings", label: "정기예약 승인", active: pathname.startsWith("/settings/recurring-meetings") },
        { href: "/settings/menu", label: "메뉴 설정", active: pathname.startsWith("/settings/menu") },
        { href: "/settings/portfolio-panels", label: "포트폴리오 패널 설정", active: pathname.startsWith("/settings/portfolio-panels") },
      ] : []),
      ...(isAdmin ? [
        { href: "/settings/users", label: "사용자 관리", active: pathname.startsWith("/settings/users") },
        { href: "/settings/groups", label: "그룹 관리", active: pathname.startsWith("/settings/groups") },
        { href: "/activity-logs", label: "활동 내역", active: pathname.startsWith("/activity-logs") },
      ] : []),
      { href: "/settings/system", label: "시스템 설정", active: pathname.startsWith("/settings/system") },
    ];
    return <div className="workspace-nav settings-workspace-nav"><strong className="workspace-tool-name">설정</strong><nav className="tool-tabs" aria-label="설정 기능">{settingsTabs.map((tab)=><Link className={tab.active?"active":""} aria-current={tab.active?"page":undefined} href={tab.href} key={tab.href}>{tab.label}</Link>)}</nav></div>;
  }

  const currentTool = tools.find((tool) => tool.active);
  if (currentTool && currentTool.key !== "issues") {
    const moduleTabs: Record<string, {href:string;label:string}[]> = {
      "/portfolio": [{href:"/portfolio",label:"프로젝트 현황"},{href:"/calendar",label:"캘린더"}],
      "/management-tasks": [...(hasRestrictedToolAccess?[{href:"/management-tasks/dashboard",label:"대시보드"}]:[]),{href:"/management-tasks/new",label:"관리업무항목 등록"},{href:"/management-tasks",label:"전체 목록"},...(hasRestrictedToolAccess?[{href:"/action-items",label:"액션아이템목록조회"}]:[])],
      "/wbs": [{href:"/wbs",label:"전체 목록"},{href:"/wbs/new",label:"WBS 항목 등록"},{href:"/wbs/stats",label:"통계"},{href:"/wbs/group-stats",label:"업무그룹별 통계"},{href:"/wbs/weekly-stats",label:"주간 통계"},{href:"/wbs/manage",label:"데이터 관리"},{href:"/manuals/wbs",label:"사용 메뉴얼"}],
      "/pmo-daily": [{href:"/pmo-daily",label:"일자별 목록"},{href:"/pmo-daily/new",label:"신규 작성"},{href:"/calendar",label:"일정관리"}],
      "/work-logs": [{href:"/work-logs",label:"업무일지 목록"},{href:"/work-logs/new",label:"업무일지 작성"},...(canManageWorkLogs?[{href:"/work-logs/manage",label:"업무일지 관리"}]:[]),{href:"/manuals/work-logs",label:"사용 메뉴얼"}],
      "/weekly-reports": [{href:"/weekly-reports",label:"리포트 목록"}],
      "/weekly-progress": [{href:"/weekly-progress",label:"실적 입력·조회"},...(isManager?[{href:"/portfolio",label:"공정률 현황"}]:[]),{href:"/api/v1/work-export?type=progress",label:"Excel용 CSV"}],
      "/staff-changes": [{href:"/staff-changes",label:"투입·철수 관리"},{href:"/api/v1/work-export?type=staff",label:"Excel용 CSV"}],
      "/calendar": [{href:"/calendar",label:"캘린더"},{href:"/calendar/milestones",label:"주요 이벤트"}],
      "/meetrooms": [{href:"/meetrooms",label:"예약·관리"}],
      "/messages": [{href:"/messages",label:"초청함"}],
      "/requirements": [{href:"/requirements",label:"요구사항정의서"},{href:"/requirements/statistics",label:"요구사항통계"},...(isManager?[{href:"/requirements/changes",label:"요구사항변경관리"},{href:"/requirements/excel",label:"엑셀 관리"},{href:"/manuals/requirements-excel",label:"사용 메뉴얼"}]:[])],
      "/announcements": [{href:"/announcements",label:"공지사항 조회"},...(isManager?[{href:"/announcements/new",label:"공지사항 등록"}]:[])],
      "/manuals": [{href:"/manuals",label:"전체 메뉴얼"},{href:"/manuals/pmo-daily",label:"PMO Daily"},{href:"/manuals/work-logs",label:"업무일지"},{href:"/manuals/weekly-report",label:"위클리리포트"},{href:"/manuals/announcements",label:"공지사항"},{href:"/manuals/calendar",label:"캘린더"},{href:"/manuals/meeting-rooms",label:"회의실"},{href:"/manuals/wbs",label:"WBS"},{href:"/manuals/requirements-excel",label:"요구사항관리 엑셀관리"}],
    };
    return <div className="workspace-nav"><strong className="workspace-tool-name">{currentTool.label}</strong><nav className="tool-tabs" aria-label={`${currentTool.label} 기능`}>{moduleTabs[currentTool.href].map((tab)=><Link className={pathname===tab.href?"active":""} href={tab.href} key={tab.href}>{tab.label}</Link>)}</nav><Link className="mobile-global-link" href="/settings/system">설정</Link></div>;
  }

  if (currentTool?.key !== "issues") return null;

  const tabs = [
    { href: "/issues/new", label: "이슈 등록", active: pathname === "/issues/new" },
    { href: "/issues", label: "전체 목록", active: pathname === "/issues" || (pathname.startsWith("/issues/") && pathname !== "/issues/new") },
  ];

  return <div className="workspace-nav">
    <strong className="workspace-tool-name">{menuLabels.get("issues") ?? TOOL_LABEL.issues}</strong>
    <nav className="tool-tabs" aria-label="이슈관리 기능">
      {tabs.map((tab) => <Link className={tab.active ? "active" : ""} aria-current={tab.active ? "page" : undefined} href={tab.href} key={tab.href}>{tab.label}</Link>)}
    </nav>
    <Link className="mobile-global-link" href="/settings/system">설정</Link>
  </div>;
}
