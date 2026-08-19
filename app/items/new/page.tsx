import { requirePmPmoContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { ItemCreateScreen } from "@/screens/ItemCreateScreen";

export const dynamic = "force-dynamic";

export default async function NewItemPage() {
  const { projectId } = await requirePmPmoContext();
  const options = await getCodeOptions(projectId);
  return <ItemCreateScreen options={options} />;
}
