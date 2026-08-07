import { requireAdminContext } from "@/lib/server/context";
import { listGroups } from "@/lib/server/admin";
import { GroupManagementScreen } from "@/screens/GroupManagementScreen";

export const dynamic = "force-dynamic";

export default async function GroupsSettingsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { projectId } = await requireAdminContext();
  const groupType = (await searchParams).type === "COMPANY" ? "COMPANY" as const : "WORK_MODULE" as const;
  const groups = await listGroups(projectId, groupType);
  return <GroupManagementScreen groups={groups} groupType={groupType} />;
}
