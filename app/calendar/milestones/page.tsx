import Link from "next/link";
import { getLocalContext } from "@/lib/server/context";
import { listMilestones } from "@/lib/server/calendar";

export const dynamic = "force-dynamic";

function dDayLabel(daysUntil: number) {
  if (daysUntil === 0) return "D-DAY";
  return daysUntil > 0 ? `D-${daysUntil}` : `D+${Math.abs(daysUntil)}`;
}

export default async function MilestonesPage() {
  const { projectId } = await getLocalContext();
  const milestones = await listMilestones(projectId);
  const upcoming = milestones.filter((m) => m.daysUntil >= 0);
  const past = milestones.filter((m) => m.daysUntil < 0);
  return <>
    <header className="topbar"><div><h1>주요 이벤트 모아보기</h1><p>마일스톤·우선순위 &quot;상&quot; 일정과 프로젝트 오픈일자를 한눈에 확인합니다.</p></div><Link className="button secondary" href="/calendar">캘린더로</Link></header>
    <div className="content">
      <section className="panel">
        <div className="panel-head"><h2>다가오는 일정</h2><span>{upcoming.length}건</span></div>
        <div className="milestone-list">
          {upcoming.map((m) => <div className="milestone-row" key={m.id}><span className="d-day">{dDayLabel(m.daysUntil)}</span><span>{m.title}{m.kind === "project" && <em className="kind-project"> · 프로젝트 일정</em>}</span><span className="mono">{m.date}</span></div>)}
          {!upcoming.length && <p className="empty">다가오는 주요 이벤트가 없습니다.</p>}
        </div>
      </section>
      {past.length > 0 && <section className="panel">
        <div className="panel-head"><h2>지난 일정</h2><span>{past.length}건</span></div>
        <div className="milestone-list">
          {past.map((m) => <div className="milestone-row" key={m.id}><span className="d-day past">{dDayLabel(m.daysUntil)}</span><span>{m.title}{m.kind === "project" && <em className="kind-project"> · 프로젝트 일정</em>}</span><span className="mono">{m.date}</span></div>)}
        </div>
      </section>}
    </div>
  </>;
}
