import Link from "next/link";
import { getLocalContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { listProjectMembers } from "@/lib/server/users";
import { getCalendarEvent,listCalendarEvents,type CalendarEvent } from "@/lib/server/calendar";
import { CalendarEventForm } from "@/features/calendar/CalendarEventForm";
import { CalendarModal } from "@/features/calendar/CalendarModal";

export const dynamic="force-dynamic";
type View="year"|"month"|"week"|"day"|"agenda";
const VIEW_LABEL:Record<View,string>={year:"년간",month:"월간",week:"주간",day:"일간",agenda:"목록"};
const iso=(d:Date)=>d.toISOString().slice(0,10);
const addDays=(d:Date,n:number)=>new Date(d.getTime()+n*86400000);
const parse=(s:string)=>new Date(`${s}T00:00:00Z`);
const monday=(d:Date)=>addDays(d,-((d.getUTCDay()+6)%7));

function range(view:View,selected:Date){
  if(view==="day")return {from:selected,to:selected,cells:[selected]};
  if(view==="week"){const from=monday(selected);return {from,to:addDays(from,6),cells:Array.from({length:7},(_,i)=>addDays(from,i))};}
  if(view==="year"){const from=new Date(Date.UTC(selected.getUTCFullYear(),0,1)),to=new Date(Date.UTC(selected.getUTCFullYear(),11,31));return {from,to,cells:Array.from({length:12},(_,i)=>new Date(Date.UTC(selected.getUTCFullYear(),i,1)))};}
  const first=new Date(Date.UTC(selected.getUTCFullYear(),selected.getUTCMonth(),1));
  const last=new Date(Date.UTC(selected.getUTCFullYear(),selected.getUTCMonth()+1,0));
  if(view==="agenda")return {from:first,to:last,cells:Array.from({length:last.getUTCDate()},(_,i)=>addDays(first,i))};
  const from=monday(first),to=addDays(monday(last),6);
  return {from,to,cells:Array.from({length:Math.round((to.getTime()-from.getTime())/86400000)+1},(_,i)=>addDays(from,i))};
}
function move(view:View,date:Date,direction:number){if(view==="year")return new Date(Date.UTC(date.getUTCFullYear()+direction,0,1));if(view==="month"||view==="agenda")return new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+direction,1));return addDays(date,direction*(view==="week"?7:1));}
function EventLink({event,base}:{event:CalendarEvent;base:string}){const href=event.editable?`${base}&edit=${encodeURIComponent(event.id)}`:event.sourceUrl??base;const priorityClass=event.source==="schedule"?`priority-${event.priority.toLowerCase()}`:"";return <Link className={`calendar-event event-${event.source} ${priorityClass}`} href={href}><span>{event.allDay?"종일":event.startTime}</span><strong>{event.isMilestone&&"★ "}{event.title}{event.isRecurring&&" ↻"}</strong>{event.areaLabel&&<small>{event.areaLabel}</small>}</Link>}

export default async function CalendarPage({searchParams}:{searchParams:Promise<{view?:string;date?:string;edit?:string;new?:string}>}){
  const {projectId,role}=await getLocalContext();const canWrite=role==="ADMIN"||role==="OPERATOR";const q=await searchParams;
  const view:View=(["year","month","week","day","agenda"] as View[]).includes(q.view as View)?(q.view as View):"month";
  const today=iso(new Date()),selected=/^\d{4}-\d{2}-\d{2}$/.test(q.date??"")?parse(q.date!):parse(today),r=range(view,selected);
  const base=`/calendar?view=${view}&date=${iso(selected)}`;
  const [events,codes,members,edit]=await Promise.all([listCalendarEvents(projectId,iso(r.from),iso(r.to)),getCodeOptions(projectId),listProjectMembers(projectId),q.edit?getCalendarEvent(projectId,q.edit):null]);
  const byDate=events.reduce<Record<string,CalendarEvent[]>>((a,e)=>{(a[e.date]??=[]).push(e);return a;},{});
  const title=view==="year"?`${selected.getUTCFullYear()}년`:view==="month"||view==="agenda"?`${selected.getUTCFullYear()}년 ${selected.getUTCMonth()+1}월`:view==="week"?`${iso(r.from)} ~ ${iso(r.to)}`:new Intl.DateTimeFormat("ko-KR",{dateStyle:"full",timeZone:"UTC"}).format(selected);
  const newDate=/^\d{4}-\d{2}-\d{2}$/.test(q.new??"")?q.new!:null;
  return <>
    <header className="topbar"><div><h1>통합 캘린더</h1><p>날짜를 선택하면 일정을 등록하고, 등록 일정을 선택하면 수정할 수 있습니다.</p></div><div className="topbar-actions">{canWrite&&<Link className="button secondary" href="/calendar/excel">엑셀</Link>}<Link className="button secondary" href="/calendar/search">검색</Link><Link className="button secondary" href="/calendar/milestones">주요 이벤트</Link>{canWrite&&<Link className="button primary" href={`${base}&new=${iso(selected)}`}>+ 일정 등록</Link>}</div></header>
    <div className="content">
      <section className="panel calendar-panel">
        <div className="calendar-toolbar"><div className="calendar-nav"><Link className="button secondary" href={`/calendar?view=${view}&date=${iso(move(view,selected,-1))}`}>이전</Link><Link className="button secondary" href={`/calendar?view=${view}&date=${today}`}>오늘</Link><Link className="button secondary" href={`/calendar?view=${view}&date=${iso(move(view,selected,1))}`}>다음</Link></div><h2>{title}</h2><div className="calendar-views">{(["year","month","week","day","agenda"] as View[]).map(v=><Link className={`button ${view===v?"primary":"secondary"}`} href={`/calendar?view=${v}&date=${iso(selected)}`} key={v}>{VIEW_LABEL[v]}</Link>)}</div></div>
        {view==="month"&&<><div className="calendar-weekdays">{["월","화","수","목","금","토","일"].map(d=><span key={d}>{d}</span>)}</div><div className="calendar-month">{r.cells.map(d=>{const key=iso(d),outside=d.getUTCMonth()!==selected.getUTCMonth();return <div className={`calendar-cell ${outside?"outside":""} ${key===today?"today":""}`} key={key}>{canWrite?<Link className="calendar-date" title={`${key} 일정 등록`} href={`${base}&new=${key}`}>{d.getUTCDate()}</Link>:<span className="calendar-date">{d.getUTCDate()}</span>}<div>{(byDate[key]??[]).slice(0,4).map(e=><EventLink event={e} base={base} key={`${e.source}-${e.id}`}/>)}{(byDate[key]?.length??0)>4&&<small className="calendar-more">+{byDate[key].length-4}개</small>}</div></div>})}</div></>}
        {(view==="week"||view==="day")&&<div className={`calendar-period ${view}`}>{r.cells.map(d=>{const key=iso(d);return <div className={`calendar-period-day ${key===today?"today":""}`} key={key}><header><strong>{new Intl.DateTimeFormat("ko-KR",{weekday:"short",timeZone:"UTC"}).format(d)}</strong>{canWrite&&<Link title={`${key} 일정 등록`} href={`${base}&new=${key}`}>{d.getUTCDate()} <small>+</small></Link>}</header><div>{(byDate[key]??[]).map(e=><EventLink event={e} base={base} key={`${e.source}-${e.id}`}/>)}{!(byDate[key]?.length)&&canWrite&&<Link className="calendar-empty" href={`${base}&new=${key}`}>클릭하여 일정 등록</Link>}</div></div>})}</div>}
        {view==="year"&&<div className="calendar-year">{r.cells.map(monthStart=>{const monthKey=`${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth()+1).padStart(2,"0")}`,count=events.filter(e=>e.date.startsWith(monthKey)).length;return <Link className="calendar-year-cell" href={`/calendar?view=month&date=${iso(monthStart)}`} key={monthKey}><strong>{monthStart.getUTCMonth()+1}월</strong><span>{count>0?`일정 ${count}건`:"일정 없음"}</span></Link>})}</div>}
        {view==="agenda"&&<div className="calendar-agenda">{r.cells.map(d=>{const key=iso(d);const dayEvents=byDate[key]??[];if(!dayEvents.length)return null;return <div className="calendar-agenda-day" key={key}><header>{new Intl.DateTimeFormat("ko-KR",{month:"long",day:"numeric",weekday:"short",timeZone:"UTC"}).format(d)}</header><div>{dayEvents.map(e=><EventLink event={e} base={base} key={`${e.source}-${e.id}`}/>)}</div></div>})}{!events.length&&<p className="empty">이 달에는 일정이 없습니다.</p>}</div>}
      </section>
      <div className="calendar-legend"><span><i className="priority-high"/>우선순위 상</span><span><i className="priority-medium"/>우선순위 중</span><span><i className="priority-low"/>우선순위 하</span><span><i className="progress"/>목표일</span><span><i className="next_plan"/>차주 계획</span><span><i className="issue"/>이슈</span><span>★ 마일스톤</span><span>↻ 반복 일정</span></div>
    </div>
    {((newDate&&canWrite)||edit)&&<CalendarModal title={edit?"일정 수정":"일정 등록"} returnUrl={base}><CalendarEventForm areas={codes.tracks} members={members} event={edit} selectedDate={newDate??edit?.date??iso(selected)} returnUrl={base} canWrite={canWrite}/></CalendarModal>}
  </>;
}
