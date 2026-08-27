import Link from "next/link";
import { getLocalContext } from "@/lib/server/context";
import { getWeeklyReportDetail } from "@/lib/server/work-management";
import { getWeeklySummary } from "@/lib/server/weekly-report-summary";
import { WeeklySummaryScreen } from "@/features/work/WeeklySummaryScreen";

export const dynamic = "force-dynamic";

export default async function WeeklySummaryPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const { projectId, userId, role } = await getLocalContext();
  const [detail, summary] = await Promise.all([
    getWeeklyReportDetail(projectId, userId, weekId),
    getWeeklySummary(projectId, weekId),
  ]);
  const canGenerate = role === "SUPER_ADMIN" && detail.status === "closed";
  return <>
    <header className="topbar"><div><h1>{detail.reportName} 요약정보</h1><p>업무그룹별 리포트를 AI로 통합 요약합니다.</p></div><div className="topbar-actions"><Link className="button secondary" href={`/weekly-reports/${detail.id}`}>상세로</Link></div></header>
    <div className="content weekly-report-content"><WeeklySummaryScreen weekId={detail.id} initialSummary={summary} canGenerate={canGenerate} /></div>
  </>;
}
