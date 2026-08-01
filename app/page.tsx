import { getLocalContext } from "@/lib/server/context";
import { getDashboard } from "@/lib/server/items";
import { DashboardScreen } from "@/screens/DashboardScreen";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { projectId } = getLocalContext();
  const data = await getDashboard(projectId);
  return <DashboardScreen data={data} />;
}

