import { getLocalContext } from "@/lib/server/context";
import { listWeeklyReports } from "@/lib/server/work-management";
import { WeeklyReportPrintActions } from "@/features/work/WeeklyReportPrintActions";

export default async function PrintReport({ searchParams }: { searchParams: Promise<{ week?: string; pdf?: string; embedded?: string }> }) {
  const { projectId } = await getLocalContext();
  const { week, pdf, embedded } = await searchParams;
  const rows = await listWeeklyReports(projectId, week);
  const weeks = Map.groupBy(rows, (row) => row.weekId);
  return <div className="print-report-shell">
    <WeeklyReportPrintActions autoPrint={pdf === "1"} weekId={week} showBackLink={embedded !== "1"} />
    <div className="print-report"><header><h1>위클리 리포트</h1><p>{week ? rows[0]?.weekLabel : "전체 위클리리포트"}</p></header>
      {rows.length ? Array.from(weeks.entries()).map(([weekId, reports]) => <section className="weekly-pdf-week" key={weekId}>
        <h2>{reports[0].weekLabel}</h2>
        {reports.map((row) => <article key={row.id}><h3>{row.areaLabel}</h3><table><tbody><tr><th>실적</th><td>{row.achievements || "-"}</td></tr><tr><th>계획</th><td>{row.nextPlan || "-"}</td></tr><tr><th>이슈 및 요청사항</th><td>{row.issues || "-"}</td></tr><tr><th>의사결정</th><td>{row.decisions || "-"}</td></tr><tr><th>비고</th><td>{row.notes || "-"}</td></tr></tbody></table></article>)}
      </section>) : <p className="empty">생성된 리포트가 없습니다.</p>}
    </div>
  </div>;
}
