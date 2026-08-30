import type { WbsWeeklyStats } from "@/lib/server/wbs";

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export function WbsWeeklyStatsScreen({ stats }: { stats: WbsWeeklyStats }) {
  const { asOf, overall, groups } = stats;
  return <>
    <header className="topbar"><div><h1>WBS 주간 통계</h1><p>업무그룹별 진행 사항 · 기준일 {asOf.replaceAll("-", ".")}</p></div></header>
    <div className="content">
      <section className="panel">
        <div className="panel-head"><h2>진행 사항</h2><span>{groups.length}개 업무그룹</span></div>
        <div className="table-wrap"><table>
          <thead><tr><th>업무그룹</th><th>총대상(건)</th><th>계획(건)</th><th>완료(건)</th><th>지연(건)</th><th>달성률(%)(계획대비)</th><th>진척률(%)(전체)</th><th>비고</th></tr></thead>
          <tbody>{groups.map((group) => <tr key={group.groupLabel}>
            <td>{group.groupLabel}</td>
            <td>{group.totalCount}</td>
            <td>{group.plannedCount}</td>
            <td>{group.completedCount}</td>
            <td>{group.delayedCount}</td>
            <td>{pct(group.achievementRate)}</td>
            <td>{pct(group.progressRate)}</td>
            <td></td>
          </tr>)}</tbody>
          <tfoot><tr className="totals-row">
            <td>전체</td>
            <td>{overall.totalCount}</td>
            <td>{overall.plannedCount}</td>
            <td>{overall.completedCount}</td>
            <td>{overall.delayedCount}</td>
            <td>{pct(overall.achievementRate)}</td>
            <td>{pct(overall.progressRate)}</td>
            <td></td>
          </tr></tfoot>
        </table></div>
      </section>
      <div className="note">계획(건) = DueDate가 기준일 이하인 항목(스케줄상 기준일까지 끝났어야 할 건). 완료(건) = 그중 실적(담당자별 진도율)이 100%인 항목. 달성률 = 완료/계획, 진척률 = 완료/총대상. 완료 시점을 별도로 기록하지 않아 과거 시점 스냅샷(전주 대비 등)은 제공하지 않습니다.</div>
    </div>
  </>;
}
