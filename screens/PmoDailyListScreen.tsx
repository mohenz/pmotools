import Link from "next/link";
import type { listPmoDailySnapshots } from "@/lib/server/pmo-daily";

type Result = Awaited<ReturnType<typeof listPmoDailySnapshots>>;
type Filters = { dateFrom: string; dateTo: string; pageSize: number | "all"; page: number };

function queryString(filters: Filters, overrides: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...overrides }).forEach(([key, value]) => {
    if (value !== "" && value != null && !(key === "page" && value === 1) && !(key === "pageSize" && value === 20)) params.set(key, String(value));
  });
  return params.toString();
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));
}

export function PmoDailyListScreen({ result, filters }: { result: Result; filters: Omit<Filters, "page"> }) {
  const allFilters: Filters = { ...filters, page: result.page };
  const pageLinkCount = Math.min(10, result.totalPages);
  const firstPage = Math.max(1, Math.min(result.page - 4, result.totalPages - pageLinkCount + 1));
  const pageNumbers = Array.from({ length: pageLinkCount }, (_, index) => firstPage + index);
  return <>
    <header className="topbar"><div><h1>PMO Daily</h1><p>총 {result.total}건 · 일자별 프로젝트 통제 기록</p></div></header>
    <div className="content">
      <form className="filters inline-filter pmo-list-filters" method="get">
        {filters.pageSize !== 20 && <input type="hidden" name="pageSize" value={String(filters.pageSize)} />}
        <label>시작일<input type="date" name="dateFrom" defaultValue={filters.dateFrom} /></label>
        <label>종료일<input type="date" name="dateTo" defaultValue={filters.dateTo} /></label>
        <button className="button secondary" type="submit">조회</button>
        {(filters.dateFrom || filters.dateTo) && <Link className="button ghost" href="/pmo-daily">초기화</Link>}
        <Link className="button primary filter-primary-action" href="/pmo-daily/new">+ 신규 작성</Link>
      </form>
      <section className="panel compact">
        {result.rows.length ? <div className="table-wrap"><table className="pmo-daily-list-table"><thead><tr><th>기준일</th><th>계획/실적 TASK</th><th>공정률</th><th>지연 TASK</th><th>지연율</th><th>전체/완료 TASK</th><th>전체 공정률</th><th>등록 지연 TASK</th><th>작성자</th><th>최종 수정</th></tr></thead><tbody>{result.rows.map((row) => <tr key={row.reportDate}>
          <td className="mono"><Link className="table-link" href={`/pmo-daily/${row.reportDate}`}>{row.reportDate}</Link></td><td>{row.plannedTaskCount} / {row.actualTaskCount}</td><td><strong>{row.scheduleProgress}%</strong></td><td>{row.delayedTaskCount}건</td><td>{row.delayedRate}%</td><td>{row.totalTaskCount} / {row.completedTaskCount}</td><td><strong>{row.overallProgress}%</strong></td><td>{row.registeredDelayedTaskCount}건</td><td>{row.creatorName}</td><td>{dateTime(row.updatedAt)}</td>
        </tr>)}</tbody></table></div> : <div className="empty">저장된 PMO Daily 기록이 없습니다.</div>}
      </section>
      {result.total > 0 && <nav className="pagination" aria-label="페이지 이동">
        <form className="page-size-form" method="get">
          {filters.dateFrom && <input type="hidden" name="dateFrom" value={filters.dateFrom} />}
          {filters.dateTo && <input type="hidden" name="dateTo" value={filters.dateTo} />}
          <label>표시 개수<select name="pageSize" defaultValue={String(filters.pageSize)}><option value="20">20개</option><option value="40">40개</option><option value="60">60개</option><option value="80">80개</option><option value="100">100개</option><option value="all">전체</option></select></label>
          <button className="button secondary" type="submit">적용</button>
        </form>
        <div className="page-links">
          {result.page > 1 && <Link href={`/pmo-daily?${queryString(allFilters, { page: result.page - 1 })}`} aria-label="이전 페이지">이전</Link>}
          {pageNumbers.map((page) => page === result.page ? <strong className="current" aria-current="page" key={page}>{page}</strong> : <Link href={`/pmo-daily?${queryString(allFilters, { page })}`} key={page}>{page}</Link>)}
          {result.page < result.totalPages && <Link href={`/pmo-daily?${queryString(allFilters, { page: result.page + 1 })}`} aria-label="다음 페이지">다음</Link>}
        </div>
        <span className="page-summary">총 {result.total}건 · {result.page} / {result.totalPages} 페이지</span>
      </nav>}
    </div>
  </>;
}
