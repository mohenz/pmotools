import { WeeklyReportGenerateForm } from "@/features/work/WeeklyReportGenerateForm";
import { inferWeekOfMonth } from "@/lib/domain/weekly-reports";
import { requireManagerContext } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export default async function WeeklyReportSettingsPage() {
  await requireManagerContext();

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const defaultWeek = Math.min(5, inferWeekOfMonth(today));

  return <>
    <header className="topbar"><div><h1>위클리리포트 관리</h1><p>보고 기준 월과 주차를 선택하여 위클리리포트를 생성합니다.</p></div></header>
    <div className="content settings-content weekly-report-content">
      <section className="panel weekly-management-panel">
        <div className="panel-head"><div><h2>위클리 리포트 생성</h2><p>실적은 선택 주차의 전주 월~금, 계획은 선택 주차의 월~금 기준입니다.</p></div></div>
        <WeeklyReportGenerateForm defaultYear={now.getFullYear()} defaultMonth={now.getMonth() + 1} defaultWeek={defaultWeek} />
      </section>
    </div>
  </>;
}
