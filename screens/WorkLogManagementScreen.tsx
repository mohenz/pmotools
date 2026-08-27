import Link from "next/link";
import { WORK_LOG_STATUSES, workLogStatusLabel } from "@/lib/domain/work-logs";
import type { getWorkLogManagementOptions, WorkLogListResult } from "@/lib/server/work-logs";

type Filters = { q: string; dateFrom: string; dateTo: string; groupId: string; assigneeId: string; status: string; page: number };
type Options = Awaited<ReturnType<typeof getWorkLogManagementOptions>>;

function pageHref(filters: Filters, page: number) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, page }).forEach(([key, value]) => { if (value && !(key === "page" && value === 1)) params.set(key, String(value)); });
  return `/work-logs/manage?${params}`;
}

export function WorkLogManagementScreen({ result, options, filters }: { result: WorkLogListResult; options: Options; filters: Filters }) {
  return <>
    <header className="topbar"><div><h1>업무일지 관리</h1><p>총 {result.total}건 · {options.manager ? "전체 업무그룹" : "담당 업무그룹"}의 업무일지를 조회합니다.</p></div></header>
    <div className="content">
      <form className="filters inline-filter work-log-filters" method="get">
        <input name="q" defaultValue={filters.q} placeholder="번호·WBS·업무내용 검색" aria-label="검색어" />
        <label>시작일<input type="date" name="dateFrom" defaultValue={filters.dateFrom} /></label>
        <label>종료일<input type="date" name="dateTo" defaultValue={filters.dateTo} /></label>
        <select name="groupId" defaultValue={filters.groupId} aria-label="업무그룹"><option value="">전체 업무그룹</option>{options.groups.map((group) => <option value={group.id} key={group.id}>{group.label}</option>)}</select>
        <select name="assigneeId" defaultValue={filters.assigneeId} aria-label="담당자"><option value="">전체 담당자</option>{options.assignees.map((user) => <option value={user.id} key={user.id}>{user.name} ({user.userId})</option>)}</select>
        <select name="status" defaultValue={filters.status} aria-label="진행상태"><option value="">전체 진행상태</option>{WORK_LOG_STATUSES.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}</select>
        <button className="button secondary" type="submit">조회</button><Link className="button ghost" href="/work-logs/manage">초기화</Link>
      </form>
      <section className="panel compact">{result.rows.length ? <div className="table-wrap"><table className="work-log-list-table"><thead><tr><th>번호</th><th>업무일자</th><th>업무그룹</th><th>담당자</th><th>WBS번호</th><th>진행상태</th><th>업무내용</th><th>최종수정</th></tr></thead><tbody>{result.rows.map((row) => <tr key={row.id}><td className="mono"><Link className="table-link" href={`/work-logs/${row.id}?from=manage`}>{row.displayId}</Link></td><td>{row.workDate}</td><td>{row.groupLabel}</td><td>{row.assigneeName}</td><td className="mono">{row.wbsNumber || "-"}</td><td><span className={`badge ${row.status === "COMPLETED" ? "band-green" : "band-yellow"}`}>{workLogStatusLabel(row.status)}</span></td><td className="title-cell work-log-content-cell">{row.workContent}</td><td>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(row.updatedAt))}</td></tr>)}</tbody></table></div> : <div className="empty">조건에 맞는 업무일지가 없습니다.</div>}</section>
      {result.totalPages > 1 && <nav className="pagination" aria-label="페이지 이동">{result.page > 1 ? <Link href={pageHref(filters, result.page - 1)}>이전</Link> : <span />}<strong>{result.page} / {result.totalPages}</strong>{result.page < result.totalPages ? <Link href={pageHref(filters, result.page + 1)}>다음</Link> : <span />}</nav>}
    </div>
  </>;
}
