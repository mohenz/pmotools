import Link from "next/link";
import { getMpScope } from "@/lib/server/mp/context";
import { getDefectStats, listActionRecheck } from "@/lib/server/mp/defects/stats";
import { ensureDefectCommonCodes, getDefectCodes } from "@/lib/server/mp/defects/common";
import type { GroupedCounts } from "@/lib/domain/defect-stats";

export const dynamic = "force-dynamic";

const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 1000) / 10}%`);

function CountTable({ title, hint, firstLabel, rows }: { title: string; hint?: string; firstLabel: string; rows: GroupedCounts[] }) {
  return <section className="panel">
    <div className="panel-head"><h2>{title}</h2>{hint && <span>{hint}</span>}</div>
    {rows.length ? <div className="table-wrap"><table className="ut-table ut-stat-table">
      <thead><tr><th>{firstLabel}</th><th data-numeric>전체</th><th data-numeric>미조치</th><th data-numeric>조치완료</th><th data-numeric>종결</th><th data-numeric>조치완료율</th><th data-numeric>미조치 중대</th><th data-numeric>미배정</th><th data-numeric>기한 초과</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.key}><td>{r.label}</td><td data-numeric>{r.total}</td><td data-numeric>{r.open}</td><td data-numeric>{r.done}</td><td data-numeric>{r.closed}</td><td data-numeric>{pct(r.resolutionRate)}</td><td data-numeric>{r.unresolvedMajor}</td><td data-numeric>{r.unassigned}</td><td data-numeric>{r.overdue}</td></tr>)}</tbody>
    </table></div> : <div className="empty">집계할 결함이 없습니다.</div>}
  </section>;
}

// DM-05 통계보기 · DM-06 조치자 현황 · DM-07 조치 재확인. 조회 전용이며 WBS 진척은 바꾸지 않는다.
export default async function DefectStatsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const scope = await getMpScope();
  if (scope.isTopLevel) return <div className="content"><p className="action-message">하위 프로젝트를 선택해 주세요.</p></div>;
  const c = scope.context;
  const actor = { projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle };
  await ensureDefectCommonCodes(c.projectId);
  const codes = await getDefectCodes(c.projectId);
  const view = sp.view === "assignee" || sp.view === "recheck" ? sp.view : "test";
  const filters = { stageId: sp.stageId || undefined, from: sp.from || undefined, to: sp.to || undefined, includeUt: sp.includeUt !== "0" };
  const [stats, recheck] = await Promise.all([view === "recheck" ? null : getDefectStats(actor, filters), view === "recheck" ? listActionRecheck(actor) : null]);
  const tabs = [["test", "테스트별 현황"], ["assignee", "조치자 현황"], ["recheck", "조치 재확인"]] as const;
  return <>
    <header className="topbar"><div><h1>결함 통계</h1><p>결함관리 결함과 단위테스트 결함(읽기 전용)을 합산해 보여 줍니다 · WBS 진척은 바꾸지 않습니다</p></div></header>
    <div className="content">
      <nav className="tool-tabs" aria-label="통계 보기">{tabs.map(([k, l]) => <Link key={k} className={view === k ? "active" : ""} href={`/mp-defects/stats?view=${k}`}>{l}</Link>)}</nav>
      {view !== "recheck" && <form className="filters requirement-filter-panel" method="get">
        <input type="hidden" name="view" value={view} />
        <select name="stageId" defaultValue={sp.stageId ?? ""} aria-label="테스트 단계"><option value="">전체 단계</option>{codes.stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        <input type="date" name="from" defaultValue={sp.from ?? ""} aria-label="시작일" /><input type="date" name="to" defaultValue={sp.to ?? ""} aria-label="종료일" />
        <select name="includeUt" defaultValue={sp.includeUt ?? "1"} aria-label="단위테스트 결함"><option value="1">단위테스트 결함 포함</option><option value="0">결함관리 결함만</option></select>
        <button className="button secondary" type="submit">조회</button>
      </form>}
      {stats && <>
        <section className="panel">
          <div className="stat-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12 }}>
            {[["전체 결함", stats.totals.total], ["미조치", stats.totals.open], ["조치완료", stats.totals.done], ["종결", stats.totals.closed], ["조치완료율", pct(stats.totals.resolutionRate)], ["미조치 중대 결함", stats.totals.unresolvedMajor], ["미배정", stats.totals.unassigned], ["조치 예정일 초과", stats.totals.overdue]].map(([l, v]) => <div key={String(l)}><div className="ut-hint">{l}</div><strong style={{ fontSize: 22 }}>{v}</strong></div>)}
          </div>
          <p className="ut-hint">출처: 결함관리 {stats.bySource.defect}건 · 단위테스트 {stats.bySource.ut}건{stats.caseDensity.density !== null ? ` · 결함 밀도 ${stats.caseDensity.density} (결함 수 / 수행 케이스 ${stats.caseDensity.executedCases}개)` : ""}</p>
        </section>
        {view === "test" && <>
          <CountTable title="심각도별 조치현황" firstLabel="심각도" rows={stats.bySeverityGrouped} />
          <CountTable title="테스트 단계별" firstLabel="단계" rows={stats.byStage} />
          <CountTable title="WBS Task별" hint="Task 미연결 결함은 별도 행" firstLabel="Task" rows={stats.byTask} />
          <CountTable title="업무단위별" firstLabel="업무단위" rows={stats.byGroup} />
          <section className="panel"><div className="panel-head"><h2>심각도·우선순위별</h2></div>
            <p>심각도: {stats.bySeverity.map((s) => `${s.label} ${s.count}`).join(" · ") || "–"}</p><p>우선순위: {stats.byPriority.map((s) => `${s.label} ${s.count}`).join(" · ") || "–"}</p></section>
        </>}
        {view === "assignee" && <CountTable title="조치자별 현황" hint="미배정 결함은 별도 행" firstLabel="조치자" rows={stats.byAssignee} />}
      </>}
      {recheck && <section className="panel compact"><div className="panel-head"><h2>조치 재확인 대상</h2><span>완료·종결 상태인데 결함식별과 조치 내용이 모두 비어 있는 결함 {recheck.length}건</span></div>
        {recheck.length ? <div className="table-wrap"><table className="ut-table"><thead><tr><th>결함번호</th><th>제목</th><th>상태</th><th>담당자</th><th>최종 수정</th></tr></thead>
          <tbody>{recheck.map((r) => <tr key={r.id}><td className="mono"><Link className="table-link" href={`/mp-defects/${r.id}`}>{r.displayId}</Link></td><td className="title-cell">{r.title}</td><td>{r.status}</td><td>{r.assignee ?? "미배정"}</td><td>{r.updatedAt.slice(0, 10)}</td></tr>)}</tbody></table></div> : <div className="empty">재확인할 결함이 없습니다.</div>}</section>}
    </div>
  </>;
}
