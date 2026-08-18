"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AnnouncementBanner({ announcements }: { announcements: { id: string; title: string; isImportant: boolean }[] }) {
  const pathname = usePathname();
  if (!announcements.length || (pathname !== "/portfolio" && pathname !== "/calendar")) return null;
  return <aside className="dashboard-announcements" aria-label="주요 공지사항"><div><strong>공지사항</strong>{announcements.map((item) => <Link href={`/announcements/${item.id}`} key={item.id}>{item.isImportant && <b>중요</b>}<span>{item.title}</span></Link>)}</div><Link href="/announcements">전체보기</Link></aside>;
}
