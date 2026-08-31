"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { MessageIcon, SettingsIcon } from "@/components/icons/PmoIcons";
import { useUnreadMessageCount } from "@/components/UnreadMessageProvider";

const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "슈퍼관리자", ADMIN: "관리자", OPERATOR: "운영자", MEMBER: "일반" };

export function UserMenu() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { count: unread } = useUnreadMessageCount();
  if (!session?.user) return null;
  const settingsActive = pathname.startsWith("/settings") || pathname.startsWith("/project-settings") || pathname.startsWith("/weeks") || pathname.startsWith("/activity-logs");
  return (
    <div className="user-menu">
      <Link className="user-profile-link" href="/settings/profile" title="나의 정보 보기">
        {session.user.name} ({ROLE_LABEL[session.user.role] ?? session.user.role})
      </Link>
      <div className="sidebar-icon-actions">
        <Link href="/messages" aria-label={unread ? `초청 ${unread}건` : "초청"} title="초청" className={pathname.startsWith("/messages") ? "active header-invite-link" : "header-invite-link"}><MessageIcon aria-hidden="true" />{unread > 0 && <span className="nav-badge">{unread}</span>}</Link>
        <Link href="/settings/system" aria-label="설정" title="설정" className={settingsActive ? "active" : ""}><SettingsIcon aria-hidden="true" /></Link>
        <button type="button" aria-label="로그아웃" title="로그아웃" onClick={() => signOut({ callbackUrl: "/login" })}><LogOut aria-hidden="true" /></button>
      </div>
    </div>
  );
}
