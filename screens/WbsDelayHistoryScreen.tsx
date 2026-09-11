import Link from "next/link";
import type { WbsDelayedTaskRow } from "@/lib/server/wbs";

type Filters = { from?: string; to?: string; page: number };
type Result = { rows: WbsDelayedTaskRow[]; total: number; page: number; pageSize: number; totalPages: number };

const dt = (value: string) => new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

function queryString(filters: Filters, overrides: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...overrides }).forEach(([key, value]) => {
    if (value !== "" && value != null && !(key === "page" && value === 1)) params.set(key, String(value));
  });
  return params.toString();
}

export function WbsDelayHistoryScreen({ result, filters }: { result: Result; filters: Filters }) {
  return <>
    <header className="topbar"><div><h1>지연 이력</h1><p>실적종료일이 계획종료일보다 늦게 등록될 때마다 남는 지연 이력입니다.</p></div></header>
    <div className="content">
      <section className="panel compact">
        <form className="filters inline-filter" method="get">
          <div className="filter-row">
            <label>시작일<input name="from" type="date" defaultValue={filters.from ?? ""} /></label>
            <label>종료일<input name="to" type="date" defaultValue={filters.to ?? ""} /></label>
            <button className="button secondary" type="submit">조회</button>
          </div>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>지연 등록 이력</h2><span>{result.total}건</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Task</th><th>업무그룹</th><th>담당자</th><th>계획종료일</th><th>실적종료일</th><th>지연일</th><th>등록일시</th></tr></thead>
            <tbody>
              {result.rows.map((row) => <tr key={row.id}>
                <td className="title-cell"><Link className="table-link" href={`/wbs/${row.wbsItemId}`}>{row.code ? `${row.code} ` : ""}{row.name}</Link></td>
                <td>{row.groupLabel ?? "-"}</td>
                <td>{row.ownerName ?? "-"}</td>
                <td className="mono">{row.plannedDueDate ?? "-"}</td>
                <td className="mono">{row.actualDueDate}</td>
                <td><span className="badge issue">{row.delayDays}일</span></td>
                <td className="mono">{dt(row.createdAt)}</td>
              </tr>)}
              {!result.rows.length && <tr><td colSpan={7} className="empty">조회된 지연 이력이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {result.totalPages > 1 && <nav className="pagination" aria-label="페이지 이동">
        {result.page > 1 ? <Link href={`/wbs/delay-history?${queryString(filters, { page: result.page - 1 })}`}>이전</Link> : <span />}
        <strong>{result.page} / {result.totalPages}</strong>
        {result.page < result.totalPages ? <Link href={`/wbs/delay-history?${queryString(filters, { page: result.page + 1 })}`}>다음</Link> : <span />}
      </nav>}
    </div>
  </>;
}
