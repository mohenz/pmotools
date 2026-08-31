import { getLocalContext } from "@/lib/server/context";
import { getWorkLogIdentity } from "@/lib/server/work-logs";
import { listWbsTaskOptionsForOwner } from "@/lib/server/wbs";
import { WorkLogFormScreen } from "@/screens/WorkLogFormScreen";

export const dynamic = "force-dynamic";

export default async function NewWorkLogPage() {
  const { projectId, userId } = await getLocalContext();
  const [identity, wbsOptions] = await Promise.all([getWorkLogIdentity(projectId, userId), listWbsTaskOptionsForOwner(projectId, userId)]);
  const groups = identity.group ? [{ id: identity.group.id, groupId: identity.group.id, groupCode: "track", groupLabel: "업무그룹", code: identity.group.code, label: identity.group.label, sortOrder: 0, isActive: true, minScore: null }] : [];
  return <WorkLogFormScreen mode="create" groups={groups} assigneeName={identity.name} wbsOptions={wbsOptions} />;
}
