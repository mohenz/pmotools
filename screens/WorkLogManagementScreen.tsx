import Link from "next/link";
import { ClickableTableRow } from "@/components/ClickableTableRow";
import { WORK_LOG_STATUSES, workLogStatusLabel } from "@/lib/domain/work-logs";
import type { getWorkLogManagementOptions, WorkLogListResult } from "@/lib/server/work-logs";

type Filters = { q: string; dateFrom: string; dateTo: string; groupId: string; assigneeId: string; status: string; page: number; pageSize: number | "all" };
type Options = Awaited<ReturnType<typeof getWorkLogManagementOptions>>;

function queryString(filters: Filters, overrides: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...overrides }).forEach(([key, value]) => { if (value !== "" && value != null && !(key === "page" && value === 1) && !(key === "pageSize" && value === 20)) params.set(key, String(value)); });
  return params.toString();
}

export function WorkLogManagementScreen({ result, options, filters }: { result: WorkLogListResult; options: Options; filters: Filters }) {
  const pageLinkCount = Math.min(10, result.totalPages);
  const firstPage = Math.max(1, Math.min(result.page - 4, result.totalPages - pageLinkCount + 1));
  const pageNumbers = Array.from({ length: pageLinkCount }, (_, index) => firstPage + index);
  return <>
    <header className="topbar"><div><h1>업무일지 관리</h1><p>총 {result.total}건 · {options.manager ? "전체 업무그룹" : "담당 업무그룹"}의 업무일지를 조회합니다.</p></div></header>
    <div className="content">
      <form className="filters inline-filter work-log-filters" method="get">
        {filters.pageSize !== 20 && <input type="hidden" name="pageSize" value={String(filters.pageSize)} />}
        <input name="q" defaultValue={filters.q} placeholder="번호·WBS·업무내용 검색" aria-label="검색어" />
        <label>시작일<input type="date" name="dateFrom" defaultValue={filters.dateFrom} /></label>
        <label>종료일<input type="date" name="dateTo" defaultValue={filters.dateTo} /></label>
        <select name="groupId" defaultValue={filters.groupId} aria-label="업무그룹"><option value="">전체 업무그룹</option>{options.groups.map((group) => <option value={group.id} key={group.id}>{group.label}</option>)}</select>
        <select name="assigneeId" defaultValue={filters.assigneeId} aria-label="담당자"><option value="">전체 담당자</option>{options.assignees.map((user) => <option value={user.id} key={user.id}>{user.name} ({user.userId})</option>)}</select>
        <select name="status" defaultValue={filters.status} aria-label="진행상태"><option value="">전체 진행상태</option>{WORK_LOG_STATUSES.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}</select>
        <button className="button secondary" type="submit">조회</button><Link className="button ghost" href="/work-logs/manage">초기화</Link>
      </form>
      <section className="panel compact">{result.rows.length ? <div className="table-wrap"><table className="work-log-list-table"><thead><tr><th>번호</th><th>업무일자</th><th>업무그룹</th><th>담당자</th><th>WBS번호</th><th>진행상태</th><th>업무내용</th><th>최종수정</th></tr></thead><tbody>{result.rows.map((row) => <ClickableTableRow href={`/work-logs/${row.id}?from=manage`} ariaLabel={`${row.displayId} 업무일지 상세보기`} key={row.id}><td className="mono"><Link className="table-link" href={`/work-logs/${row.id}?from=manage`}>{row.displayId}</Link></td><td>{row.workDate}</td><td>{row.groupLabel}</td><td>{row.assigneeName}</td><td className="mono">{row.wbsNumber || "-"}</td><td><span className={`badge ${row.status === "COMPLETED" ? "band-green" : "band-yellow"}`}>{workLogStatusLabel(row.status)}</span></td><td className="title-cell work-log-content-cell">{row.workContent}</td><td>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(row.updatedAt))}</td></ClickableTableRow>)}</tbody></table></div> : <div className="empty">조건에 맞는 업무일지가 없습니다.</div>}</section>
      {result.total > 0 && <nav className="pagination requirement-pagination" aria-label="페이지 이동"><form className="page-size-form" method="get">{filters.q && <input type="hidden" name="q" value={filters.q} />}{filters.dateFrom && <input type="hidden" name="dateFrom" value={filters.dateFrom} />}{filters.dateTo && <input type="hidden" name="dateTo" value={filters.dateTo} />}{filters.groupId && <input type="hidden" name="groupId" value={filters.groupId} />}{filters.assigneeId && <input type="hidden" name="assigneeId" value={filters.assigneeId} />}{filters.status && <input type="hidden" name="status" value={filters.status} />}<label>표시 개수<select name="pageSize" defaultValue={String(filters.pageSize)}><option value="20">20개</option><option value="40">40개</option><option value="60">60개</option><option value="80">80개</option><option value="100">100개</option><option value="all">전체</option></select></label><button className="button secondary" type="submit">적용</button></form><div className="page-links">{result.page > 1 && <Link href={`/work-logs/manage?${queryString(filters, { page: result.page - 1 })}`} aria-label="이전 페이지">이전</Link>}{pageNumbers.map((page) => page === result.page ? <strong className="current" aria-current="page" key={page}>{page}</strong> : <Link href={`/work-logs/manage?${queryString(filters, { page })}`} key={page}>{page}</Link>)}{result.page < result.totalPages && <Link href={`/work-logs/manage?${queryString(filters, { page: result.page + 1 })}`} aria-label="다음 페이지">다음</Link>}</div><span className="page-summary">총 {result.total}건 · {result.page} / {result.totalPages} 페이지</span></nav>}
    </div>
  </>;
}
