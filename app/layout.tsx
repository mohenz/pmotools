import type { Metadata } from "next";
import Link from "next/link";
import { AppNavigation } from "@/components/AppNavigation";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { UserMenu } from "@/components/UserMenu";
import "./globals.css";

export const metadata: Metadata = {
  title: "PMO CONTROL",
  description: "프로젝트 관리에 필요한 업무 도구를 제공하는 PMO CONTROL",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeScript = `(function(){try{var p=localStorage.getItem('pmo-control-theme')||'system';var d=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch(e){}})()`;
  return (
    <html lang="ko" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <AuthSessionProvider>
          <a className="skip-link" href="#main-content">본문 바로가기</a>
          <div className="app-shell">
            <aside className="sidebar">
              <Link className="brand" href="/portfolio" aria-label="PMO CONTROL 통합 현황으로 이동">
                <span>PROJECT MANAGEMENT</span>
                <strong>PMO CONTROL</strong>
              </Link>
              <AppNavigation area="sidebar" />
              <div className="sidebar-foot"><UserMenu />VERCEL · SUPABASE POSTGRES</div>
            </aside>
            <main className="main" id="main-content" tabIndex={-1}><AppNavigation area="workspace" />{children}</main>
          </div>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
