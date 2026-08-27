import Link from "next/link";
import { BAND_LABEL, MANAGEMENT_TASK_AXES, MANAGEMENT_TASK_STATUSES } from "@/lib/domain/management-tasks";
import type { ManagementTaskDetail } from "@/lib/server/management-tasks";

const AXIS_FIELDS = {
  prep: { content: "prepContent", percent: "prepPercent" },
  owner: { content: "ownerContent", percent: "ownerPercent" },
  progress: { content: "progressContent", percent: "progressPercent" },
  issue: { content: "issueContent", percent: "issuePercent" },
  close: { content: "closeContent", percent: "closePercent" },
} as const;

export function ManagementTaskDetailScreen({ detail }: { detail: ManagementTaskDetail }) {
  const { task } = detail;
  return <>
    <header className="topbar"><div><p className="mono">{task.displayId}</p><h1>{task.name}</h1></div><div className="topbar-actions"><Link className="button secondary" href="/management-tasks">목록으로</Link><Link className="button primary" href={`/management-tasks/${task.id}/edit`}>수정</Link></div></header>
    <div className="content detail-layout">
      <section className="detail-main">
        <article className="panel detail-summary">
          <div className="detail-badges"><span className={`badge band-${task.band}`}>{BAND_LABEL[task.band]} · 총점 {task.totalScore}점</span><span className="badge">{task.groupLabel}</span></div>
          <div className="table-wrap"><table className="management-task-summary-table"><tbody>
            <tr><th scope="row">등록일자</th><td>{task.registrationDate}</td></tr>
            <tr><th scope="row">담당자</th><td>{task.assignees.length ? task.assignees.map((assignee) => assignee.name).join(", ") : "-"}</td></tr>
            <tr><th scope="row">진행현황</th><td>{MANAGEMENT_TASK_STATUSES.find((status) => status.value === task.status)?.label}</td></tr>
            <tr><th scope="row">관리목적</th><td className="prewrap">{task.purpose || "-"}</td></tr>
            <tr><th scope="row">영향도분석</th><td className="prewrap">{task.impactAnalysis || "-"}</td></tr>
            {MANAGEMENT_TASK_AXES.map((axis) => {
              const fields = AXIS_FIELDS[axis.key];
              return <tr key={axis.key}><th scope="row">{axis.label} <small>({task[fields.percent]}% · {Math.round(task[fields.percent] * 0.2)}점)</small></th><td className="prewrap">{task[fields.content] || "-"}</td></tr>;
            })}
          </tbody></table></div>
        </article>
      </section>
    </div>
  </>;
}
