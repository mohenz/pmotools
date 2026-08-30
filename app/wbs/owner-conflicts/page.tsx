import { getLocalContext } from "@/lib/server/context";
import { listAmbiguousWbsOwners } from "@/lib/server/wbs";
import { WbsOwnerConflictsScreen } from "@/screens/WbsOwnerConflictsScreen";

export const dynamic = "force-dynamic";

export default async function WbsOwnerConflictsPage() {
  const { projectId } = await getLocalContext();
  const conflicts = await listAmbiguousWbsOwners(projectId);
  return <WbsOwnerConflictsScreen conflicts={conflicts} />;
}
