import { getLocalContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { listProjectMembers } from "@/lib/server/users";
import { listWbsItems } from "@/lib/server/wbs";
import { WbsCreateScreen } from "@/screens/WbsCreateScreen";

export const dynamic = "force-dynamic";

export default async function NewWbsItemPage() {
  const { projectId } = await getLocalContext();
  const [items, options, members] = await Promise.all([listWbsItems(projectId), getCodeOptions(projectId), listProjectMembers(projectId)]);
  return <WbsCreateScreen items={items} groups={options.tracks} members={members} />;
}
