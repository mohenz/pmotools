import Link from "next/link";
import type { AnnouncementRow } from "@/lib/server/announcements";

function date(value: string) { return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(value)); }

export function AnnouncementListScreen({ result, q, isManager }: { result: { announcements: AnnouncementRow[]; total: number; page: number; totalPages: number }; q: string; isManager: boolean }) {
  return <>
    <header className="topbar"><div><h1>공지사항</h1><p>프로젝트 주요 소식과 안내를 확인하세요.</p></div>{isManager && <div className="topbar-actions"><Link className="button primary" href="/announcements/new">+ 새 공지사항</Link></div>}</header>
    <div className="content announcement-content">
      <form className="filters requirement-filter-panel announcement-search" method="get"><input name="q" defaultValue={q} placeholder="제목 또는 내용 검색" aria-label="공지사항 검색" /><button className="button secondary">조회</button></form>
      <section className="panel compact announcement-board">
        <div className="announcement-board-head"><strong>전체 공지</strong><span>{result.total}건</span></div>
        {result.announcements.length ? <div className="announcement-list">
          {result.announcements.map((item) => <Link className={`announcement-row${item.isImportant ? " important" : ""}`} href={`/announcements/${item.id}`} key={item.id}>
            <span className="announcement-icon" aria-hidden="true">{item.isImportant ? "!" : "·"}</span>
            <span className="announcement-main"><span className="announcement-badges">{item.isImportant && <b>중요</b>}{item.audience === "MANAGERS" && <em>관리자·운영자</em>}</span><strong>{item.title}</strong><small>{item.authorName} · {date(item.publishedAt)}</small></span>
            <span className="announcement-views">조회 {item.viewCount}</span>
          </Link>)}
        </div> : <div className="empty">등록된 공지사항이 없습니다.</div>}
      </section>
      {result.totalPages > 1 && <nav className="pagination requirement-pagination" aria-label="페이지 이동"><div className="page-links">{result.page > 1 && <Link href={`/announcements?q=${encodeURIComponent(q)}&page=${result.page - 1}`}>이전</Link>}<strong>{result.page} / {result.totalPages}</strong>{result.page < result.totalPages && <Link href={`/announcements?q=${encodeURIComponent(q)}&page=${result.page + 1}`}>다음</Link>}</div></nav>}
    </div>
  </>;
}
