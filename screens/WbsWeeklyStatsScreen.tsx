import type { WbsWeeklyStats } from "@/lib/server/wbs";

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const dot = (value: string) => value.replaceAll("-", ".");
const fmt = (value: number) => value.toLocaleString("ko-KR");

export function WbsWeeklyStatsScreen({ stats }: { stats: WbsWeeklyStats }) {
  const { startDate, endDate, overall, groups } = stats;
  return <>
    <header className="topbar"><div><h1>WBS 주간 통계</h1><p>업무그룹별 진행 사항 · 기준 기간 {dot(startDate)} ~ {dot(endDate)}</p></div></header>
    <div className="content">
      <section className="panel compact">
        <form className="filters inline-filter" method="get">
          <label>시작일<input type="date" name="startDate" defaultValue={startDate} /></label>
          <label>종료일<input type="date" name="endDate" defaultValue={endDate} /></label>
          <button className="button secondary" type="submit">조회</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>진행 사항</h2><span>{groups.length}개 업무그룹</span></div>
        <div className="table-wrap"><table>
          <thead><tr><th>업무그룹</th><th>총대상(건)</th><th>계획(건)</th><th>완료(건)</th><th>지연(건)</th><th>달성률(%)(계획대비)</th><th>진척률(%)(전체)</th><th>비고</th></tr></thead>
          <tbody>{groups.map((group) => <tr key={group.groupLabel}>
            <td>{group.groupLabel}</td>
            <td data-numeric>{fmt(group.totalCount)}</td>
            <td data-numeric>{fmt(group.plannedCount)}</td>
            <td data-numeric>{fmt(group.completedCount)}</td>
            <td data-numeric>{fmt(group.delayedCount)}</td>
            <td data-numeric>{pct(group.achievementRate)}</td>
            <td data-numeric>{pct(group.progressRate)}</td>
            <td></td>
          </tr>)}</tbody>
          <tfoot><tr className="totals-row">
            <td>전체</td>
            <td data-numeric>{fmt(overall.totalCount)}</td>
            <td data-numeric>{fmt(overall.plannedCount)}</td>
            <td data-numeric>{fmt(overall.completedCount)}</td>
            <td data-numeric>{fmt(overall.delayedCount)}</td>
            <td data-numeric>{pct(overall.achievementRate)}</td>
            <td data-numeric>{pct(overall.progressRate)}</td>
            <td></td>
          </tr></tfoot>
        </table></div>
      </section>
    </div>
  </>;
}
