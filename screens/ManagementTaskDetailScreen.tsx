import Link from "next/link";
import { BAND_LABEL, MANAGEMENT_TASK_AXES } from "@/lib/domain/management-tasks";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ManagementTaskDetail } from "@/lib/server/management-tasks";
import { ManagementTaskDetailActions } from "@/features/management-tasks/ManagementTaskDetailActions";

const AXIS_FIELDS = {
  prep: { content: "prepContent", percent: "prepPercent" },
  owner: { content: "ownerContent", percent: "ownerPercent" },
  progress: { content: "progressContent", percent: "progressPercent" },
  issue: { content: "issueContent", percent: "issuePercent" },
  close: { content: "closeContent", percent: "closePercent" },
} as const;

export function ManagementTaskDetailScreen({ detail, groups }: { detail: ManagementTaskDetail; groups: CommonCode[] }) {
  const { task, predecessors, successors } = detail;
  return <>
    <header className="topbar"><div><p className="mono">{task.displayId}</p><h1>{task.name}</h1></div><div className="topbar-actions"><Link className="button secondary" href="/management-tasks">목록으로</Link><Link className="button primary" href="/management-tasks/new">+ 신규 등록</Link></div></header>
    <div className="content detail-layout">
      <section className="detail-main">
        <article className="panel detail-summary">
          <div className="detail-badges"><span className={`badge band-${task.band}`}>{BAND_LABEL[task.band]} · 총점 {task.totalScore}점</span><span className="badge">{task.groupLabel}</span></div>
          <dl>
            <div><dt>등록일자</dt><dd>{task.registrationDate}</dd></div>
            {MANAGEMENT_TASK_AXES.map((axis) => {
              const fields = AXIS_FIELDS[axis.key];
              return <div key={axis.key}><dt>{axis.label} ({task[fields.percent]}% · {Math.round(task[fields.percent] * 0.2)}점)</dt><dd className="prewrap">{task[fields.content] || "-"}</dd></div>;
            })}
          </dl>
        </article>
        <ManagementTaskDetailActions task={task} predecessors={predecessors} successors={successors} groups={groups} />
      </section>
    </div>
  </>;
}
