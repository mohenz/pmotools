"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AnnouncementDetail } from "@/lib/server/announcements";

function dateTime(value: string) { return new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value)); }

export function AnnouncementDetailScreen({ announcement, isManager }: { announcement: AnnouncementDetail; isManager: boolean }) {
  const router = useRouter();
  async function remove() {
    if (!window.confirm("이 공지사항을 삭제하시겠습니까?")) return;
    const response = await fetch(`/api/v1/announcements/${announcement.id}`, { method: "DELETE" });
    if (!response.ok) { const body = await response.json().catch(() => null); window.alert(body?.error?.message ?? "삭제하지 못했습니다."); return; }
    router.push("/announcements"); router.refresh();
  }
  return <>
    <header className="topbar"><div><h1>공지사항 상세</h1><p>등록된 안내 내용을 확인합니다.</p></div><div className="topbar-actions"><Link className="button secondary" href="/announcements">목록</Link>{isManager && <><Link className="button secondary" href={`/announcements/${announcement.id}/edit`}>수정</Link><button className="button danger" onClick={remove}>삭제</button></>}</div></header>
    <div className="content announcement-content"><article className="panel announcement-detail">
      <header>{announcement.isImportant && <span className="badge risk">중요 공지</span>}<h2>{announcement.title}</h2><div><span>{announcement.authorName}</span><span>{dateTime(announcement.publishedAt)}</span><span>조회 {announcement.viewCount}</span></div></header>
      <div className="announcement-body">{announcement.content}</div>
      <footer><span>공지 대상: {announcement.audience === "ALL" ? "전체 사용자" : "관리자·운영자"}</span>{announcement.expiresAt && <span>게시 종료: {dateTime(announcement.expiresAt)}</span>}</footer>
    </article></div>
  </>;
}
