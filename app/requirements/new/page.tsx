import { requireManagerContext } from "@/lib/server/context";
import { listProjectMembers } from "@/lib/server/users";
import { listRequirementCodeOptions } from "@/lib/server/requirements";
import { RequirementCreateScreen } from "@/screens/RequirementCreateScreen";

export const dynamic = "force-dynamic";

export default async function RequirementCreatePage() {
  const { projectId } = await requireManagerContext();
  const [members, codeOptions] = await Promise.all([listProjectMembers(projectId), listRequirementCodeOptions(projectId)]);
  return <RequirementCreateScreen options={{ members, ...codeOptions }} />;
}
