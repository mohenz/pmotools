import { requireManagerContext } from "@/lib/server/context";
import { getWbsWorkload, listWbsWorkloadTasks } from "@/lib/server/wbs";
import { WbsProductivityDetailScreen, WbsProductivityScreen } from "@/screens/WbsAnalysisScreens";

export const dynamic = "force-dynamic";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function WbsProductivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId } = await requireManagerContext();
  const [analysis, query] = await Promise.all([getWbsWorkload(projectId), searchParams]);
  const groupLabel = first(query.group), ownerKey = first(query.owner);
  const group = groupLabel ? analysis.groups.find((row) => row.groupLabel === groupLabel) : undefined;
  const owner = ownerKey ? analysis.owners.find((row) => row.ownerKey === ownerKey) : undefined;
  if (group) {
    const tasks = await listWbsWorkloadTasks(projectId, { groupLabel: group.groupLabel });
    return <WbsProductivityDetailScreen analysis={analysis} basePath="/wbs" kind="group" row={{ title: group.groupLabel, groupLabel: group.groupLabel, perf: group.perf, owners: group.owners }} tasks={tasks} />;
  }
  if (owner) {
    const tasks = await listWbsWorkloadTasks(projectId, { ownerKey: owner.ownerKey });
    return <WbsProductivityDetailScreen analysis={analysis} basePath="/wbs" kind="owner" row={{ title: owner.ownerName, groupLabel: owner.groupLabel, perf: owner.perf }} tasks={tasks} />;
  }
  return <WbsProductivityScreen analysis={analysis} basePath="/wbs" />;
}
