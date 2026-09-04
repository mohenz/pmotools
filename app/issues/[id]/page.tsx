import { notFound } from "next/navigation";
import { requirePmPmoContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { listProjectMembers } from "@/lib/server/users";
import { getIssueDetail } from "@/lib/server/issues";
import { IssueEditScreen } from "@/screens/IssueEditScreen";

export const dynamic = "force-dynamic";

export default async function IssueEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId } = await requirePmPmoContext();
  const [detail, options, members] = await Promise.all([getIssueDetail(projectId, id), getCodeOptions(projectId), listProjectMembers(projectId)]);
  if (!detail) notFound();
  return <IssueEditScreen detail={detail} options={{ issueTypes: options.issueTypes, reportLines: options.reportLines }} members={members} />;
}
