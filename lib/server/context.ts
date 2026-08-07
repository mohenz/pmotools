import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth";

export async function getLocalContext() {
  const session = await auth();
  if (!session?.user) throw new Error("인증되지 않은 요청입니다.");
  return { userId: session.user.id, projectId: session.user.projectId, role: session.user.role };
}

export async function requireAdminContext() {
  const context = await getLocalContext();
  if (context.role !== "ADMIN") redirect("/");
  return context;
}

export async function requireManagerContext() {
  const context = await getLocalContext();
  if (context.role !== "ADMIN" && context.role !== "OPERATOR") redirect("/calendar");
  return context;
}
