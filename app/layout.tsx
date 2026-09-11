import type { Metadata } from "next";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { AuthenticatedAppShell } from "@/components/AuthenticatedAppShell";
import { auth } from "@/lib/server/auth";
import { listMenuPreferences } from "@/lib/server/menu-preferences";
import { hasWorkLogManagementAccess } from "@/lib/server/work-logs";
import "./globals.css";

export const metadata: Metadata = {
  title: "PMOTOOLS",
  description: "프로젝트 관리에 필요한 업무 도구를 제공하는 PMOTOOLS",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const [menuPrefs, canManageWorkLogs] = session?.user ? await Promise.all([
    listMenuPreferences(session.user.projectId),
    hasWorkLogManagementAccess(session.user.projectId, session.user.id),
  ]) : [[], false];
  const themeScript = `(function(){try{var p=localStorage.getItem('pmo-control-theme')||'light';var d=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch(e){}})()`;
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
          <AuthenticatedAppShell menuPrefs={menuPrefs} canManageWorkLogs={canManageWorkLogs}>
            {children}
          </AuthenticatedAppShell>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
