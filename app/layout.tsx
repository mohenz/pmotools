import type { Metadata } from "next";
import Link from "next/link";
import { AppNavigation } from "@/components/AppNavigation";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { UnreadMessageProvider } from "@/components/UnreadMessageProvider";
import { UserMenu } from "@/components/UserMenu";
import { InvitationPopup } from "@/components/InvitationPopup";
import { auth } from "@/lib/server/auth";
import { listMenuPreferences } from "@/lib/server/menu-preferences";
import { listDashboardAnnouncements } from "@/lib/server/announcements";
import { hasWorkLogManagementAccess } from "@/lib/server/work-logs";
import "./globals.css";

export const metadata: Metadata = {
  title: "PMOTOOLS",
  description: "프로젝트 관리에 필요한 업무 도구를 제공하는 PMOTOOLS",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const [menuPrefs, announcements, canManageWorkLogs] = session?.user ? await Promise.all([
    listMenuPreferences(session.user.projectId),
    listDashboardAnnouncements(session.user.projectId, session.user.id),
    hasWorkLogManagementAccess(session.user.projectId, session.user.id),
  ]) : [[], [], false];
  const homeHref = "/announcements";
  const themeScript = `(function(){try{var p=localStorage.getItem('pmo-control-theme')||'system';var d=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch(e){}})()`;
  if (!session?.user) {
    return (
      <html lang="ko" suppressHydrationWarning>
        <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
        <body>
          <AuthSessionProvider session={session}>
            <main className="main" id="main-content" tabIndex={-1}>{children}</main>
          </AuthSessionProvider>
        </body>
      </html>
    );
  }
  return (
    <html lang="ko" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <AuthSessionProvider session={session}>
          <UnreadMessageProvider>
            <InvitationPopup />
            <a className="skip-link" href="#main-content">본문 바로가기</a>
            <div className="app-shell">
              <header className="global-header">
                <div className="global-header-main">
                  <Link className="brand" href={homeHref} aria-label="PMOTOOLS 메인 화면으로 이동">
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
        </AuthSessionProvider>
      </body>
    </html>
  );
}
