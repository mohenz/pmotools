import Link from "next/link";
import { ClickableTableRow } from "@/components/ClickableTableRow";
import { sortKeyFromCode } from "@/lib/domain/wbs";
import { WBS_EXCEL_HEADERS as HEADERS, WBS_EXCEL_ROLE_NAMES } from "@/lib/server/wbs";
import type { WbsExcelListResult } from "@/lib/server/wbs";

// 목록 화면에서는 숨기되(엑셀 다운로드/업로드용 HEADERS 원본은 그대로 유지) — 입력 불필요 항목·역할별 권한/진도율 매트릭스는
// 목록을 지나치게 넓게 만들어 화면에서 뺀다(2026-09-04 사용자 요청).
const HIDDEN_HEADERS = new Set<string>([
  "사용자ID", "StartDate", "DueDate", "Deliverables(이슈 및 사유)",
  "공식여부(입력불필요)", "파일위치(입력불필요)", "트랜젝션코드(정렬SEQ)",
  "산출물템플릿(입력불필요)", "검수자(입력불필요)", "검수실행일(입력불필요)",
  "계산 가중치(입력불필요)", "가중치(입력불필요)", "Sort(Working Day)",
  ...WBS_EXCEL_ROLE_NAMES.map((role) => `${role}(진척등록권한)`),
  ...WBS_EXCEL_ROLE_NAMES.map((role) => `${role}(진도율)`),
]);

type Filters = {
  page: number; pageSize: number | "all"; q: string; assignee: string;
  startDate: string; dueDate: string; groupLabel: string; delayed: "" | "y" | "n";
  plannedMin?: number; actualMin?: number; progressMin?: number;
};
function queryString(filters: Filters, overrides: Record<string, string | number | undefined> = {}) { const p = new URLSearchParams(); Object.entries({ ...filters, ...overrides }).forEach(([key, value]) => { if (value != null && value !== "" && !(key === "page" && value === 1) && !(key === "pageSize" && value === 10)) p.set(key, String(value)); }); return p.toString(); }

const dot = (value: string | null) => (value ? value.replaceAll("-", ".") : "");
const pct = (value: number | null) => (value === null ? "" : `${Math.round(value * 100)}%`);
// 엑셀 원본 헤더 텍스트는 그대로 유지하되(다운로드/업로드 호환), 화면 표시용으로만 "(입력불필요)" 안내문구를 뺀다.
const displayHeader = (header: string) => header.replace("(입력불필요)", "");

export function WbsListScreen({ result, filters }: { result: WbsExcelListResult; filters: Filters }) {
  const pageLinkCount = Math.min(10, result.totalPages);
  const firstPage = Math.max(1, Math.min(result.page - 4, result.totalPages - pageLinkCount + 1));
  const pageNumbers = Array.from({ length: pageLinkCount }, (_, index) => firstPage + index);
  return <>
    <header className="topbar"><div><h1>WBS</h1><p>총 {result.total}건 · 엑셀 원본 47개 컬럼</p></div></header>
    <div className="content">
      <section className="panel compact">
        <form className="filters inline-filter" method="get">
          {filters.pageSize !== 10 && <input type="hidden" name="pageSize" value={String(filters.pageSize)} />}
          <input name="q" defaultValue={filters.q} placeholder="Task 코드·이름 검색" aria-label="Task 검색" />
          <input name="assignee" defaultValue={filters.assignee} placeholder="담당자 검색" aria-label="담당자 검색" />
          <label>계획시작일<input type="date" name="startDate" defaultValue={filters.startDate} /></label>
          <label>계획종료일<input type="date" name="dueDate" defaultValue={filters.dueDate} /></label>
          <input name="groupLabel" defaultValue={filters.groupLabel} placeholder="지원모듈 검색" aria-label="지원모듈 검색" />
          <select name="delayed" defaultValue={filters.delayed} aria-label="지연여부"><option value="">전체 지연여부</option><option value="y">지연</option><option value="n">정상</option></select>
          <input type="number" name="plannedMin" min={0} max={100} defaultValue={filters.plannedMin ?? ""} placeholder="목표 %이상" aria-label="목표 최소값" />
          <input type="number" name="actualMin" min={0} max={100} defaultValue={filters.actualMin ?? ""} placeholder="실적 %이상" aria-label="실적 최소값" />
          <input type="number" name="progressMin" min={0} max={100} defaultValue={filters.progressMin ?? ""} placeholder="진척율 %이상" aria-label="진척율 최소값" />
          <button className="button secondary" type="submit">조회</button>
          <Link className="button ghost" href="/wbs">초기화</Link>
          <Link className="button primary filter-primary-action" href="/wbs/new">+ 신규 등록</Link>
        </form>
      </section>
      <section className="panel compact">
        {result.rows.length ? <div className="table-wrap wbs-table-wrap"><table><thead><tr>{HEADERS.filter((h) => !HIDDEN_HEADERS.has(h)).map((h) => <th key={h}>{displayHeader(h)}</th>)}<th>계획시작일</th><th>계획종료일</th><th>계획소요일</th><th>실적시작일</th><th>실적종료일</th><th>실적소요일</th><th>지연율</th><th>지연일자</th><th>지연여부</th></tr></thead>
          <tbody>{result.rows.map((item) => <ClickableTableRow href={`/wbs/${item.id}`} ariaLabel={`${item.name} WBS 상세보기`} className={item.isDelayed ? "high-risk-row" : undefined} key={item.id}>
            <td>{item.level}</td>
            <td className="mono">{sortKeyFromCode(item.code)}</td>
            <td>{item.projectCode}</td>
            <td>{item.configStatus}</td>
            <td>{item.stage ?? ""}</td>
            <td className="mono">{item.code}</td>
            <td className="title-cell"><Link className="table-link" href={`/wbs/${item.id}`}>{item.name}</Link></td>
            <td></td>
            <td>{item.isLeaf ? 1 : ""}</td>
            <td>{item.ownerUserId && item.ownerLoginId ? <Link className="table-link" href={`/wbs/by-owner/${item.ownerLoginId}`}>{item.ownerName}</Link> : (item.ownerName ?? "")}</td>
            <td>{item.groupLabel ?? ""}</td>
            <td>{Math.round(item.actualProgress * 100)}</td>
            <td>{pct(item.plannedProgress)}</td>
            <td>{pct(item.actualProgress)}</td>
            <td>{pct(item.progressIndex)}</td>
            <td>{dot(item.startDate)}</td>
            <td>{dot(item.dueDate)}</td>
            <td data-numeric>{item.workingDays ?? "-"}</td>
            <td>{dot(item.actualStartDate)}</td>
            <td>{dot(item.actualDueDate)}</td>
            <td data-numeric>{item.actualWorkingDays ?? "-"}</td>
            <td data-numeric>{item.delayRate === null ? "-" : `${item.delayRate}%`}</td>
            <td data-numeric>{item.delayDays === null ? "-" : `${item.delayDays}일`}</td>
            <td>{item.isDelayed ? <span className="badge band-red">지연</span> : ""}</td>
          </ClickableTableRow>)}</tbody></table></div> : <div className="empty">등록된 WBS 항목이 없습니다.</div>}
      </section>
      {result.total > 0 && <nav className="pagination requirement-pagination" aria-label="페이지 이동"><form className="page-size-form" method="get">{filters.q && <input type="hidden" name="q" value={filters.q} />}{filters.assignee && <input type="hidden" name="assignee" value={filters.assignee} />}{filters.startDate && <input type="hidden" name="startDate" value={filters.startDate} />}{filters.dueDate && <input type="hidden" name="dueDate" value={filters.dueDate} />}{filters.groupLabel && <input type="hidden" name="groupLabel" value={filters.groupLabel} />}{filters.delayed && <input type="hidden" name="delayed" value={filters.delayed} />}{filters.plannedMin != null && <input type="hidden" name="plannedMin" value={filters.plannedMin} />}{filters.actualMin != null && <input type="hidden" name="actualMin" value={filters.actualMin} />}{filters.progressMin != null && <input type="hidden" name="progressMin" value={filters.progressMin} />}<label>표시 개수<select name="pageSize" defaultValue={String(filters.pageSize)}><option value="10">10개</option><option value="20">20개</option><option value="40">40개</option><option value="60">60개</option><option value="80">80개</option><option value="100">100개</option><option value="all">전체</option></select></label><button className="button secondary" type="submit">적용</button></form><div className="page-links">{result.page > 1 && <Link href={`/wbs?${queryString(filters, { page: result.page - 1 })}`} aria-label="이전 페이지">이전</Link>}{pageNumbers.map((page) => page === result.page ? <strong className="current" aria-current="page" key={page}>{page}</strong> : <Link href={`/wbs?${queryString(filters, { page })}`} key={page}>{page}</Link>)}{result.page < result.totalPages && <Link href={`/wbs?${queryString(filters, { page: result.page + 1 })}`} aria-label="다음 페이지">다음</Link>}</div><span className="page-summary">총 {result.total}건 · {result.page} / {result.totalPages} 페이지</span></nav>}
    </div>
  </>;
}
