import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth";
import { hasPmPmoAccess } from "@/lib/domain/job-access";

export async function getLocalContext() {
  const session = await auth();
  if (!session?.user) throw new Error("인증되지 않은 요청입니다.");
  return { userId: session.user.id, projectId: session.user.projectId, role: session.user.role, jobTitle: session.user.jobTitle };
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

export async function requireSuperAdminContext() {
  const context = await getLocalContext();
  if (context.role !== "SUPER_ADMIN") redirect("/");
  return context;
}

export async function requirePmPmoContext() {
  const context = await getLocalContext();
  if (!hasPmPmoAccess(context.jobTitle, context.role)) redirect("/announcements");
  return context;
}
