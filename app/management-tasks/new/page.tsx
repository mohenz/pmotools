import { getLocalContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { ManagementTaskCreateScreen } from "@/screens/ManagementTaskCreateScreen";
import { listProjectMembers } from "@/lib/server/users";

export const dynamic = "force-dynamic";

export default async function NewManagementTaskPage() {
  const { projectId } = await getLocalContext();
  const [options, members] = await Promise.all([getCodeOptions(projectId), listProjectMembers(projectId)]);
  return <ManagementTaskCreateScreen groups={options.tracks} members={members} />;
}
