import Link from "next/link";
import { ClickableTableRow } from "@/components/ClickableTableRow";
import { WBS_ITEM_STATUS_LABEL } from "@/lib/domain/wbs";
import type { WbsOwnerStatus } from "@/lib/server/wbs";

const pct = (value: number | null) => (value === null ? "-" : `${Math.round(value * 100)}%`);
const dot = (value: string | null) => (value ? value.replaceAll("-", ".") : "");

export function WbsOwnerStatusScreen({ status }: { status: NonNullable<WbsOwnerStatus> }) {
  const { owner, overall, hasDelayed, items } = status;
  return <>
    <header className="topbar"><div><h1>{owner.name} WBS 현황</h1><p>담당 Task {items.length}건</p></div><div className="topbar-actions"><Link className="button secondary" href="/wbs">WBS 목록으로</Link></div></header>
    <div className="content">
      <section className="kpi-grid">
        <div className="kpi"><span>담당 목표(today)</span><strong>{pct(overall.planned)}</strong><small>계획 공정율</small></div>
        <div className="kpi"><span>담당 실적</span><strong>{pct(overall.actual)}</strong><small>실적 공정율</small></div>
        <div className="kpi"><span>담당 진척율</span><strong className={hasDelayed ? "critical" : undefined}>{pct(overall.progressIndex)}</strong><small>실적/계획{!hasDelayed && overall.progressIndex < 1 ? " · 마감 전 페이스, 지연 아님" : ""}</small></div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>담당 Task 목록</h2><span>{items.length}건</span></div>
        {items.length ? <div className="table-wrap"><table>
          <thead><tr><th>Task</th><th>Task Description</th><th>Stage</th><th>계획시작일</th><th>계획종료일</th><th>실적시작일</th><th>실적종료일</th><th>상태</th><th>지연일자</th><th>지연여부</th></tr></thead>
          <tbody>{items.map((item) => <ClickableTableRow href={`/wbs/${item.id}`} ariaLabel={`${item.name} WBS 상세보기`} key={item.id}>
            <td className="mono">{item.code}</td>
            <td className="title-cell"><Link className="table-link" href={`/wbs/${item.id}`}>{item.name}</Link></td>
            <td>{item.stage ?? ""}</td>
            <td>{dot(item.startDate)}</td>
            <td>{dot(item.dueDate)}</td>
            <td>{dot(item.actualStartDate)}</td>
            <td>{dot(item.actualDueDate)}</td>
            <td>{item.actualDueDate ? "완료" : WBS_ITEM_STATUS_LABEL[item.status]}</td>
            <td>{item.delayDays !== null ? `${item.delayDays}일` : "-"}</td>
            <td>{item.isDelayed ? <span className="badge band-red">지연</span> : ""}</td>
          </ClickableTableRow>)}</tbody>
        </table></div> : <div className="empty">담당 중인 WBS 항목이 없습니다.</div>}
      </section>
    </div>
  </>;
}
