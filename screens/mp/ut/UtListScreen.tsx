import { UT_VERDICT_LABEL, type UtVerdict } from "@/lib/domain/ut";
import type { UtSheetRow, UtTreeNode } from "@/lib/server/mp/ut/grid";
import { STATUS_BAND, dot } from "@/features/mp/ut/format";
import { UtPagination, type UtPageSize } from "@/features/mp/ut/UtPagination";
import { UtWbsTree } from "@/features/mp/ut/UtWbsTree";
import { UtCaseModal } from "@/features/mp/ut/UtCaseModal";
import { UtModalLink } from "@/features/mp/ut/UtModalLink";

export const UT_TODO_LABEL: Record<string, string> = { execute: "수행 대상", qc: "QC 확인 대기", pl: "PL 확인 대기", defect: "결함 조치·검증 대기" };

// 단위테스트 목록 — 사용자 양식 24개 열(2026-10-20). 케이스를 누르면 정보확인/처리 화면.
export function UtListScreen({ tree, rows, filters, paging, canCreate }: { tree: UtTreeNode[]; rows: UtSheetRow[]; filters: Record<string, string>; paging: { pageSize: UtPageSize; page: number; total: number; totalPages: number }; canCreate: boolean }) {
  const keep = (extra: Record<string, string>) => `/mp-ut?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), ...(paging.page > 1 ? { page: String(paging.page) } : {}), ...(paging.pageSize !== 20 ? { pageSize: String(paging.pageSize) } : {}), ...extra })}`;
  const exportQuery = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  return <>
    <header className="topbar">
      <div><h1>단위테스트 목록</h1><p>WBS 단위테스트 대상 Task 기준 · 총 {paging.total}행</p></div>
      <div className="topbar-actions"><a className="button secondary" href={`/api/v1/mp/ut/sheet?${exportQuery}${exportQuery ? "&" : ""}format=xlsx`}>엑셀 출력</a></div>
    </header>
    <div className="content ut-split">
      <UtWbsTree nodes={tree} />
      <div className="ut-main">
        <form className="filters requirement-filter-panel" method="get">
          {filters.wbs && <input type="hidden" name="wbs" value={filters.wbs} />}
          {paging.pageSize !== 20 && <input type="hidden" name="pageSize" value={String(paging.pageSize)} />}
          <input name="q" defaultValue={filters.q ?? ""} placeholder="케이스 ID·명, 업무명, 요구사항·화면 ID 검색" aria-label="검색어" />
          <select name="verdict" defaultValue={filters.verdict ?? ""} aria-label="테스트 결과"><option value="">전체 결과</option><option value="PASS">PASS</option><option value="FAIL">FAIL</option><option value="BLOCKED">BLOCKED</option><option value="NA">N/A</option><option value="NONE">미수행</option></select>
          <select name="todo" defaultValue={filters.todo ?? ""} aria-label="처리 대기"><option value="">전체 케이스</option><option value="any">내 처리 대기 전체</option>{Object.entries(UT_TODO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <button className="button secondary" type="submit">조회</button>
          {canCreate && <UtModalLink className="button primary filter-primary-action" href={keep({ new: "1" })}>+ 신규 등록</UtModalLink>}
        </form>
        <section className="panel compact">
          {rows.length ? <div className="table-wrap ut-table-wrap"><table className="ut-table ut-sheet">
            <thead><tr>
              <th>테스트케이스ID</th><th>테스트케이스명</th><th>케이스유형</th><th>업무명</th><th>작업자</th><th>작성자</th><th>수행자</th><th>수행일자</th><th>처리대기</th><th>수행결과</th><th>QC확인</th><th>PL확인</th><th>완료여부</th>
            </tr></thead>
            <tbody>{rows.map((r) => <tr key={r.caseId ?? `wbs-${r.wbsItemId ?? ""}`}>
              {r.caseId ? <>
                <td className="mono"><UtModalLink className="table-link" href={keep({ case: r.caseId })}>{r.caseDisplayId}</UtModalLink></td>
                <td className="title-cell"><UtModalLink className="table-link" href={keep({ case: r.caseId })}>{r.caseName}</UtModalLink></td>
              </> : <>
                <td>{canCreate ? <UtModalLink className="table-link" href={keep({ new: "1", ...(r.wbsItemId ? { newWbs: r.wbsItemId } : {}) })}>+ 케이스 등록</UtModalLink> : "–"}</td>
                <td className="title-cell ut-hint">{r.wbsName} · 케이스 미등록</td>
              </>}
              <td>{r.caseTypeLabel || "–"}</td>
              <td>{r.unit || "–"}</td>
              <td>{r.ownerName ?? "–"}</td>
              <td>{r.creatorName || "–"}</td>
              <td>{r.executorName ?? "–"}</td>
              <td>{dot(r.executedOn)}</td>
              <td>{r.todo.length ? r.todo.map((t) => <span key={t} className="ut-todo-chip">{UT_TODO_LABEL[t]}</span>) : "–"}</td>
              <td>{r.verdict ? <span className={`badge ${STATUS_BAND[r.verdict]}`}>{UT_VERDICT_LABEL[r.verdict as UtVerdict]}</span> : "–"}</td>
              <td>{r.qcResult || "–"}</td>
              <td>{r.plResult || "–"}</td>
              <td><span className={`badge ${r.done === "완료" ? "band-green" : r.done === "진행중" ? "band-yellow" : ""}`}>{r.done}</span></td>
            </tr>)}</tbody>
          </table></div> : <div className="empty">{filters.wbs === "none" ? "WBS 없이 등록한 테스트가 없습니다." : filters.wbs ? "선택한 WBS에 등록된 테스트케이스가 없습니다." : "등록된 테스트케이스가 없습니다."}</div>}
        </section>
        <UtPagination basePath="/mp-ut" filters={filters} {...paging} />
      </div>
    </div>
    <UtCaseModal />
  </>;
}
