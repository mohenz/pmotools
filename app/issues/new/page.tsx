import { requirePmPmoContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { listProjectMembers } from "@/lib/server/users";
import { IssueCreateScreen } from "@/screens/IssueCreateScreen";

export const dynamic = "force-dynamic";

export default async function NewIssuePage() {
  const { projectId } = await requirePmPmoContext();
  const [options, members] = await Promise.all([getCodeOptions(projectId), listProjectMembers(projectId)]);
  return <IssueCreateScreen options={{ issueTypes: options.issueTypes, reportLines: options.reportLines }} members={members} />;
}
