import Link from "next/link";
import { BAND_LABEL, MANAGEMENT_TASK_STATUSES } from "@/lib/domain/management-tasks";
import type { ManagementTaskDashboard, ManagementTaskRow } from "@/lib/server/management-tasks";
import { ManagementTaskDashboardView } from "@/features/management-tasks/ManagementTaskDashboardView";

export function ManagementTaskDashboardScreen({ data }: { data: ManagementTaskDashboard }) {
  return <>
    <header className="topbar">
      <div><h1>프로젝트통합모니터링</h1><p>관리업무항목 현황</p></div>
      <div className="topbar-actions"><Link className="button secondary" href="/management-tasks">전체 목록</Link><Link className="button primary" href="/management-tasks/new">+ 신규 등록</Link></div>
    </header>
    <div className="content">
      <section className="kpi-grid kpi-grid-5" aria-label="핵심 지표">
        <Kpi href="/management-tasks" label="전체 등록 건수" value={data.summary.total} note="관리업무항목 누적" />
        <Kpi href="/management-tasks?band=red" label="위험" value={data.summary.red} note="0~40점" critical={data.summary.red > 0} />
        <Kpi href="/management-tasks?band=yellow" label="주의" value={data.summary.yellow} note="41~80점" />
        <Kpi href="/management-tasks?band=green" label="양호" value={data.summary.green} note="81~100점" />
        <Link href="/management-tasks" className={`kpi project-score ${data.projectBand ? `band-${data.projectBand}` : "band-empty"}`}>
          <span>프로젝트통합모니터링 점수</span>
          <strong>{data.projectScore ?? "-"}</strong>
          <small>{data.projectBand ? `${BAND_LABEL[data.projectBand]} · 등록 ${data.summary.total}건 평균` : "등록 항목 없음"}</small>
        </Link>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>관리업무항목 현황</h2><span>{data.tasks.length}건</span></div>
        {data.tasks.length ? <ManagementTaskDashboardView tasks={data.tasks} /> : <div className="empty">등록된 관리업무항목이 없습니다.</div>}
      </section>
    </div>
  </>;
}

function Kpi({ href, label, value, note, critical = false }: { href: string; label: string; value: number; note: string; critical?: boolean }) {
  return <Link href={href} className="kpi"><span>{label}</span><strong className={critical ? "critical" : ""}>{value}</strong><small>{note} · 목록 보기</small></Link>;
}

export function ManagementTaskTable({ tasks }: { tasks: ManagementTaskRow[] }) {
  return <div className="table-wrap"><table><thead><tr><th className="management-task-id">ID</th><th>관리업무항목명</th><th>업무모듈</th><th>담당자</th><th>진행현황</th><th>등록일</th><th>총점</th><th>평가상태</th></tr></thead>
    <tbody>{tasks.map((task) => <tr key={task.id}>
      <td className="mono management-task-id"><Link className="table-link" href={`/management-tasks/${task.id}`}>{task.displayId}</Link></td>
      <td className="title-cell"><Link className="table-link" href={`/management-tasks/${task.id}`}>{task.name}</Link></td>
      <td>{task.groupLabel}</td>
      <td>{task.assignees.map((assignee) => assignee.name).join(", ") || "-"}</td>
      <td>{MANAGEMENT_TASK_STATUSES.find((status) => status.value === task.status)?.label}</td>
      <td>{task.registrationDate}</td>
      <td className="mono">{task.totalScore}점</td>
      <td><span className={`badge band-${task.band}`}>{BAND_LABEL[task.band]}</span></td>
    </tr>)}</tbody></table></div>;
}
