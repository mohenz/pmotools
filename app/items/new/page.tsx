import { getLocalContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { ItemCreateScreen } from "@/screens/ItemCreateScreen";

export const dynamic = "force-dynamic";

export default async function NewItemPage() {
  const { projectId } = getLocalContext();
  const options = await getCodeOptions(projectId);
  return <ItemCreateScreen options={options} />;
}
