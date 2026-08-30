import Link from "next/link";
import { ClickableTableRow } from "@/components/ClickableTableRow";
import { WbsStageChart } from "@/components/WbsStageChart";
import { rollupProgress } from "@/lib/domain/wbs";
import type { WbsGroupTasks } from "@/lib/server/wbs";

const pct = (value: number | null) => (value === null ? "-" : `${Math.round(value * 100)}%`);
const dot = (value: string | null) => (value ? value.replaceAll("-", ".") : "");

export function WbsGroupTasksScreen({ tasks }: { tasks: WbsGroupTasks }) {
  const { group, delayedOnly, overall, items } = tasks;
  const groupTitle = group || "전체";

  const itemsByOwner = new Map<string, typeof items>();
  for (const item of items) {
    const owner = item.ownerName ?? "담당자 없음";
    const bucket = itemsByOwner.get(owner) ?? [];
    bucket.push(item);
    itemsByOwner.set(owner, bucket);
  }
  const owners = [...itemsByOwner.entries()]
    .map(([owner, rows]) => {
      const rollup = rollupProgress(rows.map((row) => ({ weight: row.weight || row.workingDays || 0, planned: row.plannedProgress ?? 0, actual: row.actualProgress })));
      return { owner, itemCount: rows.length, planned: rollup.planned, actual: rollup.actual, delayed: rollup.actual < rollup.planned };
    })
    .sort((a, b) => b.itemCount - a.itemCount || a.owner.localeCompare(b.owner, "ko"));
  const chartData = owners.map((row) => ({ stage: row.owner, planned: row.planned, actual: row.actual, delayed: row.delayed }));

  return <>
    <header className="topbar"><div><h1>{groupTitle} {delayedOnly ? "지연 Task" : "Task"} 조회</h1><p>{delayedOnly ? "실적이 목표에 못 미치는 항목만 표시합니다." : "업무그룹 담당자 전체의 Task 목록입니다."} 총 {items.length}건</p></div><div className="topbar-actions"><Link className="button secondary" href="/wbs/group-stats">업무그룹별 통계로</Link></div></header>
    <div className="content">
      <section className="kpi-grid">
        <div className="kpi"><span>목표(today)</span><strong>{pct(overall.planned)}</strong><small>계획 공정율</small></div>
        <div className="kpi"><span>실적</span><strong>{pct(overall.actual)}</strong><small>실적 공정율</small></div>
        <div className="kpi"><span>진척율</span><strong className={overall.progressIndex < 1 ? "critical" : undefined}>{pct(overall.progressIndex)}</strong><small>실적/계획</small></div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>담당자별 작업현황</h2><span>{owners.length}명</span></div>
        {owners.length ? <>
          <WbsStageChart stages={chartData} />
          <div className="table-wrap"><table><thead><tr><th>담당자</th><th>Task 건수</th><th>목표</th><th>실적</th><th>진척율</th><th>상태</th></tr></thead>
            <tbody>{owners.map((row) => <tr key={row.owner}>
              <td>{row.owner}</td>
              <td>{row.itemCount}건</td>
              <td>{pct(row.planned)}</td>
              <td>{pct(row.actual)}</td>
              <td>{row.planned === 0 ? "-" : `${Math.round((row.actual / row.planned) * 100)}%`}</td>
              <td>{row.delayed ? <span className="badge band-red">지연</span> : <span className="badge band-green">정상</span>}</td>
            </tr>)}</tbody>
            <tfoot><tr className="totals-row">
              <td>합계</td>
              <td>{items.length}건</td>
              <td>{pct(overall.planned)}</td>
              <td>{pct(overall.actual)}</td>
              <td>{overall.planned === 0 ? "-" : `${Math.round((overall.actual / overall.planned) * 100)}%`}</td>
              <td>{overall.actual < overall.planned ? <span className="badge band-red">지연</span> : <span className="badge band-green">정상</span>}</td>
            </tr></tfoot>
          </table></div>
        </> : <div className="empty">담당자 정보가 없습니다.</div>}
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Task 목록</h2><span>{items.length}건</span></div>
        {items.length ? <div className="table-wrap"><table>
          <thead><tr><th>Task</th><th>Task Description</th><th>담당자</th><th>Stage</th><th>StartDate</th><th>DueDate</th><th>목표</th><th>실적</th><th>진척율</th></tr></thead>
          <tbody>{items.map((item) => <ClickableTableRow href={`/wbs/${item.id}`} ariaLabel={`${item.name} WBS 상세보기`} key={item.id}>
            <td className="mono">{item.code}</td>
            <td className="title-cell"><Link className="table-link" href={`/wbs/${item.id}`}>{item.name}</Link></td>
            <td>{item.ownerName ?? ""}</td>
            <td>{item.stage ?? ""}</td>
            <td>{dot(item.startDate)}</td>
            <td>{dot(item.dueDate)}</td>
            <td>{pct(item.plannedProgress)}</td>
            <td>{pct(item.actualProgress)}</td>
            <td>{pct(item.progressIndex)}</td>
          </ClickableTableRow>)}</tbody>
        </table></div> : <div className="empty">조건에 맞는 WBS 항목이 없습니다.</div>}
      </section>
    </div>
  </>;
}
