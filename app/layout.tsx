import type { Metadata } from "next";
import { headers } from "next/headers";
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

// 개발/운영 식별(2026-09-30) — 운영 서버(10.147.148.101)로 접속하면 운영, 그 외(localhost·작업 PC 등)는 모두 개발.
// 개발이면 상단 헤더를 주황색 계열로 칠한다(globals.css [data-env="development"]). 개발·운영 모두 3020 포트라 포트로는 구분하지 않는다.
const PRODUCTION_HOST = "10.147.148.101";
async function appEnv() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim().replace(/:\d+$/, "");
  return host === PRODUCTION_HOST ? "production" : "development";
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // 손상되었거나 이전 형식의 세션 쿠키는 JWT 디코딩 단계에서 auth()가 예외를 던질 수 있다.
  // 이 예외를 그대로 두면 RootLayout 자체가 죽어 전체 화면이 크래시하므로,
  // 실패 시 비로그인 상태로 안전하게 폴백해 로그인 화면으로 유도한다.
  const session = await auth().catch((e) => {
    console.error("[layout] auth() 실패 — 비로그인 상태로 폴백:", e);
    return null;
  });
  const [menuPrefs, canManageWorkLogs] = session?.user ? await Promise.all([
    listMenuPreferences(session.user.projectId),
    hasWorkLogManagementAccess(session.user.projectId, session.user.id),
  ]) : [[], false];
  const env = await appEnv();
  const themeScript = `(function(){try{var p=localStorage.getItem('pmo-control-theme')||'light';var d=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch(e){}})()`;
  if (!session?.user) {
    return (
      <html lang="ko" data-env={env} suppressHydrationWarning>
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
    <html lang="ko" data-env={env} suppressHydrationWarning>
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
