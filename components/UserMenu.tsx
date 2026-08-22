"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut, Settings } from "lucide-react";

const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "슈퍼관리자", ADMIN: "관리자", OPERATOR: "운영자", MEMBER: "일반" };

export function UserMenu() {
  const { data: session } = useSession();
  const pathname = usePathname();
  if (!session?.user) return null;
  const settingsActive = pathname.startsWith("/settings") || pathname.startsWith("/project-settings") || pathname.startsWith("/weeks") || pathname.startsWith("/activity-logs");
  return (
    <div className="user-menu">
      <Link className="user-profile-link" href="/settings/profile" title="나의 정보 보기">
        {session.user.name} ({ROLE_LABEL[session.user.role] ?? session.user.role})
      </Link>
      <div className="sidebar-icon-actions">
        <Link href="/settings/system" aria-label="설정" title="설정" className={settingsActive ? "active" : ""}><Settings aria-hidden="true" /></Link>
        <button type="button" aria-label="로그아웃" title="로그아웃" onClick={() => signOut({ callbackUrl: "/login" })}><LogOut aria-hidden="true" /></button>
      </div>
    </div>
  );
}
