import { notFound } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";
import { getWeeklyReportDetail } from "@/lib/server/work-management";
import { WeeklyReportFormScreen } from "@/features/work/WeeklyReportFormScreen";

export const dynamic = "force-dynamic";

export default async function WeeklyReportEditPage({ params }: { params: Promise<{ weekId: string; groupId: string }> }) {
  const { weekId, groupId } = await params;
  const { projectId, userId } = await getLocalContext();
  const detail = await getWeeklyReportDetail(projectId, userId, weekId);
  const report = detail.reports.find((item) => item.areaCodeId === groupId);
  if (!report) notFound();
  return <WeeklyReportFormScreen reportName={detail.reportName} report={report} />;
}
