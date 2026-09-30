"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut, Settings } from "lucide-react";
import { MessageIcon } from "@/components/icons/PmoIcons";
import { useUnreadMessageCount } from "@/components/UnreadMessageProvider";

const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "슈퍼관리자", ADMIN: "관리자", OPERATOR: "운영자", MEMBER: "일반" };

type MyProject = { projectId: string; code: string; name: string; role: string };

export function UserMenu() {
  const { data: session, update } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { count: unread } = useUnreadMessageCount();
  const [projects, setProjects] = useState<MyProject[]>([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/v1/me/projects")
      .then((res) => res.json())
      .then((payload) => setProjects(Array.isArray(payload?.data) ? payload.data : []))
      .catch(() => setProjects([]));
  }, [session?.user?.id]);

  if (!session?.user) return null;
  const settingsActive = pathname.startsWith("/settings") || pathname.startsWith("/project-settings") || pathname.startsWith("/weeks") || pathname.startsWith("/activity-logs");

  async function switchProject(projectId: string) {
    if (!projectId || projectId === session?.user.projectId) return;
    setSwitching(true);
    await update({ projectId });
    setSwitching(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="user-menu">
      <Link className="user-profile-link" href="/settings/profile" title="나의 정보 보기">
        {session.user.name} ({ROLE_LABEL[session.user.role] ?? session.user.role})
      </Link>
      {projects.length > 1 && (
        <select
          className="project-switcher"
          aria-label="프로젝트 전환"
          title="소속된 다른 프로젝트로 전환"
          value={session.user.projectId}
          disabled={switching}
          onChange={(event) => switchProject(event.target.value)}
        >
          {projects.map((project) => <option value={project.projectId} key={project.projectId}>{project.name} ({project.code})</option>)}
        </select>
      )}
      <div className="sidebar-icon-actions">
        <Link href="/messages" aria-label={unread ? `초청 ${unread}건` : "초청"} title="초청" className={pathname.startsWith("/messages") ? "active header-invite-link" : "header-invite-link"}><MessageIcon aria-hidden="true" />{unread > 0 && <span className="nav-badge">{unread}</span>}</Link>
        <Link href="/settings/system" aria-label="설정" title="설정" className={settingsActive ? "active" : ""}><Settings aria-hidden="true" /></Link>
        <button type="button" aria-label="로그아웃" title="로그아웃" onClick={() => signOut({ callbackUrl: "/login" })}><LogOut aria-hidden="true" /></button>
      </div>
    </div>
  );
}
