import Link from "next/link";
import { MeetingActionStatusControl } from "@/features/meeting-minutes/MeetingActionStatusControl";
import { MEETING_ACTION_STATUSES } from "@/lib/domain/meeting-action-items";
import type { MeetingActionItemListResult } from "@/lib/server/meeting-action-items";

export type MeetingActionItemScreenFilters = { status: string; overdue: boolean; mine: boolean; assignee: string; q: string; dateFrom: string; dateTo: string };

const dot = (value: string | null) => (value ? value.replaceAll("-", ".") : "-");
const dateTime = (value: string) => new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));

function href(filters: MeetingActionItemScreenFilters, patch: Partial<MeetingActionItemScreenFilters> & { page?: number } = {}) {
  const merged = { ...filters, ...patch };
  const params = new URLSearchParams();
  for (const key of ["status", "assignee", "q", "dateFrom", "dateTo"] as const) if (merged[key]) params.set(key, merged[key]);
  if (merged.overdue) params.set("overdue", "y");
  if (merged.mine) params.set("mine", "y");
  if (patch.page && patch.page > 1) params.set("page", String(patch.page));
  const query = params.toString();
  return query ? `/meeting-minutes/action-items?${query}` : "/meeting-minutes/action-items";
}

export function MeetingActionItemListScreen({ result, filters, today }: { result: MeetingActionItemListResult; filters: MeetingActionItemScreenFilters; today: string }) {
  const { summary } = result;
  const pageLinkCount = Math.min(10, result.totalPages);
  const firstPage = Math.max(1, Math.min(result.page - 4, result.totalPages - pageLinkCount + 1));
  const pageNumbers = Array.from({ length: pageLinkCount }, (_, index) => firstPage + index);
  const filtered = Boolean(filters.status || filters.overdue || filters.mine || filters.assignee || filters.q || filters.dateFrom || filters.dateTo);
  const kpis = [
    { key: "all", label: "전체", value: summary.total, to: href(filters, { status: "", overdue: false }), active: !filters.status && !filters.overdue },
    ...MEETING_ACTION_STATUSES.map((status) => ({ key: status.value, label: status.label, value: summary[status.value], to: href(filters, { status: status.value, overdue: false }), active: filters.status === status.value && !filters.overdue })),
    { key: "overdue", label: "기한 경과", value: summary.overdue, to: href(filters, { status: "", overdue: true }), active: filters.overdue && !filters.status, critical: summary.overdue > 0 },
  ];
  return <>
    <header className="topbar"><div><h1>회의록 Action Item</h1><p>{today} 기준 · 회의록에서 등록한 Action Item 모아보기 · 조건 결과 {result.total}건</p></div></header>
    <div className="content">
      <div className="kpi-grid action-kpis">{kpis.map((kpi) => <Link className={`kpi${kpi.active ? " active" : ""}`} href={kpi.to} key={kpi.key} aria-current={kpi.active ? "true" : undefined}>
        <span>{kpi.label}</span><strong className={"critical" in kpi && kpi.critical ? "critical" : ""}>{kpi.value}</strong>
      </Link>)}</div>

      <form className="filters inline-filter pmo-list-filters" method="get">
        <label>상태<select name="status" defaultValue={filters.status}>
          <option value="">전체</option><option value="open">미완료(완료 제외)</option>
          {MEETING_ACTION_STATUSES.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}
        </select></label>
        <label>담당자<input name="assignee" defaultValue={filters.assignee} placeholder="이름" /></label>
        <label>회의일 시작<input type="date" name="dateFrom" defaultValue={filters.dateFrom} /></label>
        <label>회의일 종료<input type="date" name="dateTo" defaultValue={filters.dateTo} /></label>
        <label>검색<input name="q" defaultValue={filters.q} placeholder="Action Item·내용·회의 안건·번호" /></label>
        <label className="checkbox-inline"><input type="checkbox" name="mine" value="y" defaultChecked={filters.mine} /> 내 담당만</label>
        <label className="checkbox-inline"><input type="checkbox" name="overdue" value="y" defaultChecked={filters.overdue} /> 기한 경과만</label>
        <button className="button secondary" type="submit">조회</button>
        {filtered && <Link className="button ghost" href="/meeting-minutes/action-items">초기화</Link>}
      </form>

      <section className="panel compact">
        {result.rows.length ? <div className="table-wrap"><table className="action-item-table"><thead><tr><th>회의록</th><th>회의일</th><th>Action Item</th><th>내용</th><th>담당자</th><th>완료예정일</th><th>상태</th><th>최근 변경</th></tr></thead>
          <tbody>{result.rows.map((row) => <tr key={row.id} className={row.overdueDays ? "action-overdue" : undefined}>
            <td><Link className="table-link mono" href={`/meeting-minutes/${row.minuteId}`}>{row.minuteDisplayId}</Link><div className="action-minute-title">{row.minuteTitle}</div></td>
            <td className="mono">{dot(row.meetingDate)}</td>
            <td className="title-cell">{row.title || "-"}</td>
            <td className="action-content">{row.content || "-"}</td>
            <td>{row.assigneeName || "-"}</td>
            <td className="mono">{dot(row.dueDate)}{row.overdueDays > 0 && <span className="badge band-red pmo-dash-tag">기한 경과 {row.overdueDays}일</span>}</td>
            <td><MeetingActionStatusControl id={row.id} title={row.title || row.content || row.minuteTitle} status={row.status} /></td>
            <td className="action-changed">{row.statusChangedAt ? <>{dateTime(row.statusChangedAt)}<br />{row.statusChangerName ?? "-"}</> : "-"}</td>
          </tr>)}</tbody></table></div> : <div className="empty">조건에 맞는 Action Item이 없습니다.</div>}
      </section>
      {result.totalPages > 1 && <nav className="pagination" aria-label="페이지 이동"><div className="page-links">
        {result.page > 1 && <Link href={href(filters, { page: result.page - 1 })} aria-label="이전 페이지">이전</Link>}
        {pageNumbers.map((page) => page === result.page ? <strong className="current" aria-current="page" key={page}>{page}</strong> : <Link href={href(filters, { page })} key={page}>{page}</Link>)}
        {result.page < result.totalPages && <Link href={href(filters, { page: result.page + 1 })} aria-label="다음 페이지">다음</Link>}
      </div><span className="page-summary">총 {result.total}건 · {result.page} / {result.totalPages} 페이지</span></nav>}
    </div>
  </>;
}
