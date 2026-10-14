import { requireSuperAdminContext } from "@/lib/server/context";
import { listGlobalCommonCodeGroups, listGlobalCommonCodes } from "@/lib/server/common-codes";
import { GlobalCommonCodeScreen } from "@/screens/GlobalCommonCodeScreen";

export const dynamic = "force-dynamic";

export default async function GlobalCommonCodesPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  await requireSuperAdminContext();
  const groups = await listGlobalCommonCodeGroups();
  const { group: groupId } = await searchParams;
  const selectedGroup = groups.find((g) => g.id === groupId) ?? groups[0] ?? null;
  const codes = selectedGroup ? await listGlobalCommonCodes(selectedGroup.id) : [];
  return <GlobalCommonCodeScreen groups={groups} selectedGroup={selectedGroup} codes={codes} />;
}
