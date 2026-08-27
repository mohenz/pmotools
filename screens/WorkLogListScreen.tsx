import Link from "next/link";
import { WORK_LOG_STATUSES, workLogStatusLabel } from "@/lib/domain/work-logs";
import type { getWorkLogIdentity, WorkLogListResult } from "@/lib/server/work-logs";

type Filters = { q: string; dateFrom: string; dateTo: string; groupId: string; assigneeId: string; status: string; page: number };
function href(filters: Filters, page: number) { const p = new URLSearchParams(); Object.entries({ ...filters, page }).forEach(([key, value]) => { if (value && !(key === "page" && value === 1)) p.set(key, String(value)); }); return `/work-logs?${p}`; }

type Identity = Awaited<ReturnType<typeof getWorkLogIdentity>>;

export function WorkLogListScreen({ result, filters, identity }: { result: WorkLogListResult; filters: Filters; identity: Identity }) {
  return <><header className="topbar"><div><h1>업무일지</h1><p>총 {result.total}건 · 작업자별 일일 업무내용</p></div><Link className="button primary" href="/work-logs/new">+ 업무일지 작성</Link></header><div className="content">
    <div className="work-log-fixed-identity panel compact"><div><span>담당자</span><strong>{identity.name} ({identity.loginId})</strong></div><div><span>업무그룹</span><strong>{identity.group?.label ?? "미지정"}</strong></div></div>
    <form className="filters inline-filter work-log-filters" method="get"><input name="q" defaultValue={filters.q} placeholder="번호·WBS·업무내용 검색" aria-label="검색어" /><label>시작일<input type="date" name="dateFrom" defaultValue={filters.dateFrom} /></label><label>종료일<input type="date" name="dateTo" defaultValue={filters.dateTo} /></label><select name="status" defaultValue={filters.status} aria-label="진행상태"><option value="">전체 진행상태</option>{WORK_LOG_STATUSES.map((s) => <option value={s.value} key={s.value}>{s.label}</option>)}</select><button className="button secondary">조회</button><Link className="button ghost" href="/work-logs">초기화</Link></form>
    <section className="panel compact">{result.rows.length ? <div className="table-wrap"><table className="work-log-list-table"><thead><tr><th>번호</th><th>업무일자</th><th>업무그룹</th><th>담당자</th><th>WBS번호</th><th>진행상태</th><th>업무내용</th><th>최종수정</th></tr></thead><tbody>{result.rows.map((row) => <tr key={row.id}><td className="mono"><Link className="table-link" href={`/work-logs/${row.id}`}>{row.displayId}</Link></td><td>{row.workDate}</td><td>{row.groupLabel}</td><td>{row.assigneeName}</td><td className="mono">{row.wbsNumber || "-"}</td><td><span className={`badge ${row.status === "COMPLETED" ? "band-green" : "band-yellow"}`}>{workLogStatusLabel(row.status)}</span></td><td className="title-cell work-log-content-cell">{row.workContent}</td><td>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(row.updatedAt))}</td></tr>)}</tbody></table></div> : <div className="empty">조건에 맞는 업무일지가 없습니다.</div>}</section>
    {result.totalPages > 1 && <nav className="pagination" aria-label="페이지 이동">{result.page > 1 ? <Link href={href(filters, result.page - 1)}>이전</Link> : <span />}<strong>{result.page} / {result.totalPages}</strong>{result.page < result.totalPages ? <Link href={href(filters, result.page + 1)}>다음</Link> : <span />}</nav>}
  </div></>;
}
