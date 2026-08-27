import { notFound, redirect } from "next/navigation";
import { requirePmPmoContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { listProjectMembers } from "@/lib/server/users";
import { getPmoDailyDashboard } from "@/lib/server/pmo-daily";
import { PmoDailyScreen } from "@/screens/PmoDailyScreen";

export const dynamic = "force-dynamic";

export default async function PmoDailyDetailPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const { projectId } = await requirePmPmoContext();
  const [data, options, members] = await Promise.all([getPmoDailyDashboard(projectId, date), getCodeOptions(projectId), listProjectMembers(projectId)]);
  if (!data.exists) redirect(`/pmo-daily/new?date=${date}`);
  return <PmoDailyScreen data={data} groups={options.tracks} members={members} mode="edit" />;
}
