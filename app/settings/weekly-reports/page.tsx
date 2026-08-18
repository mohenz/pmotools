import { WeeklyReportGenerateForm } from "@/features/work/WeeklyReportGenerateForm";
import { inferWeekOfMonth } from "@/lib/domain/weekly-reports";
import { requireManagerContext } from "@/lib/server/context";
import { listWeeklyReportSummaries } from "@/lib/server/work-management";
import { WeeklyReportManagementScreen } from "@/screens/WeeklyReportManagementScreen";

export const dynamic = "force-dynamic";

export default async function WeeklyReportSettingsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { projectId } = await requireManagerContext();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const result = await listWeeklyReportSummaries(projectId, { q, page, pageSize: 20 });
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const defaultWeek = Math.min(5, inferWeekOfMonth(today));

  return <>
    <header className="topbar"><div><h1>위클리리포트 관리</h1><p>위클리리포트를 생성하고 기존 목록을 조회·삭제합니다.</p></div></header>
    <div className="content settings-content weekly-report-content">
      <section className="panel weekly-management-panel">
        <div className="panel-head"><div><h2>위클리 리포트 생성</h2><p>실적은 선택 주차의 전주 월~금, 계획은 선택 주차의 월~금 기준입니다.</p></div></div>
        <WeeklyReportGenerateForm defaultYear={now.getFullYear()} defaultMonth={now.getMonth() + 1} defaultWeek={defaultWeek} />
      </section>
      <WeeklyReportManagementScreen result={result} q={q} />
    </div>
  </>;
}
