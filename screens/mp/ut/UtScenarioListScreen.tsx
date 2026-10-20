import Link from "next/link";
import { UT_SCENARIO_STATUS_LABEL, type UtScenarioStatus } from "@/lib/domain/ut";
import type { listUtScenarios } from "@/lib/server/mp/ut/scenarios";
import { STATUS_BAND } from "@/features/mp/ut/format";

type Row = Awaited<ReturnType<typeof listUtScenarios>>[number];

// UT-020 시나리오·케이스 목록 — 설계서 8장. 필터는 GET 폼(서버 렌더).
export function UtScenarioListScreen({ rows, filters, groups, canCreate }: { rows: Row[]; filters: Record<string, string>; groups: { id: string; label: string }[]; canCreate: boolean }) {
  return <>
    <header className="topbar">
      <div><h1>단위테스트 시나리오</h1><p>WBS Leaf 기준 시나리오·케이스 · {rows.length}건</p></div>
      <div className="topbar-actions">{canCreate && <Link className="button primary" href="/mp-ut/new">+ 시나리오 등록</Link>}</div>
    </header>
    <div className="content">
      <section className="panel">
        <form className="filters inline-filter ut-filters" method="get">
          <label>상태<select name="status" defaultValue={filters.status ?? ""}><option value="">전체</option>{(Object.keys(UT_SCENARIO_STATUS_LABEL) as UtScenarioStatus[]).map((s) => <option key={s} value={s}>{UT_SCENARIO_STATUS_LABEL[s]}</option>)}</select></label>
          <label>업무단위<select name="groupId" defaultValue={filters.groupId ?? ""}><option value="">전체</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
          <label>검색<input name="q" defaultValue={filters.q ?? ""} placeholder="시나리오명·ID" /></label>
          <label className="ut-check"><input type="checkbox" name="mine" value="1" defaultChecked={filters.mine === "1"} />내 관련 건만</label>
          <button className="button secondary" type="submit">조회</button>
        </form>
        <div className="table-wrap">
          <table className="ut-table">
            <thead><tr><th>시나리오 ID</th><th>시나리오명</th><th>WBS</th><th>업무단위</th><th>우선순위</th><th>작성자</th><th>PL</th><th>상태</th><th data-numeric>케이스</th><th data-numeric>예외·경계</th><th data-numeric>확인대기</th><th data-numeric>PL확인완료</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id}>
              <td className="mono"><Link className="table-link" href={`/mp-ut/${r.id}`}>{r.displayId}</Link></td>
              <td>{r.name}</td>
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
          {!rows.length && <p className="empty">조건에 맞는 시나리오가 없습니다.</p>}
        </div>
      </section>
    </div>
  </>;
}
