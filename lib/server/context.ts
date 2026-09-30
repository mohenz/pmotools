import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth";
import { hasPmPmoAccess } from "@/lib/domain/job-access";

export async function getLocalContext() {
  const session = await auth();
  if (!session?.user) throw new Error("인증되지 않은 요청입니다.");
  return { userId: session.user.id, loginId: session.user.loginId, projectId: session.user.projectId, role: session.user.role, globalRole: session.user.globalRole, jobTitle: session.user.jobTitle };
}

export async function requireAdminContext() {
  const context = await getLocalContext();
  if (context.role !== "ADMIN" && context.role !== "SUPER_ADMIN") redirect("/");
  return context;
}

export async function requireManagerContext() {
  const context = await getLocalContext();
  if (context.role !== "ADMIN" && context.role !== "OPERATOR" && context.role !== "SUPER_ADMIN") redirect("/calendar");
  return context;
}

// 프로젝트에 속하지 않는 플랫폼 전역 기능(프로젝트 생성, 전역 공통코드 등) 전용 가드.
// context.role(프로젝트 내 역할)이 아니라 globalRole(User.role, 플랫폼 전역 역할)을 검사해야
// 특정 프로젝트의 소속 여부와 무관하게 진짜 플랫폼 관리자만 접근할 수 있다.
export async function requireSuperAdminContext() {
  const context = await getLocalContext();
  if (context.globalRole !== "SUPER_ADMIN") redirect("/");
  return context;
}

export async function requirePmPmoContext() {
  const context = await getLocalContext();
  if (!hasPmPmoAccess(context.jobTitle, context.role)) redirect("/announcements");
  return context;
}
