import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { isPublicReadApi, isPublicViewPath } from "@/lib/domain/public-access";

const PUBLIC_PATHS = ["/login", "/signup", "/reset-password"];
const PUBLIC_FILE = /\.(png|jpg|jpeg|svg|webp|ico)$/;
// 결함 등록 위젯 스크립트 — 테스트 대상 사이트가 로그인 없이 불러온다(스크립트에는 비밀 값이 없다).
const PUBLIC_WIDGET = /^\/defect-widget\/[\w.-]+\.js$/;

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path) || isPublicViewPath(pathname) || isPublicReadApi(request.method, pathname) || pathname.startsWith("/api/auth") || pathname === "/api/health" || pathname === "/api/admin/db-export" || pathname.startsWith("/test_view") || ((pathname === "/api/v1/settings/login-image" || pathname === "/api/v1/settings/login-image/file") && request.method === "GET") || PUBLIC_FILE.test(pathname) || PUBLIC_WIDGET.test(pathname);
  // 세션이 있어도 접근 가능한 프로젝트가 하나도 없으면(배정 전부 해제·계정 잠금) 로그인되지 않은 것으로 본다(2026-09-29 계정 역할 통일).
  const noProjectAccess = request.auth?.user?.projectAccess === false;
  if (isPublic || (request.auth && !noProjectAccess)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return noProjectAccess
      ? NextResponse.json({ error: { code: "NO_PROJECT_ACCESS", message: "배정된 프로젝트가 없습니다. 관리자에게 프로젝트 배정을 요청하십시오." } }, { status: 401 })
      : NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "로그인이 필요합니다." } }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.nextUrl.origin);
  // 결함 등록 팝업은 로그인 뒤 같은 주소(쿼리 포함)로 돌아와야 한다.
  loginUrl.searchParams.set("callbackUrl", pathname.startsWith("/mp-defects") ? pathname + request.nextUrl.search : pathname);
  if (noProjectAccess) loginUrl.searchParams.set("reason", "no-project");
  return NextResponse.redirect(loginUrl);
});

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
