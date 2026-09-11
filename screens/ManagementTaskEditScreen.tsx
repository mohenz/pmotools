import Link from "next/link";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ManagementTaskDetail } from "@/lib/server/management-tasks";
import type { ProjectMemberOption } from "@/lib/server/users";
import { ManagementTaskDetailActions } from "@/features/management-tasks/ManagementTaskDetailActions";

export function ManagementTaskEditScreen({ detail, groups, members }: { detail: ManagementTaskDetail; groups: CommonCode[]; members: ProjectMemberOption[] }) {
  const { task, predecessors, successors } = detail;
  return <>
    <header className="topbar">
      <div><p className="mono">{task.displayId}</p><h1>{task.name} 수정</h1></div>
      <div className="topbar-actions"><Link className="button secondary" href={`/management-tasks/${task.id}`}>조회 화면으로</Link><Link className="button secondary" href="/management-tasks">목록으로</Link></div>
    </header>
    <div className="content detail-layout"><section className="detail-main">
      <ManagementTaskDetailActions task={task} predecessors={predecessors} successors={successors} groups={groups} members={members} />
    </section></div>
  </>;
}
