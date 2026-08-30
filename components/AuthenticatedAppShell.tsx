"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { AppNavigation } from "@/components/AppNavigation";
import { InvitationPopup } from "@/components/InvitationPopup";
import { UnreadMessageProvider } from "@/components/UnreadMessageProvider";
import { UserMenu } from "@/components/UserMenu";
import type { MenuPreferenceRow } from "@/lib/domain/menu-preferences";

const AUTH_PATHS = new Set(["/login", "/signup", "/reset-password"]);

export function AuthenticatedAppShell({
  children,
  menuPrefs,
  announcements,
  canManageWorkLogs,
}: {
  children: React.ReactNode;
  menuPrefs: MenuPreferenceRow[];
  announcements: { id: string; title: string; isImportant: boolean }[];
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

  return (
    <UnreadMessageProvider>
      <InvitationPopup />
      <a className="skip-link" href="#main-content">본문 바로가기</a>
      <div className="app-shell">
        <header className="global-header">
          <div className="global-header-main">
            <Link className="brand" href="/announcements" aria-label="PMOTOOLS 메인 화면으로 이동">
              <div className="brand-mark" aria-hidden="true" />
              <span className="brand-text">
                <span>PROJECT MANAGEMENT</span>
                <strong>PMOTOOLS</strong>
              </span>
            </Link>
            <div className="sidebar-foot"><UserMenu /></div>
          </div>
          <AppNavigation area="sidebar" menuPrefs={menuPrefs} canManageWorkLogs={canManageWorkLogs} />
        </header>
        <div className="app-body">
          <aside className="module-sidebar"><AppNavigation area="workspace" menuPrefs={menuPrefs} canManageWorkLogs={canManageWorkLogs} /></aside>
          <main className="main" id="main-content" tabIndex={-1}><AnnouncementBanner announcements={announcements} />{children}</main>
        </div>
      </div>
    </UnreadMessageProvider>
  );
}
