import Link from "next/link";
import { getLocalContext } from "@/lib/server/context";
import { getWeeklyReportDetail } from "@/lib/server/work-management";
import { WeeklyReportDetailClient } from "@/features/work/WeeklyReportDetailClient";

export const dynamic = "force-dynamic";

export default async function WeeklyReportDetailPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const { projectId, userId, role } = await getLocalContext();
  const detail = await getWeeklyReportDetail(projectId, userId, weekId);
  return <>
    <header className="topbar"><div><h1>{detail.reportName}</h1><p>업무그룹별 실적, 계획, 이슈 및 요청사항을 통합 조회합니다.</p></div><div className="topbar-actions"><Link className="button secondary" href={`/weekly-reports/print?week=${detail.id}`}>리포트 인쇄보기</Link><Link className="button primary" href={`/weekly-reports/print?week=${detail.id}&pdf=1`}>PDF 파일 생성</Link>{role === "SUPER_ADMIN" && <Link className="button secondary" href={`/weekly-reports/${detail.id}/summary`}>요약정보</Link>}</div></header>
    <div className="content weekly-report-content"><WeeklyReportDetailClient detail={detail} /></div>
  </>;
}
