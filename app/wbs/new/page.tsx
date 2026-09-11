import { getLocalContext } from "@/lib/server/context";
import { listProjectMembers } from "@/lib/server/users";
import { listWbsItems, listWbsWorkGroups } from "@/lib/server/wbs";
import { WbsCreateScreen } from "@/screens/WbsCreateScreen";

export const dynamic = "force-dynamic";

export default async function NewWbsItemPage() {
  const { projectId } = await getLocalContext();
  const [items, groups, members] = await Promise.all([listWbsItems(projectId), listWbsWorkGroups(projectId), listProjectMembers(projectId)]);
  return <WbsCreateScreen items={items} groups={groups} members={members} />;
}
