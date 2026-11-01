// [WBS2 계열] 원본: app/wbs/workload/page.tsx. 계산(lib/domain/wbs-workload.ts)과 화면(screens/WbsAnalysisScreens.tsx)은 원본과 공유한다.
import { getMpScope } from "@/lib/server/mp/context";
import { getWbsWorkload, listWbsWorkloadTasks } from "@/lib/server/mp/wbs";
import { WbsWorkloadDetailScreen, WbsWorkloadScreen } from "@/screens/WbsAnalysisScreens";

export const dynamic = "force-dynamic";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function WbsWorkloadPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const scope = await getMpScope();
  const targetId = scope.isTopLevel ? scope.projects.map((p) => p.id) : scope.context.projectId;
  const [analysis, query] = await Promise.all([getWbsWorkload(targetId), searchParams]);
  const groupLabel = first(query.group), ownerKey = first(query.owner);
  const group = groupLabel ? analysis.groups.find((row) => row.groupLabel === groupLabel) : undefined;
  const owner = ownerKey ? analysis.owners.find((row) => row.ownerKey === ownerKey) : undefined;
  if (group) {
    const tasks = await listWbsWorkloadTasks(targetId, { groupLabel: group.groupLabel });
    return <WbsWorkloadDetailScreen analysis={analysis} basePath="/mp-wbs" group={group} tasks={tasks} />;
  }
  if (owner) {
    const tasks = await listWbsWorkloadTasks(targetId, { ownerKey: owner.ownerKey });
    return <WbsWorkloadDetailScreen analysis={analysis} basePath="/mp-wbs" owner={owner} tasks={tasks} />;
  }
  return <WbsWorkloadScreen analysis={analysis} basePath="/mp-wbs" />;
}
