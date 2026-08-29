import type { WbsStats } from "@/lib/server/wbs";

const pct = (value: number) => Math.round(value * 100);

export function WbsStatsScreen({ stats }: { stats: WbsStats }) {
  const { overall, stages } = stats;
  return <>
    <header className="topbar"><div><h1>WBS 통계</h1><p>전체 공정율 및 Stage별 계획·실적·지연 현황</p></div></header>
    <div className="content">
      <section className="kpi-grid">
        <div className="kpi"><span>전체 목표(today)</span><strong>{pct(overall.planned)}%</strong><small>계획 공정율</small></div>
        <div className="kpi"><span>전체 실적</span><strong>{pct(overall.actual)}%</strong><small>실적 공정율</small></div>
        <div className="kpi"><span>전체 진척율</span><strong className={overall.progressIndex < 1 ? "critical" : undefined}>{pct(overall.progressIndex)}%</strong><small>실적/계획</small></div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Stage별 공정율</h2><span>{stages.length}개 Stage</span></div>
        {stages.length ? <div className="progress-board">{stages.map((stage) => <article className="progress-card" key={stage.stage}>
          <span>{stage.stage}</span>
          <strong>계획 {pct(stage.planned)}% · 실적 {pct(stage.actual)}%</strong>
          <div className="mini-progress"><i style={{ width: `${pct(stage.planned)}%` }} /><span>계획 {pct(stage.planned)}%</span></div>
          <div className="mini-progress"><i style={{ width: `${pct(stage.actual)}%` }} /><span>실적 {pct(stage.actual)}%</span></div>
          {stage.delayed && <em>지연</em>}
        </article>)}</div> : <div className="empty">진척관리 대상(leaf) 항목이 없습니다.</div>}
      </section>
    </div>
  </>;
}
