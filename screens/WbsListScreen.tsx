import Link from "next/link";
import { sortKeyFromCode } from "@/lib/domain/wbs";
import { WBS_EXCEL_HEADERS as HEADERS } from "@/lib/server/wbs";
import type { WbsExcelListResult } from "@/lib/server/wbs";

type Filters = { page: number; pageSize: number | "all"; q: string; assignee: string };
function queryString(filters: Filters, overrides: Record<string, string | number | undefined> = {}) { const p = new URLSearchParams(); Object.entries({ ...filters, ...overrides }).forEach(([key, value]) => { if (value != null && value !== "" && !(key === "page" && value === 1) && !(key === "pageSize" && value === 20)) p.set(key, String(value)); }); return p.toString(); }

const dot = (value: string | null) => (value ? value.replaceAll("-", ".") : "");
const pct = (value: number | null) => (value === null ? "" : `${Math.round(value * 100)}%`);

export function WbsListScreen({ result, filters }: { result: WbsExcelListResult; filters: Filters }) {
  const pageLinkCount = Math.min(10, result.totalPages);
  const firstPage = Math.max(1, Math.min(result.page - 4, result.totalPages - pageLinkCount + 1));
  const pageNumbers = Array.from({ length: pageLinkCount }, (_, index) => firstPage + index);
  return <>
    <header className="topbar"><div><h1>WBS</h1><p>총 {result.total}건 · 엑셀 원본 47개 컬럼</p></div><div className="topbar-actions"><Link className="button primary" href="/wbs/new">+ 신규 등록</Link></div></header>
    <div className="content">
      <section className="panel compact">
        <form className="filters inline-filter" method="get">
          {filters.pageSize !== 20 && <input type="hidden" name="pageSize" value={String(filters.pageSize)} />}
          <input name="q" defaultValue={filters.q} placeholder="Task 코드·이름 검색" aria-label="Task 검색" />
          <input name="assignee" defaultValue={filters.assignee} placeholder="담당자 검색" aria-label="담당자 검색" />
          <button className="button secondary" type="submit">조회</button>
          <Link className="button ghost" href="/wbs">초기화</Link>
        </form>
      </section>
      <section className="panel compact">
        {result.rows.length ? <div className="table-wrap"><table><thead><tr>{HEADERS.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{result.rows.map((item) => <tr key={item.id}>
            <td>{item.level}</td>
            <td className="mono">{sortKeyFromCode(item.code)}</td>
            <td>{item.projectCode}</td>
            <td>{item.configStatus}</td>
            <td>{item.stage ?? ""}</td>
            <td className="mono">{item.code}</td>
            <td className="title-cell"><Link className="table-link" href={`/wbs/${item.id}`}>{item.name}</Link></td>
            <td></td>
            <td>{item.isLeaf ? 1 : ""}</td>
            <td>{item.ownerName ?? ""}</td>
            <td>{item.groupLabel ?? ""}</td>
            <td>{dot(item.startDate)}</td>
            <td>{dot(item.dueDate)}</td>
            <td>{item.deliverable?.note ?? ""}</td>
            <td>{item.deliverable?.isOfficial ? "Y" : ""}</td>
            <td>{item.deliverable?.fileUrl ?? ""}</td>
            <td className="mono">{item.sequenceNo}</td>
            <td>{item.deliverable?.templateUrl ?? ""}</td>
            <td>{item.deliverable?.reviewerName ?? ""}</td>
            <td>{dot(item.deliverable?.reviewedAt ?? null)}</td>
            <td>{item.workingDays ?? ""}</td>
            <td>{item.weight ?? item.workingDays ?? ""}</td>
            <td>{item.workingDays ?? ""}</td>
            <td>{Math.round(item.actualProgress * 100)}</td>
            {item.roles.map((role) => <td key={`perm-${role.role}`}>{role.hasPermission ? 1 : ""}</td>)}
            {item.roles.map((role) => <td key={`pct-${role.role}`}>{role.progressPercent}</td>)}
            <td>{pct(item.plannedProgress)}</td>
            <td>{pct(item.actualProgress)}</td>
            <td>{pct(item.progressIndex)}</td>
          </tr>)}</tbody></table></div> : <div className="empty">등록된 WBS 항목이 없습니다.</div>}
      </section>
      {result.total > 0 && <nav className="pagination requirement-pagination" aria-label="페이지 이동"><form className="page-size-form" method="get">{filters.q && <input type="hidden" name="q" value={filters.q} />}{filters.assignee && <input type="hidden" name="assignee" value={filters.assignee} />}<label>표시 개수<select name="pageSize" defaultValue={String(filters.pageSize)}><option value="20">20개</option><option value="40">40개</option><option value="60">60개</option><option value="80">80개</option><option value="100">100개</option><option value="all">전체</option></select></label><button className="button secondary" type="submit">적용</button></form><div className="page-links">{result.page > 1 && <Link href={`/wbs?${queryString(filters, { page: result.page - 1 })}`} aria-label="이전 페이지">이전</Link>}{pageNumbers.map((page) => page === result.page ? <strong className="current" aria-current="page" key={page}>{page}</strong> : <Link href={`/wbs?${queryString(filters, { page })}`} key={page}>{page}</Link>)}{result.page < result.totalPages && <Link href={`/wbs?${queryString(filters, { page: result.page + 1 })}`} aria-label="다음 페이지">다음</Link>}</div><span className="page-summary">총 {result.total}건 · {result.page} / {result.totalPages} 페이지</span></nav>}
    </div>
  </>;
}
