import Link from "next/link";
import type { listPmoDailySnapshots } from "@/lib/server/pmo-daily";

type Result = Awaited<ReturnType<typeof listPmoDailySnapshots>>;

function query(filters: { dateFrom: string; dateTo: string }, page: number) {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));
}

export function PmoDailyListScreen({ result, filters }: { result: Result; filters: { dateFrom: string; dateTo: string } }) {
  return <>
    <header className="topbar"><div><h1>PMO Daily</h1><p>총 {result.total}건 · 일자별 프로젝트 통제 기록</p></div><Link className="button primary" href="/pmo-daily/new">+ 신규 작성</Link></header>
    <div className="content">
      <form className="filters inline-filter pmo-list-filters" method="get">
        <label>시작일<input type="date" name="dateFrom" defaultValue={filters.dateFrom} /></label>
        <label>종료일<input type="date" name="dateTo" defaultValue={filters.dateTo} /></label>
        <button className="button secondary" type="submit">조회</button>
        {(filters.dateFrom || filters.dateTo) && <Link className="button ghost" href="/pmo-daily">초기화</Link>}
      </form>
      <section className="panel compact">
        {result.rows.length ? <div className="table-wrap"><table className="pmo-daily-list-table"><thead><tr><th>기준일</th><th>계획/실적 TASK</th><th>공정률</th><th>지연 TASK</th><th>지연율</th><th>전체/완료 TASK</th><th>전체 공정률</th><th>등록 지연 TASK</th><th>작성자</th><th>최종 수정</th></tr></thead><tbody>{result.rows.map((row) => <tr key={row.reportDate}>
          <td className="mono"><Link className="table-link" href={`/pmo-daily/${row.reportDate}`}>{row.reportDate}</Link></td><td>{row.plannedTaskCount} / {row.actualTaskCount}</td><td><strong>{row.scheduleProgress}%</strong></td><td>{row.delayedTaskCount}건</td><td>{row.delayedRate}%</td><td>{row.totalTaskCount} / {row.completedTaskCount}</td><td><strong>{row.overallProgress}%</strong></td><td>{row.registeredDelayedTaskCount}건</td><td>{row.creatorName}</td><td>{dateTime(row.updatedAt)}</td>
        </tr>)}</tbody></table></div> : <div className="empty">저장된 PMO Daily 기록이 없습니다.</div>}
      </section>
      {result.totalPages > 1 && <nav className="pagination" aria-label="페이지 이동">{result.page > 1 ? <Link href={`/pmo-daily?${query(filters, result.page - 1)}`}>이전</Link> : <span />}<strong>{result.page} / {result.totalPages}</strong>{result.page < result.totalPages ? <Link href={`/pmo-daily?${query(filters, result.page + 1)}`}>다음</Link> : <span />}</nav>}
    </div>
  </>;
}
