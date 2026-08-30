import { WbsStageChart } from "@/components/WbsStageChart";
import type { WbsWorkGroupStats } from "@/lib/server/wbs";

const pct = (value: number) => Math.round(value * 100);

export function WbsGroupStatsScreen({ stats }: { stats: WbsWorkGroupStats }) {
  const { overall, groups } = stats;
  const chartData = groups.map((group) => ({ stage: group.groupLabel, planned: group.planned, actual: group.actual, delayed: group.delayed }));
  return <>
    <header className="topbar"><div><h1>WBS 업무그룹별 통계</h1><p>사용자관리에서 지정한 업무그룹 기준 WBS 담당자별 공정율 현황</p></div></header>
    <div className="content">
      <section className="kpi-grid">
        <div className="kpi"><span>전체 목표(today)</span><strong>{pct(overall.planned)}%</strong><small>계획 공정율</small></div>
        <div className="kpi"><span>전체 실적</span><strong>{pct(overall.actual)}%</strong><small>실적 공정율</small></div>
        <div className="kpi"><span>전체 진척율</span><strong className={overall.progressIndex < 1 ? "critical" : undefined}>{pct(overall.progressIndex)}%</strong><small>실적/계획</small></div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>업무그룹별 공정율</h2><span>{groups.length}개 그룹</span></div>
        {groups.length ? <>
          <WbsStageChart stages={chartData} />
          <div className="table-wrap"><table><thead><tr><th>업무그룹</th><th>담당 인원</th><th>Task 건수</th><th>목표</th><th>실적</th><th>진척율</th><th>상태</th></tr></thead>
            <tbody>{groups.map((group) => <tr key={group.groupLabel}>
              <td>{group.groupLabel}</td>
              <td>{group.memberCount}명</td>
              <td>{group.itemCount}건</td>
              <td>{pct(group.planned)}%</td>
              <td>{pct(group.actual)}%</td>
              <td>{group.planned === 0 ? "-" : `${Math.round((group.actual / group.planned) * 100)}%`}</td>
              <td>{group.delayed ? <span className="badge band-red">지연</span> : <span className="badge band-green">정상</span>}</td>
            </tr>)}</tbody>
          </table></div>
        </> : <div className="empty">진척관리 대상(leaf) 항목이 없습니다.</div>}
      </section>
    </div>
  </>;
}
