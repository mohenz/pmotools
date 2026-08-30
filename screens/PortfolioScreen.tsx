import Link from "next/link";
import { BAND_LABEL } from "@/lib/domain/management-tasks";
import type { PortfolioDashboard } from "@/lib/server/work-management";
import type { WbsStats, WbsOwnerStatus } from "@/lib/server/wbs";
import type { RequirementStatistics } from "@/lib/server/requirements";
import type { ManagementTaskDashboard } from "@/lib/server/management-tasks";
import type { InvitationSummary } from "@/lib/server/messages";
import { ManagementBandChart, RequirementStatusChart, WbsProgressChart } from "@/components/PortfolioDomainCharts";
import { ClickableTableRow } from "@/components/ClickableTableRow";

const pct = (value: number) => Math.round(value * 100);
const pctOrDash = (value: number | null) => (value === null ? "-" : `${Math.round(value * 100)}%`);
const fmt = (value: number) => value.toLocaleString("ko-KR");
const dot = (value: string | null) => (value ? value.replaceAll("-", ".") : "");
const invitationDateFormat = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" });

function invitationTitle(invitation: InvitationSummary) {
  if (invitation.messageType === "CALENDAR_INVITATION") return invitation.calendarInvitation?.title ?? "일정 초청";
  return invitation.meetingInvitation?.roomName ?? "회의실 예약 초청";
}

export function PortfolioScreen({ dashboard, wbsStats, requirementStats, managementDashboard, invitations, myWbsStatus }: {
  dashboard: PortfolioDashboard;
  wbsStats: WbsStats;
  requirementStats: RequirementStatistics;
  managementDashboard: ManagementTaskDashboard;
  invitations: InvitationSummary[];
  myWbsStatus: WbsOwnerStatus;
}) {
  const unreadInvitations = invitations.filter((invitation) => !invitation.isRead).length;
  const recentInvitations = invitations.slice(0, 5);
  // 미완료 Task를 먼저 보여주되, 전부 완료된 담당자라도 목록이 비지 않도록 완료 건도 뒤이어 채운다.
  const myTasks = [...(myWbsStatus?.items ?? [])]
    .sort((a, b) => {
      const doneA = a.actualProgress >= 1 ? 1 : 0, doneB = b.actualProgress >= 1 ? 1 : 0;
      if (doneA !== doneB) return doneA - doneB;
      return (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99");
    })
    .slice(0, 8);
  return <>
    <header className="topbar"><div><h1>통합 대시보드</h1><p>{dashboard.currentWeek?.label ?? "등록 주차 없음"} 프로젝트 업무 현황</p></div></header>
    <div className="content">
      <section className="portfolio-domain-grid" aria-label="핵심 업무 현황">
        <Link href="/wbs/stats" className="panel domain-summary">
          <div className="panel-head"><h2>WBS 진척</h2><span>{fmt(wbsStats.itemCount)}건</span></div>
          <WbsProgressChart planned={wbsStats.overall.planned} actual={wbsStats.overall.actual} />
          <p className="domain-summary-foot">지연 <strong className={wbsStats.delayedCount > 0 ? "critical" : undefined}>{fmt(wbsStats.delayedCount)}건</strong> · 전체 지연율 <strong>{pct(wbsStats.delayRate)}%</strong></p>
        </Link>

        <Link href="/requirements/statistics" className="panel domain-summary">
          <div className="panel-head"><h2>요구사항관리</h2><span>{fmt(requirementStats.total)}건</span></div>
          <RequirementStatusChart accepted={requirementStats.accepted} partiallyAccepted={requirementStats.partiallyAccepted} rejected={requirementStats.rejected} />
          <p className="domain-summary-foot">수용률 <strong>{requirementStats.total ? Math.round((requirementStats.accepted / requirementStats.total) * 100) : 0}%</strong></p>
        </Link>

        <Link href="/management-tasks/dashboard" className="panel domain-summary">
          <div className="panel-head"><h2>관리업무</h2><span>{fmt(managementDashboard.summary.total)}건</span></div>
          <ManagementBandChart red={managementDashboard.summary.red} yellow={managementDashboard.summary.yellow} green={managementDashboard.summary.green} />
          <p className="domain-summary-foot">
            프로젝트 점수 <strong>{managementDashboard.projectScore ?? "-"}</strong>
            {managementDashboard.projectBand && <span className={`badge band-${managementDashboard.projectBand}`}>{BAND_LABEL[managementDashboard.projectBand]}</span>}
          </p>
        </Link>
      </section>

      <section className="action-grid">
        <div className="panel">
          <div className="panel-head"><h2>초청 정보</h2><span>{unreadInvitations > 0 ? `미확인 ${unreadInvitations}건` : `${invitations.length}건`}</span></div>
          <div className="history-list dashboard-subpanel-scroll">
            {recentInvitations.map((invitation) => <Link href="/messages" className="history-item" key={invitation.id}>
              <div>
                <small>{invitation.messageType === "CALENDAR_INVITATION" ? "일정 초청" : "회의실 예약 초청"} · {invitation.senderName}</small>
                {!invitation.isRead && <span className="badge issue">미확인</span>}
              </div>
              <p>{invitationTitle(invitation)}</p>
              <time>{invitationDateFormat.format(new Date(invitation.createdAt))}</time>
            </Link>)}
            {!recentInvitations.length && <div className="empty">받은 초청이 없습니다.</div>}
          </div>
          {invitations.length > recentInvitations.length && <Link className="text-button" href="/messages">전체 {invitations.length}건 보기</Link>}
        </div>

        <div className="panel">
          <div className="panel-head"><h2>WBS 현황</h2><span>{wbsStats.stages.length}개 Stage · {fmt(wbsStats.itemCount)}건</span></div>
          <div className="table-wrap dashboard-subpanel-scroll">
            <table><thead><tr><th>Stage</th><th>건수</th><th>계획</th><th>실적</th><th>상태</th></tr></thead>
              <tbody>{wbsStats.stages.map((stage) => <tr key={stage.stage}>
                <td>{stage.stage}</td>
                <td data-numeric>{fmt(stage.itemCount)}건</td>
                <td data-numeric>{pct(stage.planned)}%</td>
                <td data-numeric>{pct(stage.actual)}%</td>
                <td>{stage.delayed ? <span className="badge band-red">지연</span> : <span className="badge band-green">정상</span>}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <Link className="text-button" href="/wbs/stats">전체 통계 보기</Link>
        </div>
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
