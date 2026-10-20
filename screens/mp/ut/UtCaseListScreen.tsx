import Link from "next/link";
import { UT_CASE_STATUS_LABEL, UT_CASE_TYPE_LABEL, UT_SCENARIO_STATUS_LABEL, UT_VERDICT_LABEL, type UtCaseStatus, type UtCaseType, type UtScenarioStatus, type UtVerdict } from "@/lib/domain/ut";
import type { UtGridRow, UtTreeNode } from "@/lib/server/mp/ut/grid";
import { STATUS_BAND, dot } from "@/features/mp/ut/format";
import { UtPagination, type UtPageSize } from "@/features/mp/ut/UtPagination";
import { UtWbsTree } from "@/features/mp/ut/UtWbsTree";

// UT-020 시나리오·케이스 목록 — WBS 트리 + 시나리오/케이스 그리드, 상태·유형·우선순위 필터(설계서 8장).
export function UtCaseListScreen({ tree, rows, filters, paging, canCreate }: { tree: UtTreeNode[]; rows: UtGridRow[]; filters: Record<string, string>; paging: { pageSize: UtPageSize; page: number; total: number; totalPages: number }; canCreate: boolean }) {
  const selectedLeaf = tree.find((n) => n.id === filters.wbs && n.isLeaf);
  return <>
    <header className="topbar"><div><h1>시나리오·케이스 목록</h1><p>UT-020 · WBS 기준 단위테스트 시나리오와 케이스 · 총 {paging.total}건</p></div></header>
    <div className="content ut-split">
      <UtWbsTree nodes={tree} />
      <div className="ut-main">
        <form className="filters requirement-filter-panel" method="get">
          {filters.wbs && <input type="hidden" name="wbs" value={filters.wbs} />}
          {paging.pageSize !== 20 && <input type="hidden" name="pageSize" value={String(paging.pageSize)} />}
          <input name="q" defaultValue={filters.q ?? ""} placeholder="시나리오·케이스 ID·명 검색" aria-label="검색어" />
          <select name="status" defaultValue={filters.status ?? ""} aria-label="상태"><option value="">전체 상태</option>{(Object.keys(UT_CASE_STATUS_LABEL) as UtCaseStatus[]).map((s) => <option key={s} value={s}>{UT_CASE_STATUS_LABEL[s]}</option>)}</select>
          <select name="caseType" defaultValue={filters.caseType ?? ""} aria-label="유형"><option value="">전체 유형</option>{(Object.keys(UT_CASE_TYPE_LABEL) as UtCaseType[]).map((t) => <option key={t} value={t}>{UT_CASE_TYPE_LABEL[t]}</option>)}</select>
          <select name="priority" defaultValue={filters.priority ?? ""} aria-label="우선순위"><option value="">전체 우선순위</option><option value="H">H</option><option value="M">M</option><option value="L">L</option></select>
          <button className="button secondary" type="submit">조회</button>
          {canCreate && <Link className="button primary filter-primary-action" href={`/mp-ut/cases/new${selectedLeaf ? `?wbs=${selectedLeaf.id}` : ""}`}>+ 케이스 등록</Link>}
        </form>
        <section className="panel compact">
          {rows.length ? <div className="table-wrap"><table className="ut-table">
            <thead><tr><th>WBS</th><th>시나리오 ID</th><th>시나리오명</th><th>시나리오 상태</th><th>케이스 ID</th><th>케이스명</th><th>유형</th><th>우선순위</th><th>케이스 상태</th><th>수행자</th><th>예정일</th><th>최근 판정</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={`${r.scenarioId}-${r.caseId ?? "none"}`}>
              <td className="mono" title={r.wbsName}>{r.wbsDisplayId}</td>
              <td className="mono">{r.scenarioDisplayId}</td>
              <td>{r.scenarioName}</td>
              <td><span className={`badge ${STATUS_BAND[r.scenarioStatus]}`}>{UT_SCENARIO_STATUS_LABEL[r.scenarioStatus as UtScenarioStatus]}</span></td>
              <td className="mono">{r.caseId ? <Link className="table-link" href={`/mp-ut/cases/${r.caseId}`}>{r.caseDisplayId}</Link> : canCreate ? <Link className="table-link" href={`/mp-ut/cases/new?scenario=${r.scenarioId}`}>+ 케이스</Link> : "–"}</td>
              <td className="title-cell">{r.caseId ? <Link className="table-link" href={`/mp-ut/cases/${r.caseId}`}>{r.caseName}</Link> : "–"}</td>
              <td>{r.caseType ? UT_CASE_TYPE_LABEL[r.caseType as UtCaseType] : "–"}</td>
              <td>{r.priority}</td>
              <td>{r.status ? <span className={`badge ${STATUS_BAND[r.status]}`}>{UT_CASE_STATUS_LABEL[r.status as UtCaseStatus]}</span> : "–"}</td>
              <td>{r.executorName ?? "–"}</td>
              <td>{dot(r.plannedDate)}</td>
              <td>{r.lastVerdict ? <span className={`badge ${STATUS_BAND[r.lastVerdict]}`}>{r.lastRound}차 {UT_VERDICT_LABEL[r.lastVerdict as UtVerdict]}</span> : "–"}</td>
            </tr>)}</tbody>
          </table></div> : <div className="empty">{filters.wbs ? "선택한 WBS에 시나리오가 없습니다." : "등록된 시나리오가 없습니다."}</div>}
        </section>
        <UtPagination basePath="/mp-ut" filters={filters} {...paging} />
      </div>
    </div>
  </>;
}
