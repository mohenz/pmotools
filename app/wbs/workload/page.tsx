import { requireManagerContext } from "@/lib/server/context";
import { getWbsWorkload, listWbsWorkloadTasks } from "@/lib/server/wbs";
import { WbsWorkloadDetailScreen, WbsWorkloadScreen } from "@/screens/WbsAnalysisScreens";

export const dynamic = "force-dynamic";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function WbsWorkloadPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId } = await requireManagerContext();
  const [analysis, query] = await Promise.all([getWbsWorkload(projectId), searchParams]);
  const groupLabel = first(query.group), ownerKey = first(query.owner);
  const group = groupLabel ? analysis.groups.find((row) => row.groupLabel === groupLabel) : undefined;
  const owner = ownerKey ? analysis.owners.find((row) => row.ownerKey === ownerKey) : undefined;
  if (group) {
    const tasks = await listWbsWorkloadTasks(projectId, { groupLabel: group.groupLabel });
    return <WbsWorkloadDetailScreen analysis={analysis} basePath="/wbs" group={group} tasks={tasks} />;
  }
  if (owner) {
    const tasks = await listWbsWorkloadTasks(projectId, { ownerKey: owner.ownerKey });
    return <WbsWorkloadDetailScreen analysis={analysis} basePath="/wbs" owner={owner} tasks={tasks} />;
  }
  return <WbsWorkloadScreen analysis={analysis} basePath="/wbs" />;
}
