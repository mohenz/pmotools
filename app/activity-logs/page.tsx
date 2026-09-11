import { requireAdminContext } from "@/lib/server/context";
import { listActivityLogs, listAuditTables } from "@/lib/server/work-management";

export const dynamic = "force-dynamic";

export default async function ActivityLogsPage({ searchParams }: { searchParams: Promise<{ table?: string; from?: string; to?: string }> }) {
  const { projectId } = await requireAdminContext();
  const filters = await searchParams;
  const [rows, tables] = await Promise.all([listActivityLogs(projectId, filters), listAuditTables(projectId)]);
  return <>
    <header className="topbar"><div><h1>사용자 활동 내역</h1><p>주요 업무 데이터의 변경 이력을 조회합니다.</p></div></header>
    <div className="content">
      <section className="panel compact">
        <form className="inline-create" method="get">
          <label>대상 테이블<select name="table" defaultValue={filters.table ?? ""}><option value="">전체</option>{tables.map((table) => <option value={table} key={table}>{table}</option>)}</select></label>
          <label>시작일<input name="from" type="date" defaultValue={filters.from ?? ""} /></label>
          <label>종료일<input name="to" type="date" defaultValue={filters.to ?? ""} /></label>
          <button className="button secondary" type="submit">조회</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>최근 활동</h2><span>{rows.length}건</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>일시</th><th>사용자</th><th>행위</th><th>변경 요약</th></tr></thead>
            <tbody>
              {rows.map((r) => <tr key={r.id}><td className="mono">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(r.createdAt))}</td><td>{r.actorName ?? "시스템"}</td><td><span className="badge">{r.action}</span></td><td className="title-cell">{r.afterData ? Object.keys(r.afterData).slice(0, 6).join(", ") : "삭제"}</td></tr>)}
              {!rows.length && <tr><td colSpan={4} className="empty">조회된 활동 내역이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </>;
}
