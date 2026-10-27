import { requireAdminContext } from "@/lib/server/context";
import { listGroups } from "@/lib/server/admin";
import { GroupManagementScreen } from "@/screens/GroupManagementScreen";
import { listProjectMembers } from "@/lib/server/users";
import { resolveRootProjectId } from "@/lib/server/project-access";

export const dynamic = "force-dynamic";

export default async function GroupsSettingsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { projectId } = await requireAdminContext();
  const groupType = (await searchParams).type === "COMPANY" ? "COMPANY" as const : "WORK_MODULE" as const;
  const [groups, members, rootProjectId] = await Promise.all([
    listGroups(projectId, groupType),
    listProjectMembers(projectId),
    resolveRootProjectId(projectId),
  ]);
  const isSubProject = rootProjectId !== projectId;
  return <GroupManagementScreen groups={groups} groupType={groupType} members={members} isSubProject={isSubProject} />;
}
