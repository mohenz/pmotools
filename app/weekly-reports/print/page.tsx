import { getLocalContext } from "@/lib/server/context";
import { listWeeklyReports } from "@/lib/server/work-management";

export default async function PrintReport({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { projectId } = await getLocalContext();
  const { week } = await searchParams;
  const rows = await listWeeklyReports(projectId, week);
  return <div className="print-report"><header><h1>위클리 리포트</h1><p>{rows[0]?.weekLabel ?? "생성된 리포트가 없습니다."}</p></header>{rows.map((row) => <section key={row.id}><h2>{row.areaLabel}</h2><table><tbody><tr><th>실적</th><td>{row.achievements}</td></tr><tr><th>계획</th><td>{row.nextPlan}</td></tr><tr><th>이슈 및 요청사항</th><td>{row.issues}</td></tr></tbody></table></section>)}</div>;
}
