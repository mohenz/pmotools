// [WBS2 복사본] 원본: screens/RequirementListScreen.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import Link from "next/link";
import { ClickableTableRow } from "@/components/ClickableTableRow";
import { acceptanceLabels, acceptanceLabel } from "@/lib/domain/requirements";
import { probabilities, probabilityLabel } from "@/lib/domain/levels";
import type { RequirementRow } from "@/lib/server/mp/requirements";
import type { CommonCode } from "@/lib/server/common-codes";

type Filters = { q: string; acceptanceStatus: string; divisionCodeId: string; priority: string; importance: string; pageSize: number | "all"; page: number; projectCode?: string };
// 최상위 프로젝트 통합 조회일 때만 전달(2026-09-30) — 프로젝트 열·프로젝트 필터 표시, 신규 등록 숨김. 구분 필터 값은 코드 id 대신 이름.
type TopLevel = { projects: { id: string; code: string; name: string }[] };
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

export function RequirementListScreen({ result, filters, divisions, isManager, topLevel }: { result: Result; filters: Filters; divisions: CommonCode[]; isManager: boolean; topLevel?: TopLevel }) {
  const projectCodeById = new Map(topLevel?.projects.map((project) => [project.id, project.code]) ?? []);
  const pageLinkCount = Math.min(10, result.totalPages);
  const firstPage = Math.max(1, Math.min(result.page - 4, result.totalPages - pageLinkCount + 1));
  const pageNumbers = Array.from({ length: pageLinkCount }, (_, index) => firstPage + index);
  return <>
    <header className="topbar"><div><h1>요구사항정의서</h1><p>총 {result.total}건{topLevel && ` · 최상위 통합 조회(${topLevel.projects.length}개 프로젝트) · 등록은 하위 프로젝트를 선택해서`}</p></div></header>
    <div className="content">
      <form className="filters requirement-filter-panel" method="get">
        {filters.pageSize !== 20 && <input type="hidden" name="pageSize" value={String(filters.pageSize)} />}
        {topLevel && <select name="projectCode" defaultValue={filters.projectCode ?? ""} aria-label="프로젝트"><option value="">전체 프로젝트</option>{topLevel.projects.map((project) => <option value={project.code} key={project.code}>{project.name} ({project.code})</option>)}</select>}
        <input name="q" defaultValue={filters.q} placeholder="요구사항 ID·요구사항명 검색" aria-label="검색어" />
        <select name="acceptanceStatus" defaultValue={filters.acceptanceStatus} aria-label="수용여부"><option value="">전체 상태</option>{Object.entries(acceptanceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        <select name="divisionCodeId" defaultValue={filters.divisionCodeId} aria-label="요구사항구분"><option value="">전체 구분</option>{divisions.map((code) => <option value={code.id} key={code.id}>{code.label}</option>)}</select>
        <select name="priority" defaultValue={filters.priority} aria-label="우선순위"><option value="">전체 우선순위</option>{probabilities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
        <select name="importance" defaultValue={filters.importance} aria-label="중요도"><option value="">전체 중요도</option>{probabilities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
        <button className="button secondary" type="submit">조회</button>
        {isManager && !topLevel && <Link className="button primary filter-primary-action" href="/mp-requirements/new">+ 신규 등록</Link>}
      </form>
      <section className="panel compact">
        {result.requirements.length ? <div className="table-wrap"><table>
          <thead><tr>{topLevel && <th>프로젝트</th>}<th>요구사항 ID</th><th>요구사항명</th><th>업무분류</th><th>담당자</th><th>요구사항구분</th><th>요청부서</th><th>등록일자</th><th>중요도</th><th>우선순위</th><th>수용여부</th><th>확정후추가</th><th>변경관리</th><th>최종갱신</th></tr></thead>
          <tbody>{result.requirements.map((row) => <ClickableTableRow href={`/mp-requirements/${row.id}`} ariaLabel={`${row.requirementId || row.title} 요구사항 상세보기`} key={row.id}>
            {topLevel && <td className="mono">{projectCodeById.get(row.projectId) ?? "-"}</td>}
            <td className="mono requirement-id"><Link className="table-link" href={`/mp-requirements/${row.id}`}>{row.requirementId || "-"}</Link></td>
            <td className="title-cell"><Link className="table-link" href={`/mp-requirements/${row.id}`}>{row.title}</Link></td>
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
          {filters.projectCode && <input type="hidden" name="projectCode" value={filters.projectCode} />}
          {filters.q && <input type="hidden" name="q" value={filters.q} />}
          {filters.acceptanceStatus && <input type="hidden" name="acceptanceStatus" value={filters.acceptanceStatus} />}
          {filters.divisionCodeId && <input type="hidden" name="divisionCodeId" value={filters.divisionCodeId} />}
          {filters.priority && <input type="hidden" name="priority" value={filters.priority} />}
          {filters.importance && <input type="hidden" name="importance" value={filters.importance} />}
          <label>표시 개수<select name="pageSize" defaultValue={String(filters.pageSize)}><option value="20">20개</option><option value="40">40개</option><option value="60">60개</option><option value="80">80개</option><option value="100">100개</option><option value="all">전체</option></select></label>
          <button className="button secondary" type="submit">적용</button>
        </form>
        <div className="page-links">
          {result.page > 1 && <Link href={`/mp-requirements?${queryString(filters, { page: result.page - 1 })}`} aria-label="이전 페이지">이전</Link>}
          {pageNumbers.map((page) => page === result.page ? <strong className="current" aria-current="page" key={page}>{page}</strong> : <Link href={`/mp-requirements?${queryString(filters, { page })}`} key={page}>{page}</Link>)}
          {result.page < result.totalPages && <Link href={`/mp-requirements?${queryString(filters, { page: result.page + 1 })}`} aria-label="다음 페이지">다음</Link>}
        </div>
        <span className="page-summary">총 {result.total}건 · {result.page} / {result.totalPages} 페이지</span>
      </nav>}
    </div>
  </>;
}
