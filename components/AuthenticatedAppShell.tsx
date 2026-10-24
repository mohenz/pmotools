"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronRight } from "lucide-react";
import { AppNavigation } from "@/components/AppNavigation";
import { GlobalSearch } from "@/components/GlobalSearch";
import { InvitationPopup } from "@/components/InvitationPopup";
import { WorkNoticePopup } from "@/components/WorkNoticePopup";
import { ScrollTopButton } from "@/components/ScrollTopButton";
import { UnreadMessageProvider } from "@/components/UnreadMessageProvider";
import { UserMenu } from "@/components/UserMenu";
import type { MenuPreferenceRow } from "@/lib/domain/menu-preferences";

const AUTH_PATHS = new Set(["/login", "/signup", "/reset-password"]);
const DEFAULT_WIDTH = 200;
const MIN_WIDTH = 150;
const MAX_WIDTH = 420;
const COLLAPSE_THRESHOLD = 75;

export function AuthenticatedAppShell({
  children,
  menuPrefs,
  canManageWorkLogs,
}: {
  children: React.ReactNode;
  menuPrefs: MenuPreferenceRow[];
  canManageWorkLogs: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const isAuthPage = AUTH_PATHS.has(pathname);
  // 로그인 화면이 제공하는 "캘린더/회의실 조회" 공개 미리보기(iframe src=".../calendar?embedded=1")는
  // 로그인 상태와 무관하게(관리자가 미리보기를 열어도) 앱 상단 메뉴 없이 콘텐츠만 보여줘야 한다.
  const isEmbedded = searchParams.get("embedded") === "1";
  const isPopup = searchParams.get("popup") === "1";

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const lastWidthRef = useRef(DEFAULT_WIDTH);
  const isCollapsedRef = useRef(false);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    try {
      const savedCollapsed = localStorage.getItem("pmo-sidebar-collapsed");
      if (savedCollapsed === "true") {
        setIsCollapsed(true);
        isCollapsedRef.current = true;
      }
      const savedWidth = localStorage.getItem("pmo-sidebar-width");
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
          setSidebarWidth(parsed);
          lastWidthRef.current = parsed;
        }
      }
    } catch {}
  }, []);

  function toggleSidebar() {
    setIsCollapsed((prev) => {
      const next = !prev;
      isCollapsedRef.current = next;
      if (!next && (sidebarWidth < MIN_WIDTH || sidebarWidth > MAX_WIDTH)) {
        setSidebarWidth(lastWidthRef.current || DEFAULT_WIDTH);
      }
      try {
        localStorage.setItem("pmo-sidebar-collapsed", String(next));
      } catch {}
      return next;
    });
  }

  // 구분선(Splitter) 드래그로 사이드바 너비 조절 및 임계값 이하 드래그 시 자동 접힘
  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    isDraggingRef.current = true;
    document.body.classList.add("resizing-sidebar");

    function onMouseMove(moveEvent: MouseEvent) {
      if (!isDraggingRef.current) return;
      const newWidth = moveEvent.clientX;
      if (newWidth < COLLAPSE_THRESHOLD) {
        setIsCollapsed(true);
        isCollapsedRef.current = true;
      } else {
        const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
        setIsCollapsed(false);
        isCollapsedRef.current = false;
        setSidebarWidth(clamped);
        lastWidthRef.current = clamped;
      }
    }

    function onMouseUp() {
      setIsDragging(false);
      isDraggingRef.current = false;
      document.body.classList.remove("resizing-sidebar");
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);

      try {
        localStorage.setItem("pmo-sidebar-collapsed", String(isCollapsedRef.current));
        if (!isCollapsedRef.current) {
          localStorage.setItem("pmo-sidebar-width", String(lastWidthRef.current));
        }
      } catch {}
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  // 접힌 상태 레일(Rail) 클릭 또는 오른쪽 드래그로 펼치기 (팀즈 스타일)
  function handleRailMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    let hasDragged = false;

    function onMouseMove(moveEvent: MouseEvent) {
      const deltaX = moveEvent.clientX - startX;
      if (!hasDragged && deltaX > 6) {
        hasDragged = true;
        setIsDragging(true);
        isDraggingRef.current = true;
        document.body.classList.add("resizing-sidebar");
      }

      if (hasDragged) {
        const newWidth = moveEvent.clientX;
        if (newWidth >= COLLAPSE_THRESHOLD) {
          const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
          setIsCollapsed(false);
          isCollapsedRef.current = false;
          setSidebarWidth(clamped);
          lastWidthRef.current = clamped;
        }
      }
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.classList.remove("resizing-sidebar");
      setIsDragging(false);
      isDraggingRef.current = false;

      if (!hasDragged) {
        // 단일 클릭인 경우: 이전 너비로 즉시 펼침
        const targetWidth = lastWidthRef.current || DEFAULT_WIDTH;
        setIsCollapsed(false);
        isCollapsedRef.current = false;
        setSidebarWidth(targetWidth);
        try {
          localStorage.setItem("pmo-sidebar-collapsed", "false");
          localStorage.setItem("pmo-sidebar-width", String(targetWidth));
        } catch {}
      } else {
        try {
          localStorage.setItem("pmo-sidebar-collapsed", String(isCollapsedRef.current));
          if (!isCollapsedRef.current) {
            localStorage.setItem("pmo-sidebar-width", String(lastWidthRef.current));
          }
        } catch {}
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function handleSplitterDoubleClick() {
    setIsCollapsed(true);
    isCollapsedRef.current = true;
    try {
      localStorage.setItem("pmo-sidebar-collapsed", "true");
    } catch {}
  }

  function handleSplitterKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const nextWidth = sidebarWidth - 16;
      if (nextWidth < MIN_WIDTH) {
        setIsCollapsed(true);
        isCollapsedRef.current = true;
      } else {
        setSidebarWidth(nextWidth);
        lastWidthRef.current = nextWidth;
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextWidth = Math.min(MAX_WIDTH, sidebarWidth + 16);
      setSidebarWidth(nextWidth);
      lastWidthRef.current = nextWidth;
    } else if (e.key === "Home") {
      e.preventDefault();
      setIsCollapsed(true);
      isCollapsedRef.current = true;
    } else if (e.key === "End") {
      e.preventDefault();
      setSidebarWidth(DEFAULT_WIDTH);
      lastWidthRef.current = DEFAULT_WIDTH;
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (status !== "unauthenticated" || isAuthPage || isEmbedded) return;
    const callbackUrl = pathname && pathname !== "/" ? `?callbackUrl=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${callbackUrl}`);
  }, [isAuthPage, isEmbedded, pathname, router, status]);

  if (isAuthPage || isEmbedded) {
    return <main className="main" id="main-content" tabIndex={-1}>{children}</main>;
  }

  if (status !== "authenticated") {
    return <main className="main" id="main-content" tabIndex={-1} aria-busy="true" />;
  }

  if (isPopup) {
    return <main className="main popup-main" id="main-content" tabIndex={-1}>{children}</main>;
  }

  return (
    <UnreadMessageProvider>
      <InvitationPopup />
      <WorkNoticePopup />
      <ScrollTopButton />
      <a className="skip-link" href="#main-content">본문 바로가기</a>
      <div className="app-shell">
        <header className="global-header">
          <div className="global-header-main">
            <Link className="brand" href="/portfolio" aria-label="PMOTOOLS 메인 화면으로 이동">
              <div className="brand-mark" aria-hidden="true" />
              <span className="brand-text">
                <span>PROJECT MANAGEMENT</span>
                <strong>PMO<span className="brand-accent">TOOLS</span></strong>
              </span>
            </Link>
            <div className="global-header-end">
              <GlobalSearch />
              <div className="sidebar-foot"><UserMenu /></div>
            </div>
          </div>
          <AppNavigation area="sidebar" menuPrefs={menuPrefs} canManageWorkLogs={canManageWorkLogs} />
        </header>
        <div
          className={`app-body ${isCollapsed ? "sidebar-collapsed" : ""} ${isDragging ? "resizing-active" : ""}`}
          style={{ "--sidebar-width": `${isCollapsed ? 0 : sidebarWidth}px` } as React.CSSProperties}
        >
          <aside
            className={`module-sidebar ${isCollapsed ? "collapsed" : ""}`}
            aria-label="하위 메뉴"
            aria-expanded={!isCollapsed}
          >
            <AppNavigation area="workspace" menuPrefs={menuPrefs} canManageWorkLogs={canManageWorkLogs} />
          </aside>
          {!isCollapsed && (
            <div
              className={`sidebar-splitter ${isDragging ? "dragging" : ""}`}
              onMouseDown={startResize}
              onDoubleClick={handleSplitterDoubleClick}
              onKeyDown={handleSplitterKeyDown}
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={sidebarWidth}
              aria-valuemin={MIN_WIDTH}
              aria-valuemax={MAX_WIDTH}
              tabIndex={0}
              aria-label="사이드바 너비 조절 구분선 (좌우로 드래그, 더블클릭 시 접기)"
            >
              <div className="splitter-thumb" />
            </div>
          )}
          {isCollapsed && (
            <div
              className={`sidebar-collapsed-rail ${isDragging ? "dragging" : ""}`}
              onMouseDown={handleRailMouseDown}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleSidebar();
                }
              }}
              aria-label="메뉴 펼치기 (클릭하거나 오른쪽으로 드래그)"
            >
              <div className="rail-accent-line" />
              <div className="rail-handle-pill" aria-hidden="true">
                <ChevronRight size={12} className="rail-icon" />
              </div>
            </div>
          )}
          <main className="main" id="main-content" tabIndex={-1}>{children}</main>
        </div>
      </div>
    </UnreadMessageProvider>
  );
}
