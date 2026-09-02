import Link from "next/link";
import { ClickableTableRow } from "@/components/ClickableTableRow";
import { acceptanceLabels, acceptanceLabel } from "@/lib/domain/requirements";
import { probabilities, probabilityLabel } from "@/lib/domain/items";
import type { RequirementRow } from "@/lib/server/requirements";
import type { CommonCode } from "@/lib/server/common-codes";

type Filters = { q: string; acceptanceStatus: string; divisionCodeId: string; priority: string; importance: string; pageSize: number | "all"; page: number };
type Result = { requirements: RequirementRow[]; total: number; page: number; pageSize: number; totalPages: number };

function queryString(filters: Filters, overrides: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...overrides }).forEach(([key, value]) => {
    if (value !== "" && value != null && !(key === "page" && value === 1) && !(key === "pageSize" && value === 20)) params.set(key, String(value));
  });
  return params.toString();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(value));
}

export function RequirementListScreen({ result, filters, divisions, isManager }: { result: Result; filters: Filters; divisions: CommonCode[]; isManager: boolean }) {
  const pageLinkCount = Math.min(10, result.totalPages);
  const firstPage = Math.max(1, Math.min(result.page - 4, result.totalPages - pageLinkCount + 1));
  const pageNumbers = Array.from({ length: pageLinkCount }, (_, index) => firstPage + index);
  return <>
    <header className="topbar"><div><h1>요구사항정의서</h1><p>총 {result.total}건</p></div></header>
    <div className="content">
      <form className="filters requirement-filter-panel" method="get">
        {filters.pageSize !== 20 && <input type="hidden" name="pageSize" value={String(filters.pageSize)} />}
        <input name="q" defaultValue={filters.q} placeholder="요구사항 ID·요구사항명 검색" aria-label="검색어" />
        <select name="acceptanceStatus" defaultValue={filters.acceptanceStatus} aria-label="수용여부"><option value="">전체 상태</option>{Object.entries(acceptanceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        <select name="divisionCodeId" defaultValue={filters.divisionCodeId} aria-label="요구사항구분"><option value="">전체 구분</option>{divisions.map((code) => <option value={code.id} key={code.id}>{code.label}</option>)}</select>
        <select name="priority" defaultValue={filters.priority} aria-label="우선순위"><option value="">전체 우선순위</option>{probabilities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
        <select name="importance" defaultValue={filters.importance} aria-label="중요도"><option value="">전체 중요도</option>{probabilities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
        <button className="button secondary" type="submit">조회</button>
        {isManager && <Link className="button primary filter-primary-action" href="/requirements/new">+ 신규 등록</Link>}
      </form>
      <section className="panel compact">
        {result.requirements.length ? <div className="table-wrap"><table>
          <thead><tr><th>요구사항 ID</th><th>요구사항명</th><th>업무분류</th><th>담당자</th><th>요구사항구분</th><th>요청부서</th><th>등록일자</th><th>중요도</th><th>우선순위</th><th>수용여부</th><th>확정후추가</th><th>변경관리</th><th>최종갱신</th></tr></thead>
          <tbody>{result.requirements.map((row) => <ClickableTableRow href={`/requirements/${row.id}`} ariaLabel={`${row.requirementId || row.title} 요구사항 상세보기`} key={row.id}>
            <td className="mono requirement-id"><Link className="table-link" href={`/requirements/${row.id}`}>{row.requirementId || "-"}</Link></td>
            <td className="title-cell"><Link className="table-link" href={`/requirements/${row.id}`}>{row.title}</Link></td>
            <td>{[row.businessMajorCategory, row.businessMiddleCategory, row.businessMinorCategory].filter(Boolean).join(" › ") || "-"}</td>
            <td>{row.ownerName ?? "-"}</td>
            <td>{row.divisionLabel ?? "-"}</td>
            <td>{row.requestDepartment || "-"}</td>
            <td>{row.registrationDate ? formatDate(row.registrationDate) : "-"}</td>
            <td>{row.importance ? probabilityLabel(row.importance) : "-"}</td>
            <td>{row.priority ? probabilityLabel(row.priority) : "-"}</td>
            <td><span className={`badge ${row.acceptanceStatus}`}>{acceptanceLabel(row.acceptanceStatus)}</span></td>
            <td>{row.addedAfterConfirmation === null ? "-" : row.addedAfterConfirmation ? "예" : "아니요"}</td>
            <td>{row.changeCount > 0 ? <span className="badge risk">{row.changeCount}건</span> : "-"}</td>
            <td>{formatDate(row.updatedAt)}</td>
          </ClickableTableRow>)}</tbody>
        </table></div> : <div className="empty">등록된 요구사항이 없습니다.</div>}
      </section>
      {result.total > 0 && <nav className="pagination requirement-pagination" aria-label="페이지 이동">
        <form className="page-size-form" method="get">
          {filters.q && <input type="hidden" name="q" value={filters.q} />}
          {filters.acceptanceStatus && <input type="hidden" name="acceptanceStatus" value={filters.acceptanceStatus} />}
          {filters.divisionCodeId && <input type="hidden" name="divisionCodeId" value={filters.divisionCodeId} />}
          {filters.priority && <input type="hidden" name="priority" value={filters.priority} />}
          {filters.importance && <input type="hidden" name="importance" value={filters.importance} />}
          <label>표시 개수<select name="pageSize" defaultValue={String(filters.pageSize)}><option value="20">20개</option><option value="40">40개</option><option value="60">60개</option><option value="80">80개</option><option value="100">100개</option><option value="all">전체</option></select></label>
          <button className="button secondary" type="submit">적용</button>
        </form>
        <div className="page-links">
          {result.page > 1 && <Link href={`/requirements?${queryString(filters, { page: result.page - 1 })}`} aria-label="이전 페이지">이전</Link>}
          {pageNumbers.map((page) => page === result.page ? <strong className="current" aria-current="page" key={page}>{page}</strong> : <Link href={`/requirements?${queryString(filters, { page })}`} key={page}>{page}</Link>)}
          {result.page < result.totalPages && <Link href={`/requirements?${queryString(filters, { page: result.page + 1 })}`} aria-label="다음 페이지">다음</Link>}
        </div>
        <span className="page-summary">총 {result.total}건 · {result.page} / {result.totalPages} 페이지</span>
      </nav>}
    </div>
  </>;
}
