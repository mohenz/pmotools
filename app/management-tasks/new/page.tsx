import { requirePmPmoContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { ManagementTaskCreateScreen } from "@/screens/ManagementTaskCreateScreen";

export const dynamic = "force-dynamic";

export default async function NewManagementTaskPage() {
  const { projectId } = await requirePmPmoContext();
  const options = await getCodeOptions(projectId);
  return <ManagementTaskCreateScreen groups={options.tracks} />;
}
