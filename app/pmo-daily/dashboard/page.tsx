import { requirePmPmoContext } from "@/lib/server/context";
import { listOverdueMeetingActionItems } from "@/lib/server/meeting-action-items";
import { getPmoDailyHomeDashboard } from "@/lib/server/pmo-daily";
import { getWbsStats } from "@/lib/server/wbs";
import { PmoDailyDashboardScreen } from "@/screens/PmoDailyDashboardScreen";

export const dynamic = "force-dynamic";

function todayInKorea() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default async function PmoDailyDashboardPage() {
  const { projectId, userId } = await requirePmPmoContext();
  const today = todayInKorea();
  const [data, overdueActions, wbsStats] = await Promise.all([
    getPmoDailyHomeDashboard(projectId, today),
    listOverdueMeetingActionItems(projectId, userId, today),
    getWbsStats(projectId),
  ]);
  return <PmoDailyDashboardScreen data={data} overdueActions={overdueActions} wbsStats={wbsStats} />;
}
