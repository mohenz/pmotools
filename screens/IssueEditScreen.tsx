import Link from "next/link";
import type { CommonCode } from "@/lib/server/common-codes";
import type { IssueRow } from "@/lib/server/issues";
import type { ProjectMemberOption } from "@/lib/server/users";
import { IssueFormActions } from "@/features/issues/IssueFormActions";

export function IssueEditScreen({ detail, options, members }: { detail: { issue: IssueRow }; options: { issueTypes: CommonCode[]; reportLines: CommonCode[] }; members: ProjectMemberOption[] }) {
  const { issue } = detail;
  return <>
    <header className="topbar"><div><p className="mono">{issue.displayId}</p><h1>{issue.title}</h1></div><div className="topbar-actions"><Link className="button secondary" href="/issues">목록으로</Link><Link className="button primary" href="/issues/new">+ 신규 등록</Link></div></header>
    <div className="content"><IssueFormActions issue={issue} options={options} members={members} /></div>
  </>;
}
