import { getLocalContext } from "@/lib/server/context";
import { getWeeklyReportDetail } from "@/lib/server/work-management";
import { WeeklyReportDetailClient } from "@/features/work/WeeklyReportDetailClient";
import { WeeklySummaryButton } from "@/features/work/WeeklySummaryButton";

export const dynamic = "force-dynamic";

export default async function WeeklyReportDetailPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const { projectId, userId } = await getLocalContext();
  const detail = await getWeeklyReportDetail(projectId, userId, weekId);
  return <>
    <header className="topbar"><div><h1>{detail.reportName}</h1><p>업무모듈별 실적, 계획, 이슈 및 요청사항을 통합 조회합니다.</p></div><div className="topbar-actions">{detail.canManage && detail.status === "closed" && <WeeklySummaryButton weekId={detail.id} />}</div></header>
    <div className="content weekly-report-content"><WeeklyReportDetailClient detail={detail} /></div>
  </>;
}
