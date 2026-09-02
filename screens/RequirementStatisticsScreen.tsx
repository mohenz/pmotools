import type { RequirementStatistics } from "@/lib/server/requirements";
import { DistributionBarChart } from "@/components/DistributionBarChart";

function percent(value: number, total: number) {
  return total ? `${Math.round((value / total) * 100)}%` : "0%";
}
const fmt = (value: number) => value.toLocaleString("ko-KR");

export function RequirementStatisticsScreen({ statistics }: { statistics: RequirementStatistics }) {
  const totalRow = { label: "총합계", rejected: statistics.rejected, partiallyAccepted: statistics.partiallyAccepted, accepted: statistics.accepted, total: statistics.total };
  return <>
    <header className="topbar"><div><h1>요구사항 통계</h1><p>요구사항분류와 수용여부 기준 집계</p></div></header>
    <div className="content requirement-statistics">
      <section className="requirement-kpis" aria-label="요구사항 요약">
        <article><span>전체 요구사항</span><strong>{fmt(statistics.total)}</strong><small>100%</small></article>
        <article className="accepted"><span>수용</span><strong>{fmt(statistics.accepted)}</strong><small>{percent(statistics.accepted, statistics.total)}</small></article>
        <article className="partial"><span>부분수용</span><strong>{fmt(statistics.partiallyAccepted)}</strong><small>{percent(statistics.partiallyAccepted, statistics.total)}</small></article>
        <article className="rejected"><span>미수용</span><strong>{fmt(statistics.rejected)}</strong><small>{percent(statistics.rejected, statistics.total)}</small></article>
      </section>

      <section className="panel requirement-pivot">
        <div className="panel-head"><div><h2>요구사항분류 × 수용여부</h2><p>Sheet2 피벗테이블과 동일한 집계 기준</p></div><span>{fmt(statistics.total)}건</span></div>
        <div className="table-wrap"><table>
          <thead><tr><th>요구사항분류</th><th>미수용</th><th>부분수용</th><th>수용</th><th>총합계</th></tr></thead>
          <tbody>
            {statistics.byCategory.map((row) => <tr key={row.label}><th>{row.label}</th><td>{fmt(row.rejected)}</td><td>{fmt(row.partiallyAccepted)}</td><td>{fmt(row.accepted)}</td><td><strong>{fmt(row.total)}</strong></td></tr>)}
            <tr className="pivot-total"><th>{totalRow.label}</th><td>{fmt(totalRow.rejected)}</td><td>{fmt(totalRow.partiallyAccepted)}</td><td>{fmt(totalRow.accepted)}</td><td><strong>{fmt(totalRow.total)}</strong></td></tr>
          </tbody>
        </table></div>
      </section>

      <section className="panel requirement-distribution">
        <div className="panel-head"><div><h2>기능구분 분포</h2><p>전체 요구사항 대비 구성 비율</p></div></div>
        <DistributionBarChart rows={statistics.byDivision.map((row) => ({ label: row.label, count: row.count }))} />
      </section>
    </div>
  </>;
}
