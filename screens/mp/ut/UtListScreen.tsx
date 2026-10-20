import Link from "next/link";
import { UT_VERDICT_LABEL, UT_VERIFICATION_LABEL, type UtVerdict, type UtVerificationResult } from "@/lib/domain/ut";
import type { UtSheetRow, UtTreeNode } from "@/lib/server/mp/ut/grid";
import { STATUS_BAND, dot } from "@/features/mp/ut/format";
import { UtPagination, type UtPageSize } from "@/features/mp/ut/UtPagination";
import { UtWbsTree } from "@/features/mp/ut/UtWbsTree";

export const UT_TODO_LABEL: Record<string, string> = { review: "검토 대기", execute: "수행 대상", qc: "QC 확인 대기", pl: "PL 확인 대기", defect: "결함 조치·검증 대기", draft: "작성중" };

// 단위테스트 목록 — 사용자 양식 24개 열(2026-10-20). 케이스를 누르면 정보확인/처리 화면.
export function UtListScreen({ tree, rows, filters, paging, canCreate }: { tree: UtTreeNode[]; rows: UtSheetRow[]; filters: Record<string, string>; paging: { pageSize: UtPageSize; page: number; total: number; totalPages: number }; canCreate: boolean }) {
  const exportQuery = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  return <>
    <header className="topbar">
      <div><h1>단위테스트 목록</h1><p>개발 단계 WBS 기준 테스트 케이스 · 총 {paging.total}건</p></div>
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
          {canCreate && <Link className="button primary filter-primary-action" href={`/mp-ut/cases/new${filters.wbs ? `?wbs=${filters.wbs}` : ""}`}>+ 신규 등록</Link>}
        </form>
        <section className="panel compact">
          {rows.length ? <div className="table-wrap"><table className="ut-table ut-sheet">
            <thead><tr>
              <th>업무명</th><th>WBS ID</th><th>테스트 케이스 ID</th><th>테스트케이스명</th><th>사전조건</th><th>입력 데이터</th><th>테스트 케이스 상세</th><th>예상결과</th><th>실제결과</th><th>테스트 결과</th><th>오류내용</th><th>업무 담당자</th>
              <th>테스트 수행일</th><th>테스트 수행자</th><th>화면 ID</th><th>화면명</th><th>요구사항 ID</th><th>결함 ID</th><th>조치일</th><th>조치자</th><th>검증결과</th><th>검증일자</th><th>검증자</th><th>완료여부</th>
            </tr></thead>
            <tbody>{rows.map((r) => <tr key={r.caseId}>
              <td>{r.unit}</td>
              <td className="mono">{r.wbsDisplayId}</td>
              <td className="mono"><Link className="table-link" href={`/mp-ut/cases/${r.caseId}`}>{r.caseDisplayId}</Link>{r.todo.length > 0 && <small className="ut-todo">{r.todo.map((t) => UT_TODO_LABEL[t]).join(" · ")}</small>}</td>
              <td className="title-cell"><Link className="table-link" href={`/mp-ut/cases/${r.caseId}`}>{r.caseName}</Link></td>
              <td className="ut-pre">{r.precondition}</td>
              <td className="ut-pre">{r.inputData}</td>
              <td className="ut-pre ut-steps">{r.steps}</td>
              <td className="ut-pre">{r.expectedResult}</td>
              <td className="ut-pre">{r.actualResult}</td>
              <td>{r.verdict ? <span className={`badge ${STATUS_BAND[r.verdict]}`}>{UT_VERDICT_LABEL[r.verdict as UtVerdict]}</span> : "–"}</td>
              <td className="ut-pre">{r.errorContent || "–"}</td>
              <td>{r.ownerName ?? "–"}</td>
              <td>{dot(r.executedOn)}</td>
              <td>{r.executorName ?? "–"}</td>
              <td className="mono">{r.screenId || "–"}</td>
              <td>{r.screenName || "–"}</td>
              <td className="mono">{r.requirementId || "–"}</td>
              <td className="mono">{r.defectId ?? "–"}</td>
              <td>{dot(r.fixedAt)}</td>
              <td>{r.fixerName ?? "–"}</td>
              <td>{r.verificationResult ? UT_VERIFICATION_LABEL[r.verificationResult as UtVerificationResult] : "–"}</td>
              <td>{dot(r.verifiedAt)}</td>
              <td>{r.verifierName ?? "–"}</td>
              <td><span className={`badge ${r.done === "완료" ? "band-green" : r.done === "진행중" ? "band-yellow" : ""}`}>{r.done}</span></td>
            </tr>)}</tbody>
          </table></div> : <div className="empty">{filters.wbs ? "선택한 WBS에 테스트 케이스가 없습니다." : "등록된 테스트 케이스가 없습니다."}</div>}
        </section>
        <UtPagination basePath="/mp-ut" filters={filters} {...paging} />
      </div>
    </div>
  </>;
}
