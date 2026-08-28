"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
  const { status } = useSession();
  const isAuthPage = AUTH_PATHS.has(pathname);

  useEffect(() => {
    if (status !== "unauthenticated" || isAuthPage) return;
    const callbackUrl = pathname && pathname !== "/" ? `?callbackUrl=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${callbackUrl}`);
  }, [isAuthPage, pathname, router, status]);

  if (isAuthPage) {
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
