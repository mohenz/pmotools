import Link from "next/link";
import { acceptanceLabels, acceptanceLabel } from "@/lib/domain/requirements";
import { probabilities, probabilityLabel } from "@/lib/domain/items";
import type { RequirementRow } from "@/lib/server/requirements";
import type { CommonCode } from "@/lib/server/common-codes";

type Filters = { q: string; acceptanceStatus: string; divisionCodeId: string; priority: string; importance: string; page: number };
type Result = { requirements: RequirementRow[]; total: number; page: number; pageSize: number; totalPages: number };

function queryString(filters: Filters, overrides: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...overrides }).forEach(([key, value]) => {
    if (value !== "" && value != null && !(key === "page" && value === 1)) params.set(key, String(value));
  });
  return params.toString();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(value));
}

export function RequirementListScreen({ result, filters, divisions, isManager }: { result: Result; filters: Filters; divisions: CommonCode[]; isManager: boolean }) {
  return <>
    <header className="topbar"><div><h1>요구사항정의서</h1><p>총 {result.total}건</p></div><div className="topbar-actions">{isManager && <Link className="button primary" href="/requirements/new">+ 신규 등록</Link>}</div></header>
    <div className="content">
      <form className="filters" method="get">
        <input name="q" defaultValue={filters.q} placeholder="관리번호·요구사항명·내용 검색" aria-label="검색어" />
        <select name="acceptanceStatus" defaultValue={filters.acceptanceStatus} aria-label="수용여부"><option value="">전체 상태</option>{Object.entries(acceptanceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        <select name="divisionCodeId" defaultValue={filters.divisionCodeId} aria-label="요구사항구분"><option value="">전체 구분</option>{divisions.map((code) => <option value={code.id} key={code.id}>{code.label}</option>)}</select>
        <select name="priority" defaultValue={filters.priority} aria-label="우선순위"><option value="">전체 우선순위</option>{probabilities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
        <select name="importance" defaultValue={filters.importance} aria-label="중요도"><option value="">전체 중요도</option>{probabilities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
        <button className="button secondary" type="submit">조회</button>
      </form>
      <section className="panel compact">
        {result.requirements.length ? <div className="table-wrap"><table>
          <thead><tr><th>관리번호</th><th>요구사항명</th><th>담당자</th><th>요구사항구분</th><th>요청부서</th><th>우선순위</th><th>중요도</th><th>수용여부</th><th>변경관리</th><th>최종갱신</th></tr></thead>
          <tbody>{result.requirements.map((row) => <tr key={row.id}>
            <td className="mono"><Link className="table-link" href={`/requirements/${row.id}`}>{row.displayId}</Link></td>
            <td className="title-cell"><Link className="table-link" href={`/requirements/${row.id}`}>{row.title}</Link></td>
            <td>{row.ownerName ?? "-"}</td>
            <td>{row.divisionLabel ?? "-"}</td>
            <td>{row.requestDepartment || "-"}</td>
            <td>{row.priority ? probabilityLabel(row.priority) : "-"}</td>
            <td>{row.importance ? probabilityLabel(row.importance) : "-"}</td>
            <td><span className={`badge ${row.acceptanceStatus}`}>{acceptanceLabel(row.acceptanceStatus)}</span></td>
            <td>{row.changeCount > 0 ? <span className="badge risk">{row.changeCount}건</span> : "-"}</td>
            <td>{formatDate(row.updatedAt)}</td>
          </tr>)}</tbody>
        </table></div> : <div className="empty">등록된 요구사항이 없습니다.</div>}
      </section>
      {result.totalPages > 1 && <nav className="pagination" aria-label="페이지 이동">
        {result.page > 1 ? <Link href={`/requirements?${queryString(filters, { page: result.page - 1 })}`}>이전</Link> : <span />}
        <strong>{result.page} / {result.totalPages}</strong>
        {result.page < result.totalPages ? <Link href={`/requirements?${queryString(filters, { page: result.page + 1 })}`}>다음</Link> : <span />}
      </nav>}
    </div>
  </>;
}
