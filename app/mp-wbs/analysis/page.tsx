// [WBS2 계열] 원본: app/wbs/analysis/page.tsx. 계산(lib/domain/wbs-workload.ts)과 화면(screens/WbsAnalysisScreens.tsx)은 원본과 공유한다.
import { getMpScope } from "@/lib/server/mp/context";
import { getWbsWorkload } from "@/lib/server/mp/wbs";
import { WbsAnalysisDashboardScreen } from "@/screens/WbsAnalysisScreens";

export const dynamic = "force-dynamic";

export default async function WbsAnalysisDashboardPage() {
  const scope = await getMpScope();
  const targetId = scope.isTopLevel ? scope.projects.map((p) => p.id) : scope.context.projectId;
  const analysis = await getWbsWorkload(targetId);
  return <WbsAnalysisDashboardScreen analysis={analysis} basePath="/mp-wbs" />;
}
