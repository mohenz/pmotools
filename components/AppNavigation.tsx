"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { CalendarDays, FileText, LayoutDashboard, Mail, Settings, ShieldAlert, TrendingUp, Users } from "lucide-react";

export function AppNavigation({ area }: { area: "sidebar" | "workspace" }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/v1/messages/unread-count").then((r) => r.json()).then((p) => setUnread(p?.data?.count ?? 0)).catch(() => {});
  }, [session?.user, pathname]);
  const settingsActive = pathname.startsWith("/settings") || pathname.startsWith("/project-settings") || pathname.startsWith("/weeks") || pathname.startsWith("/activity-logs");
  const tools = [
    { href: "/portfolio", icon: LayoutDashboard, label: "통합 현황", sub: "Portfolio", active: pathname.startsWith("/portfolio") },
    { href: "/calendar", icon: CalendarDays, label: "캘린더", sub: "Calendar", active: pathname.startsWith("/calendar") },
    { href: "/", icon: ShieldAlert, label: "이슈 관리", sub: "Issue & Risk", active: pathname === "/" || pathname.startsWith("/items") },
    { href: "/weekly-reports", icon: FileText, label: "주간보고", sub: "Weekly Report", active: pathname.startsWith("/weekly-reports") },
    { href: "/weekly-progress", icon: TrendingUp, label: "주간실적", sub: "Progress", active: pathname.startsWith("/weekly-progress") },
    { href: "/staff-changes", icon: Users, label: "인력변동", sub: "Staff", active: pathname.startsWith("/staff-changes") },
    { href: "/messages", icon: Mail, label: "쪽지", sub: "Messages", active: pathname.startsWith("/messages") },
  ];

  if (area === "sidebar") {
    return <>
      <div className="sidebar-tools">
        <span className="sidebar-label">TOOLS</span>
        <nav className="tool-nav" aria-label="프로젝트 관리 도구">
          {tools.map((tool) => <Link className={tool.active ? "active" : ""} aria-current={tool.active ? "page" : undefined} href={tool.href} key={tool.href}>
            <span className="tool-mark"><tool.icon aria-hidden="true" /></span><span><strong>{tool.label}</strong><small>{tool.sub}</small></span>{tool.href === "/messages" && unread > 0 && <span className="nav-badge">{unread}</span>}
          </Link>)}
        </nav>
      </div>
      <div className="sidebar-global">
        <span className="sidebar-label">GLOBAL</span>
        <nav className="global-nav settings-tree" aria-label="설정 메뉴">
          <Link className={`settings-parent ${settingsActive ? "active" : ""}`} href="/settings/system">
            <span className="tool-mark"><Settings aria-hidden="true" /></span><span>설정</span>
          </Link>
        </nav>
      </div>
    </>;
  }

  if (settingsActive) {
    const settingsTabs = [
      { href: "/project-settings", label: "프로젝트정보 설정", active: pathname.startsWith("/project-settings") },
      { href: "/weeks", label: "프로젝트 주차", active: pathname.startsWith("/weeks") },
      { href: "/settings/common-codes", label: "공통코드 설정", active: pathname.startsWith("/settings/common-codes") },
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
  if (currentTool && currentTool.href !== "/") {
    const moduleTabs: Record<string, {href:string;label:string}[]> = {
      "/portfolio": [{href:"/portfolio",label:"프로젝트 현황"},{href:"/calendar",label:"통합 일정"}],
      "/weekly-reports": [{href:"/weekly-reports",label:"입력·조회"},{href:"/weekly-reports/print",label:"보고서 출력"},{href:"/api/v1/work-export?type=reports",label:"Excel용 CSV"}],
      "/weekly-progress": [{href:"/weekly-progress",label:"실적 입력·조회"},{href:"/portfolio",label:"공정률 현황"},{href:"/api/v1/work-export?type=progress",label:"Excel용 CSV"}],
      "/staff-changes": [{href:"/staff-changes",label:"투입·철수 관리"},{href:"/api/v1/work-export?type=staff",label:"Excel용 CSV"}],
      "/calendar": [{href:"/calendar",label:"통합 캘린더"},{href:"/calendar/milestones",label:"주요 이벤트"}],
      "/messages": [{href:"/messages",label:"쪽지함"}],
    };
    return <div className="workspace-nav"><strong className="workspace-tool-name">{currentTool.label}</strong><nav className="tool-tabs" aria-label={`${currentTool.label} 기능`}>{moduleTabs[currentTool.href].map((tab)=><Link className={pathname===tab.href?"active":""} href={tab.href} key={tab.href}>{tab.label}</Link>)}</nav><Link className="mobile-global-link" href="/settings/system">설정</Link></div>;
  }

  const tabs = [
    { href: "/", label: "대시보드", active: pathname === "/" },
    { href: "/items/new", label: "이슈 등록", active: pathname === "/items/new" },
    { href: "/items", label: "전체 목록", active: pathname === "/items" || (pathname.startsWith("/items/") && pathname !== "/items/new") },
  ];

  return <div className="workspace-nav">
    <strong className="workspace-tool-name">이슈 관리</strong>
    <nav className="tool-tabs" aria-label="이슈관리 기능">
      {tabs.map((tab) => <Link className={tab.active ? "active" : ""} aria-current={tab.active ? "page" : undefined} href={tab.href} key={tab.href}>{tab.label}</Link>)}
    </nav>
    <Link className="mobile-global-link" href="/settings/system">설정</Link>
  </div>;
}
