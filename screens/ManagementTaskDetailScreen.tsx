import Link from "next/link";
import { BAND_LABEL, MANAGEMENT_TASK_STATUSES } from "@/lib/domain/management-tasks";
import type { ManagementTaskAxisActionItems } from "@/lib/server/action-items";
import type { ManagementTaskDetail } from "@/lib/server/management-tasks";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ProjectMemberOption } from "@/lib/server/users";
import { ActionItemBoard } from "@/features/management-tasks/ActionItemBoard";

export function ManagementTaskDetailScreen({ detail, axes, groups, members, categories }: { detail: ManagementTaskDetail; axes: ManagementTaskAxisActionItems[]; groups: CommonCode[]; members: ProjectMemberOption[]; categories: CommonCode[] }) {
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
          </tbody></table></div>
        </article>
        <ActionItemBoard taskId={task.id} axes={axes} groups={groups} members={members} categories={categories} />
      </section>
    </div>
  </>;
}
