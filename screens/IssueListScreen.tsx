import Link from "next/link";
import { probabilityLabel } from "@/lib/domain/levels";
import { issueStatuses, issueStatusLabel } from "@/lib/domain/issues";
import type { CommonCode } from "@/lib/server/common-codes";
import type { IssueFilters, IssueRow } from "@/lib/server/issues";

type Filters = Required<Pick<IssueFilters, "q" | "categoryCodeId" | "status" | "importance" | "priority" | "page">> & { escalated: string; pageSize: number | "all" };
type Result = { issues: IssueRow[]; total: number; page: number; pageSize: number; totalPages: number };

function queryString(filters: Filters, overrides: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...overrides }).forEach(([key, value]) => {
    if (value !== "" && value != null && !(key === "page" && value === 1) && !(key === "pageSize" && value === 20)) params.set(key, String(value));
  });
  return params.toString();
}

export function IssueListScreen({ result, filters, options }: { result: Result; filters: Filters; options: { issueTypes: CommonCode[] } }) {
  const pageLinkCount = Math.min(10, result.totalPages);
  const firstPage = Math.max(1, Math.min(result.page - 4, result.totalPages - pageLinkCount + 1));
  const pageNumbers = Array.from({ length: pageLinkCount }, (_, index) => firstPage + index);
  return <>
    <header className="topbar"><div><h1>이슈 관리</h1><p>총 {result.total}건</p></div></header>
    <div className="content">
      <form className="filters" method="get">
        {filters.pageSize !== 20 && <input type="hidden" name="pageSize" value={String(filters.pageSize)} />}
        <input name="q" defaultValue={filters.q} placeholder="이슈명·내용·담당자 검색" aria-label="검색어" />
        <select name="categoryCodeId" defaultValue={filters.categoryCodeId} aria-label="이슈구분"><option value="">전체 구분</option>{options.issueTypes.map((code) => <option key={code.id} value={code.id}>{code.label}</option>)}</select>
        <select name="status" defaultValue={filters.status} aria-label="상태"><option value="">전체 상태</option>{issueStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
        <select name="importance" defaultValue={filters.importance} aria-label="중요도"><option value="">전체 중요도</option><option value="high">상</option><option value="medium">중</option><option value="low">하</option></select>
        <select name="priority" defaultValue={filters.priority} aria-label="우선순위"><option value="">전체 우선순위</option><option value="high">상</option><option value="medium">중</option><option value="low">하</option></select>
        <select name="escalated" defaultValue={filters.escalated} aria-label="에스컬레이션여부"><option value="">전체</option><option value="true">수행</option><option value="false">미수행</option></select>
        <button className="button secondary" type="submit">조회</button>
        <Link className="button primary filter-primary-action" href="/issues/new">+ 신규 등록</Link>
      </form>
      <section className="panel compact">{result.issues.length ? <IssueTable issues={result.issues} /> : <div className="empty">조건에 맞는 이슈가 없습니다.</div>}</section>
      {result.total > 0 && <nav className="pagination" aria-label="페이지 이동">
        <form className="page-size-form" method="get">
          {filters.q && <input type="hidden" name="q" value={filters.q} />}
          {filters.categoryCodeId && <input type="hidden" name="categoryCodeId" value={filters.categoryCodeId} />}
          {filters.status && <input type="hidden" name="status" value={filters.status} />}
          {filters.importance && <input type="hidden" name="importance" value={filters.importance} />}
          {filters.priority && <input type="hidden" name="priority" value={filters.priority} />}
          {filters.escalated && <input type="hidden" name="escalated" value={filters.escalated} />}
          <label>표시 개수<select name="pageSize" defaultValue={String(filters.pageSize)}><option value="20">20개</option><option value="40">40개</option><option value="60">60개</option><option value="80">80개</option><option value="100">100개</option><option value="all">전체</option></select></label>
          <button className="button secondary" type="submit">적용</button>
        </form>
        <div className="page-links">
          {result.page > 1 && <Link href={`/issues?${queryString(filters, { page: result.page - 1 })}`} aria-label="이전 페이지">이전</Link>}
          {pageNumbers.map((page) => page === result.page ? <strong className="current" aria-current="page" key={page}>{page}</strong> : <Link href={`/issues?${queryString(filters, { page })}`} key={page}>{page}</Link>)}
          {result.page < result.totalPages && <Link href={`/issues?${queryString(filters, { page: result.page + 1 })}`} aria-label="다음 페이지">다음</Link>}
        </div>
        <span className="page-summary">총 {result.total}건 · {result.page} / {result.totalPages} 페이지</span>
      </nav>}
    </div>
  </>;
}

function IssueTable({ issues }: { issues: IssueRow[] }) {
  return <div className="table-wrap"><table className="issue-table"><thead><tr>
    <th>SEQ</th><th>이슈구분</th><th>이슈명</th><th>이슈내용</th><th>중요도</th><th>우선순위</th><th>상태</th><th>발생일자</th><th>해결기한</th><th>담당자</th>
  </tr></thead>
    <tbody>{issues.map((issue) => <tr key={issue.id}>
      <td className="mono"><Link className="table-link" href={`/issues/${issue.id}`}>{issue.seq}</Link></td>
      <td>{issue.categoryLabel}</td>
      <td className="wrap-cell"><Link className="table-link" href={`/issues/${issue.id}`}>{issue.title}</Link></td>
      <td className="wrap-cell">{issue.description || "-"}</td>
      <td>{probabilityLabel(issue.importance)}</td>
      <td>{probabilityLabel(issue.priority)}</td>
      <td><span className={`badge status-${issue.status.toLowerCase()}`}>{issueStatusLabel(issue.status)}</span></td>
      <td>{issue.occurredAt.slice(0, 10)}</td>
      <td>{issue.dueAt ? issue.dueAt.slice(0, 10) : "-"}</td>
      <td>{issue.ownerName ?? "-"}</td>
    </tr>)}</tbody></table></div>;
}
