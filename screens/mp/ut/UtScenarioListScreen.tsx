import Link from "next/link";
import { UT_SCENARIO_STATUS_LABEL, type UtScenarioStatus } from "@/lib/domain/ut";
import type { listUtScenarios } from "@/lib/server/mp/ut/scenarios";
import { STATUS_BAND } from "@/features/mp/ut/format";
import { UtPagination, type UtPageSize } from "@/features/mp/ut/UtPagination";

type Row = Awaited<ReturnType<typeof listUtScenarios>>[number];
type Paging = { pageSize: UtPageSize; page: number; total: number; totalPages: number };

// UT-020 시나리오 목록 — 설계서 8장. 검색 패널·페이징은 요구사항관리2 목록과 같은 표준.
export function UtScenarioListScreen({ rows, filters, paging, groups, canCreate }: { rows: Row[]; filters: Record<string, string>; paging: Paging; groups: { id: string; label: string }[]; canCreate: boolean }) {
  return <>
    <header className="topbar"><div><h1>단위테스트 시나리오</h1><p>WBS Leaf 기준 시나리오·케이스 · 총 {paging.total}건</p></div></header>
    <div className="content">
      <form className="filters requirement-filter-panel" method="get">
        {paging.pageSize !== 20 && <input type="hidden" name="pageSize" value={String(paging.pageSize)} />}
        <input name="q" defaultValue={filters.q ?? ""} placeholder="시나리오명·시나리오 ID 검색" aria-label="검색어" />
        <select name="status" defaultValue={filters.status ?? ""} aria-label="상태"><option value="">전체 상태</option>{(Object.keys(UT_SCENARIO_STATUS_LABEL) as UtScenarioStatus[]).map((s) => <option key={s} value={s}>{UT_SCENARIO_STATUS_LABEL[s]}</option>)}</select>
        <select name="groupId" defaultValue={filters.groupId ?? ""} aria-label="업무단위"><option value="">전체 업무단위</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select>
        <select name="mine" defaultValue={filters.mine ?? ""} aria-label="관련 범위"><option value="">전체 시나리오</option><option value="1">내 관련 건</option></select>
        <button className="button secondary" type="submit">조회</button>
        {canCreate && <Link className="button primary filter-primary-action" href="/mp-ut/new">+ 시나리오 등록</Link>}
      </form>
      <section className="panel compact">
        {rows.length ? <div className="table-wrap">
          <table className="ut-table">
            <thead><tr><th>시나리오 ID</th><th>시나리오명</th><th>WBS</th><th>업무단위</th><th>우선순위</th><th>작성자</th><th>PL</th><th>상태</th><th data-numeric>케이스</th><th data-numeric>예외·경계</th><th data-numeric>확인대기</th><th data-numeric>PL확인완료</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id}>
              <td className="mono"><Link className="table-link" href={`/mp-ut/${r.id}`}>{r.displayId}</Link></td>
              <td className="title-cell"><Link className="table-link" href={`/mp-ut/${r.id}`}>{r.name}</Link></td>
              <td><span className="mono">{r.wbsDisplayId}</span> {r.wbsName}</td>
              <td>{r.groupLabel}</td>
              <td>{r.priority}</td>
              <td>{r.writerName}</td>
              <td>{r.plName ?? "–"}</td>
              <td><span className={`badge ${STATUS_BAND[r.status]}`}>{UT_SCENARIO_STATUS_LABEL[r.status]}</span></td>
              <td data-numeric>{r.caseCount}</td>
              <td data-numeric className={r.caseCount && r.edgeCount < 2 ? "critical" : undefined}>{r.edgeCount}</td>
              <td data-numeric>{r.pendingCount}</td>
              <td data-numeric>{r.confirmedCount}/{r.caseCount}</td>
            </tr>)}</tbody>
          </table>
        </div> : <div className="empty">조건에 맞는 시나리오가 없습니다.</div>}
      </section>
      <UtPagination basePath="/mp-ut" filters={filters} {...paging} />
    </div>
  </>;
}
