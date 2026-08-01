import { getLocalContext } from "@/lib/server/context";
import { listCommonCodeGroups, listCommonCodes } from "@/lib/server/common-codes";
import { CommonCodeSettingsScreen } from "@/screens/CommonCodeSettingsScreen";

export const dynamic = "force-dynamic";

export default async function CommonCodeSettingsPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const { projectId } = getLocalContext();
  const groups = await listCommonCodeGroups(projectId);
  const requested = (await searchParams).group;
  const selectedGroup = groups.find((group) => group.id === requested) ?? groups[0] ?? null;
  const codes = selectedGroup ? await listCommonCodes(projectId, true, selectedGroup.id) : [];
  return <CommonCodeSettingsScreen groups={groups} selectedGroup={selectedGroup} codes={codes} />;
}
