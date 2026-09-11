import Link from "next/link";
import { getLocalContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { listProjectMembers } from "@/lib/server/users";
import { searchCalendarEvents } from "@/lib/server/calendar";

export const dynamic = "force-dynamic";

export default async function CalendarSearchPage({ searchParams }: { searchParams: Promise<{ q?: string; priority?: string; groupId?: string; assigneeId?: string; from?: string; to?: string }> }) {
  const { projectId, userId } = await getLocalContext();
  const filters = await searchParams;
  const [results, options, members] = await Promise.all([searchCalendarEvents(projectId, filters, userId), getCodeOptions(projectId), listProjectMembers(projectId)]);
  return <>
    <header className="topbar"><div><h1>일정 검색</h1><p>기간·담당자·업무그룹·우선순위를 조합해 일정을 찾습니다.</p></div><Link className="button secondary" href="/calendar">캘린더로</Link></header>
    <div className="content">
      <section className="panel compact">
        <form className="inline-create" method="get">
          <label>검색어<input name="q" defaultValue={filters.q ?? ""} placeholder="제목·설명·장소" maxLength={100} /></label>
          <label>우선순위<select name="priority" defaultValue={filters.priority ?? ""}><option value="">전체</option><option value="HIGH">상</option><option value="MEDIUM">중</option><option value="LOW">하</option></select></label>
          <label>업무그룹<select name="groupId" defaultValue={filters.groupId ?? ""}><option value="">전체</option>{options.tracks.map((t) => <option value={t.id} key={t.id}>{t.label}</option>)}</select></label>
          <label>담당자<select name="assigneeId" defaultValue={filters.assigneeId ?? ""}><option value="">전체</option>{members.map((m) => <option value={m.id} key={m.id}>{m.name}</option>)}</select></label>
          <label>시작일<input name="from" type="date" defaultValue={filters.from ?? ""} /></label>
          <label>종료일<input name="to" type="date" defaultValue={filters.to ?? ""} /></label>
          <button className="button primary" type="submit">검색</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>검색 결과</h2><span>{results.length}건</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>날짜</th><th>제목</th><th>우선순위</th><th>업무그룹</th><th>담당자</th></tr></thead>
            <tbody>
              {results.map((event) => <tr key={event.id}>
                <td className="mono">{event.date}</td>
                <td className="title-cell"><Link href={`/calendar?view=day&date=${event.date}&edit=${encodeURIComponent(event.id)}`}>{event.isMilestone && "★ "}{event.title}</Link></td>
                <td><span className={`badge ${event.priority === "HIGH" ? "issue" : event.priority === "MEDIUM" ? "" : "level-pm"}`}>{event.priority === "HIGH" ? "상" : event.priority === "MEDIUM" ? "중" : "하"}</span></td>
                <td>{event.areaLabel ?? "-"}{event.groupTags.length > 0 && ` +${event.groupTags.length}`}</td>
                <td>{event.assignees.map((a) => a.name).join(", ") || "-"}</td>
              </tr>)}
              {!results.length && <tr><td colSpan={5} className="empty">검색 결과가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </>;
}
