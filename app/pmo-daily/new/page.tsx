import { requirePmPmoContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { listProjectMembers } from "@/lib/server/users";
import { getPmoDailyDashboard } from "@/lib/server/pmo-daily";
import { PmoDailyScreen } from "@/screens/PmoDailyScreen";

export const dynamic = "force-dynamic";

function todayInKorea() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default async function NewPmoDailyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId } = await requirePmPmoContext();
  const params = await searchParams;
  const reportDate = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayInKorea();
  const [data, options, members] = await Promise.all([getPmoDailyDashboard(projectId, reportDate), getCodeOptions(projectId), listProjectMembers(projectId)]);
  return <PmoDailyScreen data={data} groups={options.tracks} members={members} mode="new" />;
}
