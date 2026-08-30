import Link from "next/link";
import { BAND_LABEL } from "@/lib/domain/management-tasks";
import type { PortfolioDashboard, ProgressRow } from "@/lib/server/work-management";
import type { WbsStats } from "@/lib/server/wbs";
import type { RequirementStatistics } from "@/lib/server/requirements";
import type { ManagementTaskDashboard } from "@/lib/server/management-tasks";

const pct = (value: number) => Math.round(value * 100);
const fmt = (value: number) => value.toLocaleString("ko-KR");

export function PortfolioScreen({ dashboard, rows, wbsStats, requirementStats, managementDashboard }: {
  dashboard: PortfolioDashboard;
  rows: ProgressRow[];
  wbsStats: WbsStats;
  requirementStats: RequirementStatistics;
  managementDashboard: ManagementTaskDashboard;
}) {
  return <>
    <header className="topbar"><div><h1>통합 대시보드</h1><p>{dashboard.currentWeek?.label ?? "등록 주차 없음"} 프로젝트 업무 현황</p></div></header>
    <div className="content">
      <section className="kpi-grid" aria-label="핵심 지표">
        <Link className="kpi" href="/items"><span>열린 이슈</span><strong>{dashboard.openIssues}</strong><small>접수·진행중</small></Link>
        <Link className="kpi" href="/weekly-progress"><span>지연 업무</span><strong className="critical">{dashboard.delayedCount}</strong><small>목표일 경과</small></Link>
        <Link className="kpi" href="/weekly-progress"><span>평균 공정률</span><strong>{dashboard.averageProgress}%</strong><small>전체 실적</small></Link>
        <Link className="kpi" href="/weekly-reports"><span>위클리리포트</span><strong>{dashboard.reportCount}</strong><small>작성 건수</small></Link>
      </section>

      <section className="portfolio-domain-grid" aria-label="핵심 업무 현황">
        <Link href="/wbs/stats" className="panel domain-summary">
          <div className="panel-head"><h2>WBS 진척</h2><span>{fmt(wbsStats.itemCount)}건</span></div>
          <div className="domain-summary-metrics">
            <div><span>목표(계획)</span><strong>{pct(wbsStats.overall.planned)}%</strong></div>
            <div><span>실적</span><strong>{pct(wbsStats.overall.actual)}%</strong></div>
            <div><span>지연</span><strong className={wbsStats.delayedCount > 0 ? "critical" : undefined}>{fmt(wbsStats.delayedCount)}건</strong></div>
          </div>
          <p className="domain-summary-foot">전체 지연율 <strong>{pct(wbsStats.delayRate)}%</strong></p>
        </Link>

        <Link href="/requirements/statistics" className="panel domain-summary">
          <div className="panel-head"><h2>요구사항관리</h2><span>{fmt(requirementStats.total)}건</span></div>
          <div className="domain-summary-metrics">
            <div><span>수용</span><strong>{fmt(requirementStats.accepted)}</strong></div>
            <div><span>부분수용</span><strong>{fmt(requirementStats.partiallyAccepted)}</strong></div>
            <div><span>미수용</span><strong className={requirementStats.rejected > 0 ? "critical" : undefined}>{fmt(requirementStats.rejected)}</strong></div>
          </div>
          <p className="domain-summary-foot">수용률 <strong>{requirementStats.total ? Math.round((requirementStats.accepted / requirementStats.total) * 100) : 0}%</strong></p>
        </Link>

        <Link href="/management-tasks/dashboard" className="panel domain-summary">
          <div className="panel-head"><h2>관리업무</h2><span>{fmt(managementDashboard.summary.total)}건</span></div>
          <div className="domain-summary-metrics">
            <div><span>위험</span><strong className={managementDashboard.summary.red > 0 ? "critical" : undefined}>{fmt(managementDashboard.summary.red)}</strong></div>
            <div><span>주의</span><strong>{fmt(managementDashboard.summary.yellow)}</strong></div>
            <div><span>양호</span><strong>{fmt(managementDashboard.summary.green)}</strong></div>
          </div>
          <p className="domain-summary-foot">
            프로젝트 점수 <strong>{managementDashboard.projectScore ?? "-"}</strong>
            {managementDashboard.projectBand && <span className={`badge band-${managementDashboard.projectBand}`}>{BAND_LABEL[managementDashboard.projectBand]}</span>}
          </p>
        </Link>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>공정률 현황</h2><span>인력 {dashboard.currentStaff}명 → 차주 {dashboard.nextStaff}명</span></div>
        <div className="progress-board">{rows.map((r) => <Link href={`/weekly-progress?edit=${r.id}`} className="progress-card" key={r.id}>
          <span>{r.areaLabel} · {r.weekLabel}</span><strong>{r.taskName}</strong>
          <div><i style={{ width: `${r.progress}%` }} /><b>{r.progress}%</b></div>
          {r.delayed && <em>지연</em>}
        </Link>)}</div>
      </section>
    </div>
  </>;
}
