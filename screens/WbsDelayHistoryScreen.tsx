import Link from "next/link";
import type { WbsDelayedTaskListResult, WbsDelayedTaskRow } from "@/lib/server/wbs";
import { WbsDelayHistoryTabs } from "@/components/WbsDelayHistoryTabs";

export type WbsDelayHistoryFilters = {
  from?: string;
  to?: string;
  page: number;
  pageSize: number | "all";
};

const dt = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

function queryString(
  filters: WbsDelayHistoryFilters,
  overrides: Record<string, string | number | undefined> = {}
) {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (merged.from) params.set("from", merged.from);
  if (merged.to) params.set("to", merged.to);
  if (merged.pageSize && merged.pageSize !== 20) params.set("pageSize", String(merged.pageSize));
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));
  const query = params.toString();
  return query ? `/wbs/delay-history?${query}` : "/wbs/delay-history";
}

export function WbsDelayHistoryScreen({
  result,
  filters,
}: {
  result: WbsDelayedTaskListResult;
  filters: WbsDelayHistoryFilters;
}) {
  const pageLinkCount = Math.min(10, result.totalPages);
  const firstPage = Math.max(1, Math.min(result.page - 4, result.totalPages - pageLinkCount + 1));
  const pageNumbers = Array.from({ length: pageLinkCount }, (_, index) => firstPage + index);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>지연 이력</h1>
          <p>실적종료일이 계획종료일보다 늦게 등록될 때마다 남는 지연 이력입니다.</p>
        </div>
      </header>
      <div className="content">
        <WbsDelayHistoryTabs activeTab="list" filters={filters} />
        <section className="panel compact">
          <form className="filters inline-filter" method="get">
            <div className="filter-row">
              {filters.pageSize !== 20 && (
                <input type="hidden" name="pageSize" value={String(filters.pageSize)} />
              )}
              <label>
                시작일
                <input name="from" type="date" defaultValue={filters.from ?? ""} />
              </label>
              <label>
                종료일
                <input name="to" type="date" defaultValue={filters.to ?? ""} />
              </label>
              <button className="button secondary" type="submit">
                조회
              </button>
            </div>
          </form>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>지연 등록 이력</h2>
            <span>{result.total}건</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>업무그룹</th>
                  <th>담당자</th>
                  <th>계획종료일</th>
                  <th>실적종료일</th>
                  <th>지연일</th>
                  <th>등록일시</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="title-cell">
                      <Link className="table-link" href={`/wbs/${row.wbsItemId}`}>
                        {row.code ? `${row.code} ` : ""}
                        {row.name}
                      </Link>
                    </td>
                    <td>{row.groupLabel ?? "-"}</td>
                    <td>{row.ownerName ?? "-"}</td>
                    <td className="mono">{row.plannedDueDate ?? "-"}</td>
                    <td className="mono">{row.actualDueDate}</td>
                    <td>
                      <span className="badge issue">{row.delayDays}일</span>
                    </td>
                    <td className="mono">{dt(row.createdAt)}</td>
                  </tr>
                ))}
                {!result.rows.length && (
                  <tr>
                    <td colSpan={7} className="empty">
                      조회된 지연 이력이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {result.total > 0 && (
          <nav className="pagination requirement-pagination" aria-label="페이지 이동">
            <form className="page-size-form" method="get">
              {filters.from && <input type="hidden" name="from" value={filters.from} />}
              {filters.to && <input type="hidden" name="to" value={filters.to} />}
              <label>
                표시 개수
                <select name="pageSize" defaultValue={String(filters.pageSize)}>
                  <option value="20">20개</option>
                  <option value="40">40개</option>
                  <option value="60">60개</option>
                  <option value="80">80개</option>
                  <option value="100">100개</option>
                  <option value="all">전체</option>
                </select>
              </label>
              <button className="button secondary" type="submit">
                적용
              </button>
            </form>
            <div className="page-links">
              {result.page > 1 && (
                <Link href={queryString(filters, { page: result.page - 1 })} aria-label="이전 페이지">
                  이전
                </Link>
              )}
              {pageNumbers.map((page) =>
                page === result.page ? (
                  <strong className="current" aria-current="page" key={page}>
                    {page}
                  </strong>
                ) : (
                  <Link href={queryString(filters, { page })} key={page}>
                    {page}
                  </Link>
                )
              )}
              {result.page < result.totalPages && (
                <Link href={queryString(filters, { page: result.page + 1 })} aria-label="다음 페이지">
                  다음
                </Link>
              )}
            </div>
            <span className="page-summary">
              총 {result.total}건 · {result.page} / {result.totalPages} 페이지
            </span>
          </nav>
        )}
      </div>
    </>
  );
}
