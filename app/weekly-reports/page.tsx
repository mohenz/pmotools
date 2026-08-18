import Link from "next/link";
import { getLocalContext } from "@/lib/server/context";
import { listWeeklyReportSummaries } from "@/lib/server/work-management";

export const dynamic = "force-dynamic";

const hrefFor = (q: string, page: number) => `/weekly-reports?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page) })}`;

export default async function WeeklyReportsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const { projectId } = await getLocalContext();
  const result = await listWeeklyReportSummaries(projectId, { q, page, pageSize: 10 });

  return <>
    <header className="topbar"><div><h1>위클리리포트</h1></div></header>
    <div className="content weekly-report-content">
      <section className="panel weekly-list-panel">
        <div className="panel-head"><h2>위클리 리포트 목록</h2><span>총 {result.total}건</span></div>
        <form className="weekly-report-search" method="get"><input name="q" defaultValue={q} placeholder="리포트명 또는 프로젝트명 검색" aria-label="위클리리포트 검색" /><button className="button secondary">검색</button></form>
        <div className="table-wrap"><table>
          <thead><tr><th>리포트명</th><th>실적 기간</th><th>계획 기간</th><th>작성 현황</th><th>상태</th><th>생성일</th></tr></thead>
          <tbody>{result.rows.length ? result.rows.map((row) => <tr key={row.id}>
            <td className="title-cell"><Link className="table-link" href={`/weekly-reports/${row.id}`}>{row.reportName}</Link></td>
            <td>{row.actualStart} ~ {row.actualEnd}</td><td>{row.planStart} ~ {row.planEnd}</td><td>{row.completedCount} / {row.moduleCount}</td>
            <td><span className={`weekly-status ${row.status}`}>{row.status === "closed" ? "PM 확인 완료" : "작성 중"}</span></td><td>{row.createdAt.slice(0, 10)}</td>
          </tr>) : <tr><td className="empty-table" colSpan={6}>생성된 위클리리포트가 없습니다.</td></tr>}</tbody>
        </table></div>
        <nav className="pagination" aria-label="페이지 이동">
          {result.page > 1 ? <Link href={hrefFor(q, result.page - 1)}>이전</Link> : <span className="disabled" aria-disabled="true">이전</span>}
          <strong>{result.page} / {result.pageCount} 페이지</strong>
          {result.page < result.pageCount ? <Link href={hrefFor(q, result.page + 1)}>다음</Link> : <span className="disabled" aria-disabled="true">다음</span>}
        </nav>
      </section>
    </div>
  </>;
}
