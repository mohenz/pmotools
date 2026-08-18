import { requireManagerContext } from "@/lib/server/context";
import { getWorkOptions, listWeeklyReports } from "@/lib/server/work-management";
import { WeeklyReportManagementScreen } from "@/screens/WeeklyReportManagementScreen";

export const dynamic = "force-dynamic";

export default async function WeeklyReportManagementPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { projectId } = await requireManagerContext();
  const { week } = await searchParams;
  const [options, reports] = await Promise.all([getWorkOptions(projectId), listWeeklyReports(projectId, week)]);
  return <WeeklyReportManagementScreen reports={reports} weeks={options.weeks} selectedWeek={week ?? ""} />;
}
