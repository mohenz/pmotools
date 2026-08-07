"use client";

import { signOut, useSession } from "next-auth/react";

const ROLE_LABEL: Record<string, string> = { ADMIN: "관리자", OPERATOR: "운영자", MEMBER: "일반" };

export function UserMenu() {
  const { data: session } = useSession();
  if (!session?.user) return null;
  return (
    <div className="user-menu">
      <span>{session.user.name} ({ROLE_LABEL[session.user.role] ?? session.user.role})</span>
      <button type="button" className="button secondary" onClick={() => signOut({ callbackUrl: "/login" })}>로그아웃</button>
    </div>
  );
}
