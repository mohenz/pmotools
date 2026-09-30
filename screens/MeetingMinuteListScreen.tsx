import Link from "next/link";
import { ClickableTableRow } from "@/components/ClickableTableRow";
import { formatSessions } from "@/lib/domain/meeting-minutes";
import type { MeetingMinuteListResult } from "@/lib/server/meeting-minutes";

type Filters = { q: string; dateFrom: string; dateTo: string };

function pageHref(filters: Filters, page: number) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/meeting-minutes?${query}` : "/meeting-minutes";
}

export function MeetingMinuteListScreen({ result, filters }: { result: MeetingMinuteListResult; filters: Filters }) {
  const pageLinkCount = Math.min(10, result.totalPages);
  const firstPage = Math.max(1, Math.min(result.page - 4, result.totalPages - pageLinkCount + 1));
  const pageNumbers = Array.from({ length: pageLinkCount }, (_, index) => firstPage + index);
  return <>
    <header className="topbar"><div><h1>회의록</h1><p>총 {result.total}건</p></div></header>
    <div className="content">
      <form className="filters inline-filter pmo-list-filters" method="get">
        <label>회의일 시작<input type="date" name="dateFrom" defaultValue={filters.dateFrom} /></label>
        <label>회의일 종료<input type="date" name="dateTo" defaultValue={filters.dateTo} /></label>
        <label>검색<input name="q" defaultValue={filters.q} placeholder="안건·분류·작성자·장소" /></label>
        <button className="button secondary" type="submit">조회</button>
        {(filters.q || filters.dateFrom || filters.dateTo) && <Link className="button ghost" href="/meeting-minutes">초기화</Link>}
        <Link className="button primary filter-primary-action" href="/meeting-minutes/new">+ 회의록 작성</Link>
      </form>
      <section className="panel compact">
        {result.rows.length ? <div className="table-wrap"><table><thead><tr><th>번호</th><th>회의일</th><th>시간</th><th>분류</th><th>회의 안건</th><th>장소</th><th>작성자</th><th>Action Item</th></tr></thead>
          <tbody>{result.rows.map((row) => <ClickableTableRow href={`/meeting-minutes/${row.id}`} ariaLabel={`${row.title} 회의록 상세보기`} key={row.id}>
            <td className="mono">{row.displayId}</td><td className="mono">{row.meetingDate}</td><td>{formatSessions(row.sessions)}</td><td>{row.category || "-"}</td>
            <td className="title-cell"><Link className="table-link" href={`/meeting-minutes/${row.id}`}>{row.title}</Link></td><td>{row.location || "-"}</td><td>{row.authorName}</td><td data-numeric>{row.actionItemCount}건</td>
          </ClickableTableRow>)}</tbody></table></div> : <div className="empty">등록된 회의록이 없습니다.</div>}
      </section>
      {result.totalPages > 1 && <nav className="pagination" aria-label="페이지 이동"><div className="page-links">
        {result.page > 1 && <Link href={pageHref(filters, result.page - 1)} aria-label="이전 페이지">이전</Link>}
        {pageNumbers.map((page) => page === result.page ? <strong className="current" aria-current="page" key={page}>{page}</strong> : <Link href={pageHref(filters, page)} key={page}>{page}</Link>)}
        {result.page < result.totalPages && <Link href={pageHref(filters, result.page + 1)} aria-label="다음 페이지">다음</Link>}
      </div><span className="page-summary">총 {result.total}건 · {result.page} / {result.totalPages} 페이지</span></nav>}
    </div>
  </>;
}
