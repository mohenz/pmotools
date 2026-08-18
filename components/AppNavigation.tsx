"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, CalendarDays, ClipboardList, FileText, LayoutDashboard, Mail, ShieldAlert, TrendingUp, Users } from "lucide-react";
import { useUnreadMessageCount } from "@/components/UnreadMessageProvider";
import { isMenuVisibleForRole, type MenuPreferenceRow } from "@/lib/domain/menu-preferences";

const TOOL_ICONS: Record<string, typeof LayoutDashboard> = { portfolio: LayoutDashboard, calendar: CalendarDays, meetrooms: Building2, items: ShieldAlert, requirements: ClipboardList, "weekly-reports": FileText, "weekly-progress": TrendingUp, "staff-changes": Users, messages: Mail };
const TOOL_HREF: Record<string, string> = { portfolio: "/portfolio", calendar: "/calendar", meetrooms: "/meetrooms", items: "/items/dashboard", requirements: "/requirements", "weekly-reports": "/weekly-reports", "weekly-progress": "/weekly-progress", "staff-changes": "/staff-changes", messages: "/messages" };
const TOOL_SUB: Record<string, string> = { portfolio: "Portfolio", calendar: "Calendar", meetrooms: "Meeting Rooms", items: "Issue & Risk", requirements: "Requirements", "weekly-reports": "Weekly Report", "weekly-progress": "Progress", "staff-changes": "Staff", messages: "Messages" };
const TOOL_LABEL: Record<string, string> = { portfolio: "통합 현황", calendar: "캘린더", meetrooms: "회의실", items: "이슈 관리", requirements: "요구사항관리", "weekly-reports": "주간보고", "weekly-progress": "주간실적", "staff-changes": "인력변동", messages: "쪽지" };

export function AppNavigation({ area, menuPrefs = [] }: { area: "sidebar" | "workspace"; menuPrefs?: MenuPreferenceRow[] }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "MEMBER";
  const isAdmin = role === "ADMIN";
  const isManager = isAdmin || role === "OPERATOR";
  const { count: unread } = useUnreadMessageCount();
  const settingsActive = pathname.startsWith("/settings") || pathname.startsWith("/project-settings") || pathname.startsWith("/weeks") || pathname.startsWith("/activity-logs");
  const toolActive = (key: string, href: string) => key === "items" ? pathname.startsWith("/items") : pathname.startsWith(href);
  const tools = Object.keys(TOOL_HREF).map((key) => ({ key, href: TOOL_HREF[key], icon: TOOL_ICONS[key], label: TOOL_LABEL[key], sub: TOOL_SUB[key], active: toolActive(key, TOOL_HREF[key]) }));

  if (area === "sidebar") {
    const sidebarTools = menuPrefs.filter((m) => isMenuVisibleForRole(m, role as "ADMIN" | "OPERATOR" | "MEMBER")).map((m) => ({ key: m.key, href: TOOL_HREF[m.key], icon: TOOL_ICONS[m.key], label: m.label, sub: TOOL_SUB[m.key], active: toolActive(m.key, TOOL_HREF[m.key]) }));
    return <>
      <div className="sidebar-tools">
        <span className="sidebar-label">TOOLS</span>
        <nav className="tool-nav" aria-label="프로젝트 관리 도구">
          {sidebarTools.map((tool) => <Link className={tool.active ? "active" : ""} aria-current={tool.active ? "page" : undefined} href={tool.href} key={tool.key}>
            <span className="tool-mark"><tool.icon aria-hidden="true" /></span><span><strong>{tool.label}</strong><small>{tool.sub}</small></span>{tool.href === "/messages" && unread > 0 && <span className="nav-badge">{unread}</span>}
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
        { href: "/settings/common-codes", label: "공통코드 설정", active: pathname.startsWith("/settings/common-codes") },
        { href: "/settings/meeting-rooms", label: "회의실 관리", active: pathname.startsWith("/settings/meeting-rooms") },
        { href: "/settings/recurring-meetings", label: "정기예약 승인", active: pathname.startsWith("/settings/recurring-meetings") },
        { href: "/settings/menu", label: "메뉴 설정", active: pathname.startsWith("/settings/menu") },
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
  if (currentTool && currentTool.key !== "items") {
    const moduleTabs: Record<string, {href:string;label:string}[]> = {
      "/portfolio": [{href:"/portfolio",label:"프로젝트 현황"},{href:"/calendar",label:"캘린더"}],
      "/weekly-reports": [{href:"/weekly-reports",label:"입력·조회"},{href:"/weekly-reports/print",label:"보고서 출력"},{href:"/api/v1/work-export?type=reports",label:"Excel용 CSV"}],
      "/weekly-progress": [{href:"/weekly-progress",label:"실적 입력·조회"},...(isManager?[{href:"/portfolio",label:"공정률 현황"}]:[]),{href:"/api/v1/work-export?type=progress",label:"Excel용 CSV"}],
      "/staff-changes": [{href:"/staff-changes",label:"투입·철수 관리"},{href:"/api/v1/work-export?type=staff",label:"Excel용 CSV"}],
      "/calendar": [{href:"/calendar",label:"캘린더"},{href:"/calendar/milestones",label:"주요 이벤트"}],
      "/meetrooms": [{href:"/meetrooms",label:"예약·관리"}],
      "/messages": [{href:"/messages",label:"쪽지함"}],
      "/requirements": [{href:"/requirements",label:"요구사항정의서"},{href:"/requirements/statistics",label:"요구사항통계"},...(isManager?[{href:"/requirements/changes",label:"요구사항변경관리"}]:[])],
    };
    return <div className="workspace-nav"><strong className="workspace-tool-name">{currentTool.label}</strong><nav className="tool-tabs" aria-label={`${currentTool.label} 기능`}>{moduleTabs[currentTool.href].map((tab)=><Link className={pathname===tab.href?"active":""} href={tab.href} key={tab.href}>{tab.label}</Link>)}</nav><Link className="mobile-global-link" href="/settings/system">설정</Link></div>;
  }

  const tabs = [
    { href: "/items/dashboard", label: "대시보드", active: pathname === "/items/dashboard" },
    { href: "/items/new", label: "이슈 등록", active: pathname === "/items/new" },
    { href: "/items", label: "전체 목록", active: pathname === "/items" || (pathname.startsWith("/items/") && pathname !== "/items/new" && pathname !== "/items/dashboard") },
  ];

  return <div className="workspace-nav">
    <strong className="workspace-tool-name">이슈 관리</strong>
    <nav className="tool-tabs" aria-label="이슈관리 기능">
      {tabs.map((tab) => <Link className={tab.active ? "active" : ""} aria-current={tab.active ? "page" : undefined} href={tab.href} key={tab.href}>{tab.label}</Link>)}
    </nav>
    <Link className="mobile-global-link" href="/settings/system">설정</Link>
  </div>;
}
