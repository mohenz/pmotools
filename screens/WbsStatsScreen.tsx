import { WbsStageChart } from "@/components/WbsStageChart";
import type { WbsStats } from "@/lib/server/wbs";

const pct = (value: number) => Math.round(value * 100);

export function WbsStatsScreen({ stats }: { stats: WbsStats }) {
  const { overall, delayRate, delayedCount, delayTrackedCount, stages } = stats;
  return <>
    <header className="topbar"><div><h1>WBS 통계</h1><p>전체 공정율 및 Stage별 계획·실적·지연 현황</p></div></header>
    <div className="content">
      <section className="kpi-grid">
        <div className="kpi"><span>전체 목표(today)</span><strong>{pct(overall.planned)}%</strong><small>계획 공정율</small></div>
        <div className="kpi"><span>전체 실적</span><strong>{pct(overall.actual)}%</strong><small>실적 공정율</small></div>
        <div className="kpi"><span>전체 진척율</span><strong className={overall.progressIndex < 1 ? "critical" : undefined}>{pct(overall.progressIndex)}%</strong><small>실적/계획</small></div>
        <div className="kpi"><span>전체 지연율</span><strong className={delayRate > 0 ? "critical" : undefined}>{pct(delayRate)}%</strong><small>지연 {delayedCount}/{delayTrackedCount}건</small></div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Stage별 공정율</h2><span>{stages.length}개 Stage</span></div>
        {stages.length ? <>
          <WbsStageChart stages={stages} />
          <div className="table-wrap"><table><thead><tr><th>Stage</th><th>계획</th><th>실적</th><th>상태</th></tr></thead>
            <tbody>{stages.map((stage) => <tr key={stage.stage}>
              <td>{stage.stage}</td>
              <td>{pct(stage.planned)}%</td>
              <td>{pct(stage.actual)}%</td>
              <td>{stage.delayed ? <span className="badge band-red">지연</span> : <span className="badge band-green">정상</span>}</td>
            </tr>)}</tbody>
          </table></div>
        </> : <div className="empty">진척관리 대상(leaf) 항목이 없습니다.</div>}
      </section>
    </div>
  </>;
}
