import { getLocalContext } from "@/lib/server/context";
import { getManagementTaskDashboard } from "@/lib/server/management-tasks";
import { ManagementTaskDashboardScreen } from "@/screens/ManagementTaskDashboardScreen";

export const dynamic = "force-dynamic";

export default async function ManagementTaskDashboardPage() {
  const { projectId } = await getLocalContext();
  const data = await getManagementTaskDashboard(projectId);
  return <ManagementTaskDashboardScreen data={data} />;
}
