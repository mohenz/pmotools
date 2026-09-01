import Link from "next/link";
import type { WbsStats, WbsOwnerStatus } from "@/lib/server/wbs";
import { WbsOwnerStatusChart, WbsProgressChart } from "@/components/PortfolioDomainCharts";
import { ClickableTableRow } from "@/components/ClickableTableRow";

const pct = (value: number) => Math.round(value * 100);
const pctOrDash = (value: number | null) => (value === null ? "-" : `${Math.round(value * 100)}%`);
const fmt = (value: number) => value.toLocaleString("ko-KR");
const dot = (value: string | null) => (value ? value.replaceAll("-", ".") : "");

export function PortfolioScreen({ wbsStats, myWbsStatus }: {
  wbsStats: WbsStats;
  myWbsStatus: WbsOwnerStatus;
}) {
  // 미완료 Task를 먼저 보여주되, 전부 완료된 담당자라도 목록이 비지 않도록 완료 건도 뒤이어 채운다.
  const myTasks = [...(myWbsStatus?.items ?? [])]
    .sort((a, b) => {
      const doneA = a.actualProgress >= 1 ? 1 : 0, doneB = b.actualProgress >= 1 ? 1 : 0;
      if (doneA !== doneB) return doneA - doneB;
      return (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99");
    })
    .slice(0, 8);
  const myLeafItems = (myWbsStatus?.items ?? []).filter((item) => item.isLeaf);
  const myCompleted = myLeafItems.filter((item) => item.actualProgress >= 1).length;
  const myDelayed = myLeafItems.filter((item) => item.isDelayed && item.actualProgress < 1).length;
  const myInProgress = myLeafItems.length - myCompleted - myDelayed;
  return <>
    <div className="content">
      <section className="portfolio-domain-grid" aria-label="핵심 업무 현황">
        <Link href="/wbs/stats" className="panel domain-summary">
          <div className="panel-head"><h2>WBS 진척</h2><span>{wbsStats.stages.length}개 Stage · {fmt(wbsStats.itemCount)}건</span></div>
          <WbsProgressChart stages={wbsStats.stages} />
          <p className="domain-summary-foot">지연 <strong className={wbsStats.delayedCount > 0 ? "critical" : undefined}>{fmt(wbsStats.delayedCount)}건</strong> · 전체 지연율 <strong>{pct(wbsStats.delayRate)}%</strong></p>
        </Link>

        <Link href={myWbsStatus ? `/wbs/by-owner/${myWbsStatus.owner.loginId}` : "/wbs"} className="panel domain-summary">
          <div className="panel-head"><h2>나의 WBS 현황</h2><span>{fmt(myLeafItems.length)}건</span></div>
          <WbsOwnerStatusChart completed={myCompleted} inProgress={myInProgress} delayed={myDelayed} />
          <p className="domain-summary-foot">진척율 <strong>{myWbsStatus ? pct(myWbsStatus.overall.progressIndex) : 0}%</strong></p>
        </Link>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>나의 WBS Task</h2>
          <span>{myWbsStatus ? `담당 ${fmt(myWbsStatus.items.length)}건 · 진척율 ${pct(myWbsStatus.overall.progressIndex)}%` : "담당 Task 없음"}</span>
        </div>
        {myTasks.length ? <div className="table-wrap"><table>
          <thead><tr><th>Task</th><th>Task Description</th><th>Stage</th><th>DueDate</th><th>목표</th><th>실적</th><th>진척율</th></tr></thead>
          <tbody>{myTasks.map((item) => <ClickableTableRow href={`/wbs/${item.id}`} ariaLabel={`${item.name} WBS 상세보기`} key={item.id}>
            <td className="mono">{item.code}</td>
            <td className="title-cell"><Link className="table-link" href={`/wbs/${item.id}`}>{item.name}</Link></td>
            <td>{item.stage ?? ""}</td>
            <td>{dot(item.dueDate)}</td>
            <td>{pctOrDash(item.plannedProgress)}</td>
            <td>{pctOrDash(item.actualProgress)}</td>
            <td>{pctOrDash(item.progressIndex)}</td>
          </ClickableTableRow>)}</tbody>
        </table></div> : <div className="empty">담당 중인 WBS Task가 없습니다.</div>}
        {myWbsStatus && myWbsStatus.items.length > 0 && <Link className="text-button" href={`/wbs/by-owner/${myWbsStatus.owner.loginId}`}>담당 Task 전체 {fmt(myWbsStatus.items.length)}건 보기</Link>}
      </section>
    </div>
  </>;
}
