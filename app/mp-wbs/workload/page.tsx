// [WBS2 계열] 원본: app/wbs/workload/page.tsx. 계산(lib/domain/wbs-workload.ts)과 화면(screens/WbsAnalysisScreens.tsx)은 원본과 공유한다.
import { getMpScope } from "@/lib/server/mp/context";
import { getWbsWorkload } from "@/lib/server/mp/wbs";
import { WbsWorkloadScreen } from "@/screens/WbsAnalysisScreens";

export const dynamic = "force-dynamic";

export default async function WbsWorkloadPage() {
  const scope = await getMpScope();
  const targetId = scope.isTopLevel ? scope.projects.map((p) => p.id) : scope.context.projectId;
  const analysis = await getWbsWorkload(targetId);
  return <WbsWorkloadScreen analysis={analysis} />;
}
